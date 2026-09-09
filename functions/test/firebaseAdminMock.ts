import { vi } from "vitest";

export const mock = {
  collection: vi.fn(), orderBy: vi.fn(), startAfter: vi.fn(), limit: vi.fn(), get: vi.fn(),
};
export const firestore = Object.assign(() => ({ collection: mock.collection }), {
  FieldPath: { documentId: () => "__name__" },
});
