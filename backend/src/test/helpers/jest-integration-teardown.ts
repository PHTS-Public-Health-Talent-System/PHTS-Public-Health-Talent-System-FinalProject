import { closePool } from "@/config/database.js";

afterAll(async () => {
  await closePool();

  const activeHandles = (process as any)._getActiveHandles?.() ?? [];
  for (const handle of activeHandles) {
    if (
      handle === process.stdin ||
      handle === process.stdout ||
      handle === process.stderr
    ) {
      continue;
    }
    if (typeof handle?.unref === "function") {
      handle.unref();
    }
  }
});
