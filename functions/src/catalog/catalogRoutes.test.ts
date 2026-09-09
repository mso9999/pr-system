import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mock } from "../../test/firebaseAdminMock";
let handler: any;
const previousKey = process.env.PR_CATALOG_API_KEY;
beforeAll(async () => {
  process.env.PR_CATALOG_API_KEY = "test-read-key";
  handler = (await import("../prCatalogApi")).prCatalogApi;
});
afterAll(() => {
  if (previousKey === undefined) delete process.env.PR_CATALOG_API_KEY;
  else process.env.PR_CATALOG_API_KEY = previousKey;
});
beforeEach(() => {
  mock.collection.mockClear();
  const ref = { orderBy: mock.orderBy, limit: mock.limit, get: mock.get };
  mock.collection.mockReturnValue(ref);
  mock.orderBy.mockReturnValue(ref);
  mock.limit.mockReturnValue(ref);
  mock.get.mockResolvedValue({ docs: [] });
});
async function request(path: string, key?: string, query: object = {}, method = "GET") {
  const response: any = { statusCode: 200, headers: {}, body: null };
  response.set = (key: string, value: string) => { response.headers[key] = value; return response; };
  response.status = (status: number) => { response.statusCode = status; return response; };
  response.json = (body: unknown) => { response.body = body; return response; };
  response.end = () => response;
  await handler({ path, method, headers: { "x-api-key": key }, query }, response);
  return response;
}
it("requires the existing key and GET before reading archives", async () => {
  expect((await request("/api/v1/archived-purchase-requests")).statusCode).toBe(403);
  expect((await request("/api/v1/archived-purchase-requests", "wrong")).statusCode).toBe(403);
  expect((await request("/api/v1/archived-purchase-requests", "test-read-key", {}, "POST")).statusCode).toBe(405);
  expect(mock.collection).not.toHaveBeenCalled();
});
it("routes archive reads and returns no-store; malformed cursors fail before database reads", async () => {
  const bad = await request("/api/v1/archived-purchase-requests", "test-read-key", { cursor: "bad" });
  expect(bad.statusCode).toBe(400);
  expect(mock.collection).not.toHaveBeenCalled();
  const good = await request("/prCatalogApi/api/v1/archived-purchase-requests", "test-read-key");
  expect(good.statusCode).toBe(200);
  expect(good.headers["Cache-Control"]).toBe("no-store, max-age=0");
  expect(good.body).toEqual({ count: 0, items: [], nextCursor: null });
  expect(mock.collection).toHaveBeenCalledWith("archivePRs");
});
it("keeps both live route spellings compatible with the new line projection", async () => {
  mock.get.mockResolvedValue({ docs: [{ id: "p", data: () => ({ lineItems: [{ id: "l", description: "wire", quantity: 5.5, uom: "M" }] }) }] });
  for (const suffix of ["purchase-requests", "purchaseRequests"]) {
    const result = await request("/api/v1/" + suffix, "test-read-key");
    expect(result.statusCode).toBe(200);
    expect(result.body.items[0].lineItems[0].quantity).toBe(5.5);
  }
});
