import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";

type TyphoonOcrResult = {
  text: string;
  confidence?: number | null;
};

export class OcrNonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrNonRetryableError";
  }
}

const OCR_SERVICE_URL =
  process.env.OCR_SERVICE_URL || process.env.OCR_BASE_URL || "";
const OCR_ENDPOINT = process.env.OCR_ENDPOINT || "/ocr";
const OCR_API_KEY = process.env.OCR_API_KEY || "";
const OCR_API_KEY_HEADER = process.env.OCR_API_KEY_HEADER || "Authorization";
const OCR_API_KEY_PREFIX = process.env.OCR_API_KEY_PREFIX || "Bearer";
const OCR_HTTP_TIMEOUT_MS = Number(
  process.env.OCR_HTTP_TIMEOUT_MS || process.env.OCR_TIMEOUT_MS || "900000",
);

function ensureServiceUrl(): string {
  const trimmed = OCR_SERVICE_URL.replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("OCR_SERVICE_URL is missing");
  }
  return trimmed;
}

function buildMultipartBody(params: {
  fileBuffer: Buffer;
  filename: string;
  contentType: string;
}): { body: Buffer; boundary: string } {
  const boundary = `----phts-ocr-${Date.now()}`;
  const lineBreak = "\r\n";
  const parts: Buffer[] = [];

  parts.push(Buffer.from(`--${boundary}${lineBreak}`));
  parts.push(
    Buffer.from(
      `Content-Disposition: form-data; name="file"; filename="${params.filename}"${lineBreak}`,
    ),
  );
  parts.push(Buffer.from(`Content-Type: ${params.contentType}${lineBreak}${lineBreak}`));
  parts.push(params.fileBuffer);
  parts.push(Buffer.from(lineBreak));
  parts.push(Buffer.from(`--${boundary}--${lineBreak}`));

  return { body: Buffer.concat(parts), boundary };
}

export async function runTyphoonOcr(
  filePath: string,
  pageNum?: number,
): Promise<TyphoonOcrResult> {
  const baseUrl = ensureServiceUrl();
  const fileBuffer = await readFile(filePath);
  const fileType = await fileTypeFromBuffer(fileBuffer);
  const contentType = fileType?.mime ?? "application/octet-stream";
  const filename = path.basename(filePath);
  const { body, boundary } = buildMultipartBody({
    fileBuffer,
    filename,
    contentType,
  });

  const endpoint = OCR_ENDPOINT.startsWith("/")
    ? OCR_ENDPOINT
    : `/${OCR_ENDPOINT}`;
  const url = new URL(`${baseUrl}${endpoint}`);
  if (pageNum) {
    url.searchParams.set("page_num", String(pageNum));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_HTTP_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    };
    if (OCR_API_KEY) {
      headers[OCR_API_KEY_HEADER] =
        OCR_API_KEY_HEADER.toLowerCase() === "authorization"
          ? `${OCR_API_KEY_PREFIX} ${OCR_API_KEY}`.trim()
          : OCR_API_KEY;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const message = `OCR HTTP error: ${response.status} ${response.statusText}${
        errorText ? ` | ${errorText}` : ""
      }`;
      if (response.status >= 400 && response.status < 500) {
        throw new OcrNonRetryableError(message);
      }
      throw new Error(message);
    }

    const payload = (await response.json()) as any;
    let text = "";
    let confidence: number | null = null;

    if (typeof payload?.text === "string") {
      text = payload.text;
      confidence = payload.confidence ?? null;
    } else if (Array.isArray(payload?.results) && payload.results[0]) {
      const first = payload.results[0];
      const content = first?.message?.choices?.[0]?.message?.content;
      if (typeof content === "string") {
        try {
          const parsed = JSON.parse(content);
          text = String(parsed?.natural_text || "");
        } catch {
          text = content;
        }
      }
      confidence = first?.confidence ?? null;
    }

    return { text, confidence };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OCR request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
