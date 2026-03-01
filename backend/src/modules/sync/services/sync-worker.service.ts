import { SyncService } from '@/modules/sync/services/sync.service.js';

const DEFAULT_POLL_MS = 30000;

let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let wakeWorker: (() => void) | null = null;

const getPollMs = (): number => {
  const fromEnv = Number(process.env.SYNC_WORKER_POLL_MS ?? DEFAULT_POLL_MS);
  if (!Number.isFinite(fromEnv) || fromEnv < 1000) return DEFAULT_POLL_MS;
  return Math.floor(fromEnv);
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
  while (workerRunning) {
    try {
      const startedAt = Date.now();
      const result = await SyncService.performScheduledFullSync({ triggeredBy: null });
      if (result) {
        console.log(
          `[SyncWorker] auto sync done duration_ms=${Date.now() - startedAt} batch_id=${result.batch_id}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already in progress')) {
        console.warn('[SyncWorker] auto sync skipped: sync already in progress');
      } else {
        console.error('[SyncWorker] auto sync failed:', message);
      }
    }

    if (!workerRunning) break;
    await waitForNextTick(pollMs);
  }
};

export const startSyncWorker = (): void => {
  if (process.env.SYNC_WORKER_ENABLED === 'false') {
    console.log('[SyncWorker] disabled by SYNC_WORKER_ENABLED=false');
    return;
  }
  if (workerRunning) return;
  workerRunning = true;
  workerPromise = workerLoop();
  console.log('[SyncWorker] started');
};

export const stopSyncWorker = async (): Promise<void> => {
  workerRunning = false;
  if (wakeWorker) wakeWorker();
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  console.log('[SyncWorker] stopped');
};
