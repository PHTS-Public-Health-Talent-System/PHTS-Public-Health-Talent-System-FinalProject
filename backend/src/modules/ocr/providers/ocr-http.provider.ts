import type {
  OcrBatchResponse,
  OcrBatchResultItem,
} from '@/modules/ocr/entities/ocr-precheck.entity.js';

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_RETRY_COUNT = 2;

const getOcrServiceBase = (): string => {
  const base = (process.env.OCR_SERVICE_URL || process.env.OCR_API_URL || '').trim();
  let normalized = base;
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

const getPerFileTimeoutMs = (): number => {
  const raw = Number(process.env.OCR_FILE_TIMEOUT_MS || process.env.OCR_HTTP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 1000) return DEFAULT_TIMEOUT_MS;
  return raw;
};

const getRetryCount = (): number => {
  const raw = Number(process.env.OCR_FILE_RETRY_COUNT || DEFAULT_RETRY_COUNT);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_RETRY_COUNT;
  return Math.floor(raw);
};

const parseOcrBatchResult = async (
  response: Response,
  fallbackName: string,
): Promise<OcrBatchResultItem> => {
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
  return {
    name: result.name || fallbackName,
    ok: true,
    markdown: result.markdown || '',
  };
};

const callOcrOnce = async (
  fileName: string,
  fileBuffer: Buffer,
  ocrBase: string,
  timeoutMs: number,
): Promise<OcrBatchResultItem> => {
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
    return await parseOcrBatchResult(response, fileName);
  } finally {
    clearTimeout(timeout);
  }
};

export class OcrHttpProvider {
  static getServiceBase(): string {
    return getOcrServiceBase();
  }

  static async processSingleFile(
    fileName: string,
    fileBuffer: Buffer,
    ocrBase: string,
  ): Promise<OcrBatchResultItem> {
    const timeoutMs = getPerFileTimeoutMs();
    const retryCount = getRetryCount();

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        return await callOcrOnce(fileName, fileBuffer, ocrBase, timeoutMs);
      } catch (error) {
        if (attempt === retryCount) {
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
  }
}
