import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FileType } from '@/modules/request/contracts/request.types.js';
import {
  OCR_QUEUE_KEY,
  type OcrBatchResultItem,
  type OcrQueueJob,
} from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { OcrHttpProvider } from '@/modules/ocr/providers/ocr-http.provider.js';
import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';
import redis from '@config/redis.js';

const resolveAttachmentPath = (filePath: string): string => {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
};

export const processRequestOcrPrecheck = async (requestId: number): Promise<void> => {
  const ocrBase = OcrHttpProvider.getServiceBase();
  if (!ocrBase) {
    await OcrRequestRepository.updateRequestPrecheck(requestId, {
      status: 'skipped',
      error: 'OCR service URL is not configured',
      finished_at: new Date().toISOString(),
    });
    return;
  }

  await OcrRequestRepository.updateRequestPrecheck(requestId, {
    status: 'processing',
    started_at: new Date().toISOString(),
    service_url: ocrBase,
    worker: 'redis-list',
  });

  try {
    const attachments = await OcrRequestRepository.findAttachments(requestId);
    const candidates = attachments.filter(
      (attachment) => attachment.file_type !== FileType.SIGNATURE && Boolean(attachment.file_path),
    );

    if (!candidates.length) {
      await OcrRequestRepository.updateRequestPrecheck(requestId, {
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
      const result = await OcrHttpProvider.processSingleFile(
        attachment.file_name,
        bytes,
        ocrBase,
      );
      results.push(result);
    }

    const successCount = results.filter((item) => item.ok).length;
    const failedCount = results.length - successCount;

    await OcrRequestRepository.updateRequestPrecheck(requestId, {
      status: successCount > 0 ? 'completed' : 'failed',
      finished_at: new Date().toISOString(),
      service_url: ocrBase,
      count: results.length,
      success_count: successCount,
      failed_count: failedCount,
      results,
    });
  } catch (error) {
    await OcrRequestRepository.updateRequestPrecheck(requestId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'OCR processing failed',
      finished_at: new Date().toISOString(),
    });
  }
};

export const enqueueRequestOcrPrecheck = async (requestId: number): Promise<void> => {
  const payload: OcrQueueJob = {
    requestId,
    enqueuedAt: new Date().toISOString(),
  };
  await redis.lpush(OCR_QUEUE_KEY, JSON.stringify(payload));
};
