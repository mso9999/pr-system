#!/usr/bin/env python3
"""
Phase 2.3 — Copy PR whatsNew/* into nexus_whats_new/* (one-time).

PR's whatsNew collection (1 doc) is consolidated into the unified
nexus_whats_new collection. Uses the Admin SDK service account (admin,
rules bypassed). Idempotent: skips items whose title already exists in
nexus_whats_new.

Usage:
  python3 scripts/migrate_whats_new_to_nexus.py            # dry run
  python3 scripts/migrate_whats_new_to_nexus.py --apply     # write
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import jwt
except ImportError:
    sys.exit("PyJWT required: pip install PyJWT cryptography")

ROOT = Path(__file__).resolve().parent.parent
SA_PATH = ROOT / "firebase-service-account.json"
PROJECT = "pr-system-4ea55"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"


def mint_token(sa):
    now = int(time.time())
    payload = {"iss": sa["client_email"], "scope": "https://www.googleapis.com/auth/datastore",
               "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600}
    signed = jwt.encode(payload, sa["private_key"], algorithm="RS256",
                        headers={"typ": "JWT", "alg": "RS256"})
    data = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                   "assertion": signed}).encode()
    r = urllib.request.Request("https://oauth2.googleapis.com/token", data=data,
                               headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(r, timeout=20) as resp:
        return json.load(resp)["access_token"]


def list_docs(token, coll):
    out, page = [], None
    while True:
        url = f"{BASE}/{coll}?pageSize=300"
        if page:
            url += "&pageToken=" + urllib.parse.quote(page)
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"}), timeout=30) as r:
            d = json.load(r)
        out.extend(d.get("documents", []))
        page = d.get("nextPageToken")
        if not page:
            break
    return out


def val_to_py(v):
    if "nullValue" in v: return None
    if "booleanValue" in v: return v["booleanValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "stringValue" in v: return v["stringValue"]
    if "arrayValue" in v: return [val_to_py(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: val_to_py(val) for k, val in v["mapValue"].get("fields", {}).items()}
    if "timestampValue" in v: return v["timestampValue"]
    return None


def py_to_fs(value):
    if value is None: return {"nullValue": None}
    if isinstance(value, bool): return {"booleanValue": value}
    if isinstance(value, int): return {"integerValue": str(value)}
    if isinstance(value, float): return {"doubleValue": value}
    if isinstance(value, str): return {"stringValue": value}
    if isinstance(value, list): return {"arrayValue": {"values": [py_to_fs(v) for v in value]}}
    if isinstance(value, dict): return {"mapValue": {"fields": {k: py_to_fs(v) for k, v in value.items()}}}
    return {"stringValue": str(value)}


def create_doc(token, coll, fields):
    body = json.dumps({"fields": fields}).encode()
    url = f"{BASE}/{coll}"
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    sa = json.loads(SA_PATH.read_text())
    token = mint_token(sa)
    print(f"[{'APPLY' if args.apply else 'dry-run'}]")

    src = list_docs(token, "whatsNew")
    dst = list_docs(token, "nexus_whats_new")
    existing_titles = {val_to_py(d["fields"].get("title", {"stringValue": ""})) for d in dst}
    print(f"whatsNew={len(src)} nexus_whats_new={len(dst)} existing_titles={existing_titles}")

    copied = skipped = 0
    for d in src:
        fields = {k: v for k, v in d["fields"].items() if k not in ("id",)}
        title = val_to_py(fields.get("title", {"stringValue": ""}))
        if title and title in existing_titles:
            print(f"  skip (title exists): {title!r}")
            skipped += 1
            continue
        # Mark origin for traceability
        fields["source"] = {"stringValue": "pr-whatsNew-migration"}
        print(f"  copy: {title!r}")
        if args.apply:
            create_doc(token, "nexus_whats_new", fields)
        copied += 1

    print(f"\nDone. copied={copied} skipped={skipped}")
    if not args.apply:
        print("(dry-run) re-run with --apply to write.")


if __name__ == "__main__":
    main()
