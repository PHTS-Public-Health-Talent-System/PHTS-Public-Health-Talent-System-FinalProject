import { processSnapshotOutboxBatch } from "@/modules/snapshot/services/snapshot.service.js";

const DEFAULT_POLL_MS = 5000;
const DEFAULT_BATCH_LIMIT = 20;

let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let wakeWorker: (() => void) | null = null;

const getPollMs = (): number => {
  const fromEnv = Number(process.env.SNAPSHOT_WORKER_POLL_MS ?? DEFAULT_POLL_MS);
  if (!Number.isFinite(fromEnv) || fromEnv < 250) return DEFAULT_POLL_MS;
  return Math.floor(fromEnv);
};

const getBatchLimit = (): number => {
  const fromEnv = Number(
    process.env.SNAPSHOT_WORKER_BATCH_LIMIT ?? DEFAULT_BATCH_LIMIT,
  );
  if (!Number.isFinite(fromEnv) || fromEnv < 1) return DEFAULT_BATCH_LIMIT;
  return Math.min(200, Math.floor(fromEnv));
};

const waitForNextTick = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (wakeWorker === wake) wakeWorker = null;
      resolve();
    }, ms);
    const wake = () => {
      clearTimeout(timer);
      if (wakeWorker === wake) wakeWorker = null;
      resolve();
    };
    wakeWorker = wake;
  });

const workerLoop = async (): Promise<void> => {
  const pollMs = getPollMs();
  const batchLimit = getBatchLimit();
  while (workerRunning) {
    try {
      const result = await processSnapshotOutboxBatch(batchLimit);
      if (result.processed > 0) {
        console.log(
          `[SnapshotQueue] processed=${result.processed} sent=${result.sent} failed=${result.failed}`,
        );
      }
    } catch (error) {
      console.error("[SnapshotQueue] worker error:", error);
    }

    if (!workerRunning) break;
    await waitForNextTick(pollMs);
  }
};

export const startSnapshotWorker = (): void => {
  if (process.env.SNAPSHOT_WORKER_ENABLED === "false") {
    console.log("[SnapshotQueue] worker disabled by SNAPSHOT_WORKER_ENABLED=false");
    return;
  }
  if (workerRunning) return;
  workerRunning = true;
  workerPromise = workerLoop();
  console.log("[SnapshotQueue] worker started");
};

export const stopSnapshotWorker = async (): Promise<void> => {
  workerRunning = false;
  if (wakeWorker) wakeWorker();
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  console.log("[SnapshotQueue] worker stopped");
};

