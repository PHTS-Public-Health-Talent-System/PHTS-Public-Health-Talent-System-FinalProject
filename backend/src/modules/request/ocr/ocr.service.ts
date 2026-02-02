/**
 * src/modules/request/ocr/ocr.service.ts
 */
import { requestRepository } from '../repositories/request.repository.js';
import { enqueueOcrJob } from "./ocr.queue.js";
import { OcrNonRetryableError, runTyphoonOcr } from "./typhoon-ocr.client.js";
// import { RequestRepository } from '../repositories/request.repository.js'; // Instance imported above

const OCR_ENABLED = process.env.OCR_ENABLED === 'true';

export function isOcrEnabled(): boolean {
  return OCR_ENABLED;
}

export async function getOcrTextForRequest(requestId: number): Promise<string | null> {
  const attachments = await requestRepository.findAttachmentsWithOcr(requestId);

  // Simple heuristic: Join all non-null text from COMPLETED/SUCCESS OCR results
  const texts = attachments
    .filter(a => (a.ocr_status === 'COMPLETED' || a.ocr_status === 'SUCCESS') && a.raw_text)
    .map(a => a.raw_text);

  return texts.length > 0 ? texts.join('\n') : null;
}

export async function getOcrRecord(attachmentId: number) {
  return await requestRepository.findOcrResult(attachmentId);
}

export async function assertOcrAccess(attachmentId: number, userId: number) {
   // In a full implementation, query attachment -> request -> user_id to verify ownership
   // For now, allow (assuming Middleware checks Request Access)
   if (!userId || !attachmentId) return false;
   return true;
}

export async function requestOcrProcessing(_attachmentId: number, _pageNum?: number) {
  if (!OCR_ENABLED) {
    return { ocrEnabled: false, record: null };
  }

  const attachmentId = _attachmentId;
  const attachment = await requestRepository.findAttachmentById(attachmentId);
  if (!attachment) {
    return { ocrEnabled: true, record: null };
  }

  await requestRepository.upsertOcrResult({
    attachment_id: attachmentId,
    request_id: attachment.request_id,
    status: "PROCESSING",
    raw_text: null,
    confidence: 0,
    provider: "TYPHOON",
  });

  try {
    await enqueueOcrJob({ attachmentId, attempts: 0 });
  } catch (error) {
    console.error("OCR enqueue failed, running inline:", error);
    await processAttachmentOcr(attachmentId);
  }

  return {
    ocrEnabled: true,
    record: { status: "QUEUED", processed_at: new Date() },
  };
}

export async function processAttachmentOcr(attachmentId: number): Promise<void> {
   if (!OCR_ENABLED) return;

   try {
       // 1. Get Attachment to find file Path
       const attachment = await requestRepository.findAttachmentById(attachmentId);

       if (!attachment) {
         console.error(`Attachment ${attachmentId} not found for OCR.`);
         return;
       }

       const requestId = attachment.request_id;
       const filePath = attachment.file_path;

       await requestRepository.upsertOcrResult({
         attachment_id: attachmentId,
         request_id: requestId,
         status: "PROCESSING",
         raw_text: null,
         confidence: 0,
         provider: "TYPHOON",
       });

       const result = await runTyphoonOcr(filePath);
       const rawText = (result.text || "").trim();

       // 2. Save Result via Repo
       await requestRepository.upsertOcrResult({
          attachment_id: attachmentId,
          request_id: requestId,
          status: "COMPLETED",
          raw_text: rawText,
          confidence: result.confidence ?? 0,
          provider: "TYPHOON"
       });

   } catch (error) {
       console.error("OCR Processing Error:", error);
       const attachment = await requestRepository.findAttachmentById(attachmentId);
       const requestId = attachment?.request_id ?? 0;
       await requestRepository.upsertOcrResult({
         attachment_id: attachmentId,
         request_id: requestId,
         status: "FAILED",
         raw_text: null,
         confidence: 0,
         provider: "TYPHOON",
       });
       if (error instanceof OcrNonRetryableError) {
         return;
       }
       throw error;
   }
}
