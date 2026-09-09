// Execute the HTTP handler directly; no Firebase emulator or production connection.
export const runWith = () => ({ https: { onRequest: (handler: unknown) => handler } });
