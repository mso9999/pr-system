#!/usr/bin/env python3
"""
Phase 2.1 — Backfill nexus_users/{uid} from PR users/{uid}.

Uses the Firebase Admin SDK service account (firebase-service-account.json)
to mint a Google OAuth2 access token with the datastore scope; Firestore REST
treats it as admin (rules bypassed). No Node dependency.

Usage:
  python3 scripts/migrate_pr_users_to_nexus.py            # dry run
  python3 scripts/migrate_pr_users_to_nexus.py --apply     # write

Required: firebase-service-account.json at repo root (gitignored).
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import jwt  # PyJWT
except ImportError:
    sys.exit("PyJWT required: pip install PyJWT cryptography")

ROOT = Path(__file__).resolve().parent.parent
SA_PATH = ROOT / "firebase-service-account.json"
PROJECT = "pr-system-4ea55"
FIRESTORE_BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
IMPORT_VERSION = "pr-nexus-phase2-1"


def mint_access_token(sa: dict) -> str:
    now = int(time.time())
    payload = {
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/datastore",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    signed = jwt.encode(payload, sa["private_key"], algorithm="RS256", headers={"typ": "JWT", "alg": "RS256"})
    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": signed,
    }).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["access_token"]


def firestore_get(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def firestore_patch(collection: str, doc_id: str, fields: dict, token: str) -> dict:
    """Upsert a doc via PATCH with an exists-if-creating fallback."""
    base = f"{FIRESTORE_BASE}/{urllib.parse.quote(collection)}/{urllib.parse.quote(doc_id)}"
    mask = "&".join("updateMask.fieldPaths=" + urllib.parse.quote(k) for k in fields)
    body = json.dumps({"fields": fields}).encode()
    req = urllib.request.Request(base + "?" + mask, data=body, method="PATCH",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Doc doesn't exist — create with documentId.
            curl = f"{FIRESTORE_BASE}/{urllib.parse.quote(collection)}?documentId={urllib.parse.quote(doc_id)}"
            req2 = urllib.request.Request(curl, data=body, method="POST",
                                          headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req2, timeout=30) as r:
                return json.load(r)
        raise


def py_to_firestore(value):
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [py_to_firestore(v) for v in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: py_to_firestore(v) for k, v in value.items()}}}
    return {"stringValue": str(value)}


def doc_to_py(fields: dict) -> dict:
    out = {}
    for k, v in fields.items():
        out[k] = _value_to_py(v)
    return out


def _value_to_py(v: dict):
    if "nullValue" in v:
        return None
    if "booleanValue" in v:
        return v["booleanValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return v["doubleValue"]
    if "stringValue" in v:
        return v["stringValue"]
    if "arrayValue" in v:
        return [_value_to_py(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: _value_to_py(val) for k, val in v["mapValue"].get("fields", {}).items()}
    if "timestampValue" in v:
        return v["timestampValue"]
    return None


def to_perm_level(v) -> int:
    if isinstance(v, bool):
        return 5
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        try:
            return int(v)
        except ValueError:
            return 5
    return 5


def build_patch(uid: str, u: dict, imported_at: str) -> dict:
    first = u.get("firstName") or ""
    last = u.get("lastName") or ""
    display = " ".join([first, last]).strip() or None
    perm = to_perm_level(u.get("permissionLevel"))
    is_active = u.get("isActive")
    is_active = True if is_active is None else bool(is_active)
    fields = {
        "uid": uid,
        "email": u.get("email") or "",
        "firstName": first,
        "lastName": last,
        "department": u.get("department"),
        "organization": u.get("organization"),
        "isActive": is_active,
        "systemAccess": {
            "pr": {
                "enabled": is_active,
                "permissionLevel": perm,
                "role": u.get("role"),
            }
        },
        "sources": ["pr"],
        "importedAt": imported_at,
        "importVersion": IMPORT_VERSION,
    }
    if display:
        fields["displayName"] = display
    return {k: py_to_firestore(v) for k, v in fields.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    if not SA_PATH.exists():
        sys.exit(f"Missing {SA_PATH}")
    sa = json.loads(SA_PATH.read_text())
    token = mint_access_token(sa)
    print(f"[{'APPLY' if args.apply else 'dry-run'}] minted OAuth2 access token")

    imported_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    page_token = None
    processed = written = skipped = errors = 0
    while True:
        url = f"{FIRESTORE_BASE}/users?pageSize=300"
        if page_token:
            url += "&pageToken=" + urllib.parse.quote(page_token)
        try:
            data = firestore_get(url, token)
        except urllib.error.HTTPError as e:
            sys.exit(f"users/ list failed: HTTP {e.code} {e.read()[:200]!r}")
        docs = data.get("documents", [])
        for d in docs:
            processed += 1
            uid = d["name"].rsplit("/", 1)[-1]
            fields = doc_to_py(d.get("fields", {}))
            if not fields.get("email"):
                skipped += 1
                continue
            patch = build_patch(uid, fields, imported_at)
            if not args.apply:
                if processed <= 3 or processed % 25 == 0:
                    sa_pr = {k: v for k, v in fields.items() if k in ("email", "permissionLevel", "isActive")}
                    print(f"  [dry-run] nexus_users/{uid} <- {sa_pr}")
                written += 1
                continue
            try:
                firestore_patch("nexus_users", uid, patch, token)
                written += 1
            except Exception as e:
                errors += 1
                print(f"  FAILED nexus_users/{uid}: {e}")
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    print(f"\nDone. processed={processed} written={written} skipped={skipped} errors={errors}")
    if not args.apply:
        print("(dry-run) re-run with --apply to write.")


if __name__ == "__main__":
    main()
