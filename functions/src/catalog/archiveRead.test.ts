import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mock } from "../../test/firebaseAdminMock";
let archivePageQuery: typeof import("./archiveRead").archivePageQuery;
let projectArchive: typeof import("./archiveRead").projectArchive;
let listArchivedPurchaseRequests: typeof import("./archiveRead").listArchivedPurchaseRequests;
beforeAll(async () => { ({ archivePageQuery, projectArchive, listArchivedPurchaseRequests } = await import("./archiveRead")); });

beforeEach(() => {
  mock.collection.mockReturnValue({ orderBy: mock.orderBy });
  const ref = { startAfter: mock.startAfter, limit: mock.limit };
  mock.orderBy.mockReturnValue(ref);
  mock.startAfter.mockReturnValue(ref);
  mock.limit.mockReturnValue({ get: mock.get });
});
it("exposes only allowed legacy evidence without inferring organization IDs, dates or completion", () => {
  const row = projectArchive("old", { description: "poles", submittedDate: "03/04/2020", organization: "1PWR LESOTHO",
    site: "Mashai", originalData: { password: "secret" }, requestorEmail: "private", attachments: ["signed-secret-url"] });
  expect(row).toMatchObject({ id: "old", submittedDate: "03/04/2020", site: "Mashai", status: null,
    sourceCollection: "archivePRs", receiptEvidenceStatus: "not_connected", lineItemsStatus: "missing", attachmentCount: 1 });
  expect(row).not.toHaveProperty("organizationId");
  expect(JSON.stringify(row)).not.toMatch(/secret|private|originalData/);
});
it.each([{ limit: "0" }, { limit: "501" }, { limit: "1.5" }, { limit: [] }, { cursor: "broken" },
  { cursor: Buffer.from(JSON.stringify({ source: "purchaseRequests", id: "x" })).toString("base64url") },
  { organization: "smp" }])("rejects invalid/unsupported query %s", query => expect(() => archivePageQuery(query)).toThrow());
it("uses bounded document-ID paging and returns page count, never live collection data", async () => {
  mock.get.mockResolvedValue({ docs: ["a", "b", "c"].map(id => ({ id, data: () => ({ description: "wire" }) })) });
  const page = await listArchivedPurchaseRequests({ limit: "2" });
  expect(mock.collection).toHaveBeenCalledWith("archivePRs");
  expect(mock.orderBy).toHaveBeenCalledWith("__name__");
  expect(mock.limit).toHaveBeenCalledWith(3);
  expect(page.count).toBe(2);
  expect(page.items.map(row => row.id)).toEqual(["a", "b"]);
  expect(archivePageQuery({ cursor: page.nextCursor }).afterId).toBe("b");
  mock.get.mockResolvedValue({ docs: [{ id: "c", data: () => ({}) }] });
  const last = await listArchivedPurchaseRequests({ limit: "2", cursor: page.nextCursor });
  expect(mock.startAfter).toHaveBeenCalledWith("b");
  expect(last.count).toBe(1);
  expect(last.nextCursor).toBeNull();
});
