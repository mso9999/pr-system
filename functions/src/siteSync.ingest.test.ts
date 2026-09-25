import { beforeAll, beforeEach, expect, it, vi } from "vitest";

const docs = new Map<string, Record<string, unknown>>();

vi.mock("firebase-admin", () => {
  const docRef = (id: string) => ({
    id,
    get: async () => ({ id, exists: docs.has(id), data: () => docs.get(id) }),
    set: async (value: Record<string, unknown>, opts?: { merge?: boolean }) => {
      docs.set(id, opts?.merge ? { ...(docs.get(id) || {}), ...value } : value);
    },
    update: async (value: Record<string, unknown>) => {
      docs.set(id, { ...(docs.get(id) || {}), ...value });
    },
  });
  const snapshotOf = (filters: [string, unknown][]) => {
    const rows = [...docs.entries()]
      .filter(([, data]) => filters.every(([f, v]) => data[f] === v))
      .map(([id, data]) => ({ id, data: () => data, ref: docRef(id) }));
    return { empty: rows.length === 0, docs: rows };
  };
  const query = (filters: [string, unknown][]): any => ({
    where: (field: string, _op: string, value: unknown) => query([...filters, [field, value]]),
    get: async () => snapshotOf(filters),
  });
  const collection = () => ({
    doc: docRef,
    where: (field: string, _op: string, value: unknown) => query([[field, value]]),
    get: async () => snapshotOf([]),
  });
  return {
    firestore: () => ({ collection }),
    auth: () => ({ verifyIdToken: async () => { throw new Error("no"); } }),
    initializeApp: () => undefined,
  };
});

let ingest: any;
let updateCoords: any;

beforeAll(async () => {
  process.env.SITE_SYNC_UGP_API_KEY = "ugp-key";
  const mod = await import("./siteSync");
  ingest = mod.ingestUgpSite;
  updateCoords = mod.updateSiteCoordinates;
});

beforeEach(() => docs.clear());

async function call(handler: any, body: Record<string, unknown>) {
  const res: any = { statusCode: 200, body: null };
  res.set = () => res;
  res.status = (s: number) => { res.statusCode = s; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  res.send = () => res;
  await handler({ method: "POST", headers: { "x-api-key": "ugp-key" }, body }, res);
  return res;
}

const kot = { organizationId: "1pwr_benin", code: "KOT", name: "Kotokpa", ugpProjectId: "KOT_minigrid" };

it("uses the code exactly as given and creates a GPS-pending site", async () => {
  const res = await call(ingest, { ...kot, name: "Damouti place" });
  expect(res.statusCode).toBe(200);
  const doc = docs.get("1pwr_benin_kot")!;
  expect(doc.code).toBe("KOT");
  expect(doc.coordinatesPending).toBe(true);
  expect(doc.canonicalUgpProjectId).toBe("KOT_minigrid");
});

it("returns a code conflict until the bind is confirmed", async () => {
  docs.set("1pwr_benin_kot", { organizationId: "1pwr_benin", code: "KOT", name: "KOTOKPA" });
  const first = await call(ingest, kot);
  expect(first.statusCode).toBe(409);
  expect(first.body.conflict).toBe("code");
  expect(first.body.site.name).toBe("KOTOKPA");
  expect(docs.get("1pwr_benin_kot")!.canonicalUgpProjectId).toBeUndefined();

  const bound = await call(ingest, { ...kot, bindConfirmed: true, latitude: 10.1, longitude: 1.9, coordinateSource: "centroid" });
  expect(bound.statusCode).toBe(200);
  const doc = docs.get("1pwr_benin_kot")!;
  expect(doc.canonicalUgpProjectId).toBe("KOT_minigrid");
  expect(doc.coordinateSource).toBe("centroid");
});

it("refuses to take over a site bound to another design", async () => {
  docs.set("1pwr_benin_kot", { organizationId: "1pwr_benin", code: "KOT", canonicalUgpProjectId: "KOT2_minigrid" });
  const res = await call(ingest, { ...kot, bindConfirmed: true });
  expect(res.statusCode).toBe(409);
  expect(res.body.conflict).toBe("canonical");
});

it("flags a new code within 300 m of an existing site until confirmed", async () => {
  docs.set("1pwr_benin_sin", { organizationId: "1pwr_benin", code: "SIN", name: "SINLITA", latitude: 10.0, longitude: 2.0 });
  const near = { ...kot, latitude: 10.001, longitude: 2.001 };
  const first = await call(ingest, near);
  expect(first.statusCode).toBe(409);
  expect(first.body.conflict).toBe("nearby");
  expect(first.body.nearby[0].code).toBe("SIN");
  const ok = await call(ingest, { ...near, proximityConfirmed: true });
  expect(ok.statusCode).toBe(200);
});

it("keeps a gensite coordinate over a later centroid", async () => {
  docs.set("1pwr_benin_kot", {
    organizationId: "1pwr_benin", code: "KOT", latitude: 10, longitude: 2, coordinateSource: "gensite",
  });
  const res = await call(updateCoords, { organizationId: "1pwr_benin", siteCode: "KOT", latitude: 11, longitude: 3, coordinateSource: "centroid" });
  expect(res.body.unchanged).toBe(true);
  expect(docs.get("1pwr_benin_kot")!.latitude).toBe(10);
  const gen = await call(updateCoords, { organizationId: "1pwr_benin", siteCode: "KOT", latitude: 12, longitude: 4 });
  expect(gen.statusCode).toBe(200);
  expect(docs.get("1pwr_benin_kot")!.latitude).toBe(12);
});

it("binds an auto-id PR site instead of creating a duplicate", async () => {
  docs.set("qEl1h0ONMkQqgGaVgCwZ", { organizationId: "1pwr_benin", code: "DON", name: "DON AKADJAMEY" });
  const res = await call(ingest, {
    organizationId: "1pwr_benin", code: "DON", name: "DON MT-BT", ugpProjectId: "DON_minigrid",
    bindConfirmed: true, latitude: 7.0, longitude: 2.03, coordinateSource: "gensite",
  });
  expect(res.statusCode).toBe(200);
  expect(docs.has("1pwr_benin_don")).toBe(false);
  const doc = docs.get("qEl1h0ONMkQqgGaVgCwZ")!;
  expect(doc.canonicalUgpProjectId).toBe("DON_minigrid");
  expect(doc.name).toBe("DON AKADJAMEY");
  expect(doc.latitude).toBe(7.0);
});
