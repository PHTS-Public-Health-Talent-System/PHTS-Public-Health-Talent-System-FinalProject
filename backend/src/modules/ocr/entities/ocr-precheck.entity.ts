export const OCR_QUEUE_KEY = 'request:ocr:precheck:queue';
export const OCR_WORKER_BRPOP_TIMEOUT_SEC = 5;

export type OcrQueueJob = {
  requestId: number;
  enqueuedAt: string;
};

export type OcrBatchResultItem = {
  name?: string;
  ok?: boolean;
  markdown?: string;
  error?: string;
};

export type OcrBatchResponse = {
  count?: number;
  results?: OcrBatchResultItem[];
};
