import redis from '@config/redis.js';
import {
  OCR_QUEUE_KEY,
  OCR_WORKER_BRPOP_TIMEOUT_SEC,
  type OcrQueueJob,
} from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { processRequestOcrPrecheck } from '@/modules/ocr/services/ocr-precheck.service.js';

let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let workerRedisClient: typeof redis | null = null;

const isWorkerEnabled = (): boolean => process.env.OCR_WORKER_ENABLED !== 'false';

const workerLoop = async (): Promise<void> => {
  if (!workerRedisClient) return;

  while (workerRunning) {
    try {
      const item = await workerRedisClient.brpop(
        OCR_QUEUE_KEY,
        OCR_WORKER_BRPOP_TIMEOUT_SEC,
      );
      if (!item) continue;

      const [, rawPayload] = item;
      const job = JSON.parse(rawPayload) as OcrQueueJob;
      if (!job?.requestId || !Number.isFinite(job.requestId)) continue;

      await processRequestOcrPrecheck(Number(job.requestId));
    } catch (error) {
      console.error('[OCRQueue] worker error:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

export const startOcrPrecheckWorker = (): void => {
  if (!isWorkerEnabled()) {
    console.log('[OCRQueue] worker disabled by OCR_WORKER_ENABLED=false');
    return;
  }
  if (workerRunning) return;
  workerRedisClient = redis.duplicate();
  workerRunning = true;
  workerPromise = workerLoop();
  console.log('[OCRQueue] worker started');
};

export const stopOcrPrecheckWorker = async (): Promise<void> => {
  workerRunning = false;
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  if (workerRedisClient) {
    await workerRedisClient.quit().catch(() => workerRedisClient?.disconnect());
    workerRedisClient = null;
  }
  console.log('[OCRQueue] worker stopped');
};

export const getOcrWorkerEnabled = (): boolean => isWorkerEnabled();
