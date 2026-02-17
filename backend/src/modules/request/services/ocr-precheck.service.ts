import { readFile } from 'node:fs/promises';
import path from 'node:path';
import redis from '@config/redis.js';
import { getConnection } from '@config/database.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js';
import { FileType } from '@/modules/request/request.types.js';

const OCR_QUEUE_KEY = 'request:ocr:precheck:queue';
const OCR_WORKER_BRPOP_TIMEOUT_SEC = 5;

type OcrQueueJob = {
  requestId: number;
  enqueuedAt: string;
};

type OcrBatchResultItem = {
  name?: string;
  ok?: boolean;
  markdown?: string;
  error?: string;
};

type OcrBatchResponse = {
  count?: number;
  results?: OcrBatchResultItem[];
};

let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let workerRedisClient: typeof redis | null = null;

const parseSubmissionData = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'object') return { ...(value as Record<string, unknown>) };
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};

const getOcrServiceBase = (): string => {
  const base = (process.env.OCR_SERVICE_URL || process.env.OCR_API_URL || '').trim();
  return base.replace(/\/+$/, '');
};

const getPerFileTimeoutMs = (): number => {
  const raw = Number(process.env.OCR_FILE_TIMEOUT_MS || process.env.OCR_HTTP_TIMEOUT_MS || 120000);
  if (!Number.isFinite(raw) || raw < 1000) return 120000;
  return raw;
};

const getRetryCount = (): number => {
  const raw = Number(process.env.OCR_FILE_RETRY_COUNT || 2);
  if (!Number.isFinite(raw) || raw < 0) return 2;
  return Math.floor(raw);
};

const resolveAttachmentPath = (filePath: string): string => {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
};

const updateRequestOcrPrecheck = async (
  requestId: number,
  patch: Record<string, unknown>,
): Promise<void> => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const requestEntity = await requestRepository.findById(requestId, connection);
    if (!requestEntity) {
      await connection.rollback();
      return;
    }

    const submissionData = parseSubmissionData(requestEntity.submission_data);
    const previousPrecheck =
      typeof submissionData.ocr_precheck === 'object' && submissionData.ocr_precheck
        ? (submissionData.ocr_precheck as Record<string, unknown>)
        : {};

    await requestRepository.update(
      requestId,
      {
        submission_data: {
          ...submissionData,
          ocr_precheck: {
            ...previousPrecheck,
            ...patch,
          },
        },
      },
      connection,
    );
    await connection.commit();
  } catch {
    await connection.rollback();
    throw new Error('Failed to update OCR precheck');
  } finally {
    connection.release();
  }
};

const callOcrForSingleFile = async (
  fileName: string,
  fileBuffer: Buffer,
  ocrBase: string,
): Promise<OcrBatchResultItem> => {
  const timeoutMs = getPerFileTimeoutMs();
  const retryCount = getRetryCount();

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const form = new FormData();
      form.append('files', new Blob([fileBuffer]), fileName);
      const response = await fetch(`${ocrBase}/ocr-batch`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `OCR service returned ${response.status}`);
      }

      const payload = (await response.json()) as OcrBatchResponse;
      const result = payload.results?.[0];
      if (!result) {
        throw new Error('OCR response missing result item');
      }
      if (!result.ok) {
        throw new Error(result.error || 'OCR file processing failed');
      }
      clearTimeout(timeout);
      return {
        name: result.name || fileName,
        ok: true,
        markdown: result.markdown || '',
      };
    } catch (error) {
      clearTimeout(timeout);
      const isLastAttempt = attempt === retryCount;
      if (isLastAttempt) {
        return {
          name: fileName,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown OCR error',
        };
      }
    }
  }

  return {
    name: fileName,
    ok: false,
    error: 'Unexpected OCR retry flow',
  };
};

const processRequestOcrPrecheck = async (requestId: number): Promise<void> => {
  const ocrBase = getOcrServiceBase();
  if (!ocrBase) {
    await updateRequestOcrPrecheck(requestId, {
      status: 'skipped',
      error: 'OCR service URL is not configured',
      finished_at: new Date().toISOString(),
    });
    return;
  }

  await updateRequestOcrPrecheck(requestId, {
    status: 'processing',
    started_at: new Date().toISOString(),
    service_url: ocrBase,
    worker: 'redis-list',
  });

  try {
    const attachments = await requestRepository.findAttachments(requestId);
    const candidates = attachments.filter(
      (att) => att.file_type !== FileType.SIGNATURE && Boolean(att.file_path),
    );

    if (!candidates.length) {
      await updateRequestOcrPrecheck(requestId, {
        status: 'failed',
        error: 'No attachments to OCR',
        finished_at: new Date().toISOString(),
        results: [],
      });
      return;
    }

    const results: OcrBatchResultItem[] = [];
    for (const attachment of candidates) {
      const absolutePath = resolveAttachmentPath(attachment.file_path);
      const bytes = await readFile(absolutePath);
      const result = await callOcrForSingleFile(attachment.file_name, bytes, ocrBase);
      results.push(result);
    }

    const successCount = results.filter((item) => item.ok).length;
    const failedCount = results.length - successCount;

    await updateRequestOcrPrecheck(requestId, {
      status: successCount > 0 ? 'completed' : 'failed',
      finished_at: new Date().toISOString(),
      service_url: ocrBase,
      count: results.length,
      success_count: successCount,
      failed_count: failedCount,
      results,
    });
  } catch (error) {
    await updateRequestOcrPrecheck(requestId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'OCR processing failed',
      finished_at: new Date().toISOString(),
    });
  }
};

const workerLoop = async () => {
  if (!workerRedisClient) return;
  while (workerRunning) {
    try {
      const item = await workerRedisClient.brpop(OCR_QUEUE_KEY, OCR_WORKER_BRPOP_TIMEOUT_SEC);
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

export const enqueueRequestOcrPrecheck = async (requestId: number): Promise<void> => {
  const payload: OcrQueueJob = {
    requestId,
    enqueuedAt: new Date().toISOString(),
  };
  await redis.lpush(OCR_QUEUE_KEY, JSON.stringify(payload));
};

export const startOcrPrecheckWorker = () => {
  if (workerRunning) return;
  workerRedisClient = redis.duplicate();
  workerRunning = true;
  workerPromise = workerLoop();
  console.log('[OCRQueue] worker started');
};

export const stopOcrPrecheckWorker = async () => {
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
