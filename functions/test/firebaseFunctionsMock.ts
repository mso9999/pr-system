// Execute the HTTP handler directly; no Firebase emulator or production connection.
export const runWith = () => ({ https: { onRequest: (handler: unknown) => handler } });
export const https = { onRequest: (handler: unknown) => handler, onCall: (handler: unknown) => handler };
export const firestore = { document: () => ({ onWrite: (handler: unknown) => handler }) };
