import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "firebase-admin": fileURLToPath(new URL("./test/firebaseAdminMock.ts", import.meta.url)), "firebase-functions": fileURLToPath(new URL("./test/firebaseFunctionsMock.ts", import.meta.url)) } },
  test: { environment: "node", include: ["functions/src/catalog/*.test.ts", "functions/src/receipts/*.test.ts"] },
});
