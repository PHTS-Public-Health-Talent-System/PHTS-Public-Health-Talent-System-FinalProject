/**
 * src/modules/request/services/command.service.ts
 */

import { getConnection } from '@config/database.js';
import { readFile, unlink } from 'node:fs/promises';
import { PoolConnection } from 'mysql2/promise';
import {
  RequestStatus,
  ActionType,
  FileType,
  PTSRequest,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  RequestWithDetails,
} from '@/modules/request/contracts/request.types.js';
import { CreateRequestDTO, UpdateRequestDTO } from '@/modules/request/dto/index.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import {
  generateRequestNoFromId,
  normalizeDateToYMD,
  mapRequestRow,
  getRequestLinkForRole,
  parseJsonField,
} from '@/modules/request/services/helpers.js';
import { requestQueryService } from '@/modules/request/read/services/query.service.js'; // Use the class instance
import { enqueueRequestOcrPrecheck } from '@/modules/ocr/services/ocr-precheck.service.js';
import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';
import { OcrHttpProvider } from '@/modules/ocr/providers/ocr-http.provider.js';
import type { OcrBatchResultItem } from '@/modules/ocr/entities/ocr-precheck.entity.js';
import {
  mergeOcrResultsByFileName,
  runStoredFileOcrBatch,
} from '@/modules/ocr/services/ocr-batch-runner.service.js';
import {
  getExistingOcrResults,
  saveOcrPrecheck,
} from '@/modules/ocr/services/ocr-precheck-store.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js'; // [NEW]
import { resolveProfessionCode } from '@shared/utils/profession.js';
import {
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@shared/utils/errors.js';
import path from 'node:path';
import { getActiveHeadScopeRoles } from '@/modules/request/scope/application/scope.service.js';

const toArabicDigits = (value: string): string =>
  value.replace(/[๐-๙]/g, (char) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(char)));

const isAssignmentOrderCandidate = (item: OcrBatchResultItem): boolean => {
  const kind = String(item.document_kind ?? "").trim().toLowerCase();
  if (kind === "assignment_order") return true;
  const normalized = toArabicDigits(String(item.markdown ?? ""));
  return (
    /(?:คำสั่ง|คําสั่ง).*(?:มอบหมาย|รับผิดชอบ|ปฏิบัติงาน)/.test(normalized) ||
    /(?:ที่|ที)\s*[0-9]{1,4}\s*\/\s*[0-9]{1,5}/.test(normalized)
  );
};

const hasSuspiciousOrderNo = (markdown?: string): boolean => {
  const normalized = toArabicDigits(String(markdown ?? ''));
  return /(?:ที่|ที)\s*[0-9]{1,4}\s*\/\s*[0-9]{5,}/.test(normalized);
};

const hasSuspiciousAssignmentDates = (markdown?: string): boolean => {
  const normalized = toArabicDigits(String(markdown ?? ""));
  const signedYear = normalized.match(/(?:สั่ง\s*ณ\s*วันที่|สง\s*ณ\s*วันที่)[\s\S]{0,80}(25[0-9]{2})/);
  const effectiveYear = normalized.match(/(?:ตั้งแต่วันที่|ต้งแต่วันที่)[\s\S]{0,80}(25[0-9]{2})/);
  const signed = signedYear?.[1] ? Number(signedYear[1]) : null;
  const effective = effectiveYear?.[1] ? Number(effectiveYear[1]) : null;
  if (signed && signed < 2550) return true;
  if (effective && effective < 2550) return true;
  if (signed && effective && Math.abs(signed - effective) >= 3) return true;
  return false;
};

const shouldEnhanceWithPaddle = (item: OcrBatchResultItem): boolean =>
  isAssignmentOrderCandidate(item) &&
  item.ok === true &&
  item.suppressed !== true &&
  (item.quality?.passed === false ||
    ((item.engine_used ?? '').toLowerCase().includes('tesseract') &&
      (/(พ\.ศ\.\s*(?:25[0-3]\d|๒๕[๐-๓][๐-๙]))/.test(String(item.markdown ?? '')) ||
        hasSuspiciousOrderNo(item.markdown) ||
        hasSuspiciousAssignmentDates(item.markdown))));

const hasEnhanceCandidates = (results: OcrBatchResultItem[]): boolean =>
  results.some((item) => shouldEnhanceWithPaddle(item));

const enhanceSuspiciousResultsWithPaddle = async (
  baseResults: OcrBatchResultItem[],
  files: Array<{ file_name: string; file_path: string }>,
  ocrBase: string,
): Promise<OcrBatchResultItem[]> => {
  const paddleBase = OcrHttpProvider.getPaddleServiceBase();
  if (!paddleBase || paddleBase === ocrBase) return baseResults;

  const filePathByName = new Map<string, string>();
  for (const file of files) {
    const key = String(file.file_name ?? '').trim().toLowerCase();
    if (!key) continue;
    filePathByName.set(key, file.file_path);
  }

  const filesToEnhance = baseResults
    .filter(shouldEnhanceWithPaddle)
    .map((item) => {
      const fileName = String(item.name ?? '').trim();
      const filePath = filePathByName.get(fileName.toLowerCase());
      if (!fileName || !filePath) return null;
      return { file_name: fileName, file_path: filePath };
    })
    .filter((item): item is { file_name: string; file_path: string } => Boolean(item));

  if (filesToEnhance.length === 0) return baseResults;

  try {
    const enhanced = await runStoredFileOcrBatch(filesToEnhance, paddleBase, {
      disableFallbackChain: true,
    });
    return mergeOcrResultsByFileName(baseResults, enhanced.results);
  } catch (error) {
    console.error('[OCR Manual] paddle enhancement failed:', error);
    return baseResults;
  }
};

export class RequestCommandService {
  private legacyOfficerCreatorCache = new Map<number, number | null>();
  private static readonly REQUEST_NO_MAX_RETRIES = 10;

  private async enhanceOcrResultsInBackground(params: {
    kind: 'request' | 'eligibility';
    id: number;
    ocrBase: string;
    serviceUrl: string;
    files: Array<{ file_name: string; file_path: string }>;
    baseResults: OcrBatchResultItem[];
  }): Promise<void> {
    try {
      if (!hasEnhanceCandidates(params.baseResults)) return;

      const enhancedResults = await enhanceSuspiciousResultsWithPaddle(
        params.baseResults,
        params.files,
        params.ocrBase,
      );

      const currentResults = await getExistingOcrResults({ kind: params.kind, id: params.id });
      const mergedResults = mergeOcrResultsByFileName(currentResults, enhancedResults);
      const successCount = mergedResults.filter((item) => item.ok).length;
      const failedCount = mergedResults.length - successCount;

      await saveOcrPrecheck({ kind: params.kind, id: params.id }, {
        status: successCount > 0 ? "completed" : "failed",
        source: "MANUAL_VERIFY",
        service_url: params.serviceUrl,
        worker: "server-manual-async",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        count: mergedResults.length,
        success_count: successCount,
        failed_count: failedCount,
        error: null,
        results: mergedResults,
      });
    } catch (error) {
      console.error('[OCR Manual] async paddle enhancement failed:', error);
    }
  }

  private async generateUniqueRequestNo(
    requestId: number,
    connection: PoolConnection,
  ): Promise<string> {
    for (let attempt = 0; attempt < RequestCommandService.REQUEST_NO_MAX_RETRIES; attempt += 1) {
      const candidate = generateRequestNoFromId(requestId);
      const exists = await requestRepository.existsByRequestNo(candidate, connection);
      if (!exists) {
        return candidate;
      }
    }
    throw new ConflictError('ไม่สามารถสร้างเลขคำขอใหม่ได้ กรุณาลองอีกครั้ง');
  }

  private containsThai(text: string): boolean {
    return /[\u0E00-\u0E7F]/.test(text);
  }

  private normalizeFilename(name: string): string {
    if (!name) return name;
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    const originalHasThai = this.containsThai(name);
    const decodedHasThai = this.containsThai(decoded);
    const normalizedBase =
      !originalHasThai && decodedHasThai
        ? decoded
        : name.includes("\uFFFD") && decodedHasThai
          ? decoded
          : name;

    const wrappedPattern = /^\d+_\d+_(.+_[a-f0-9]{8}\.[^.]+)$/i;
    const wrappedMatch = normalizedBase.match(wrappedPattern);
    if (wrappedMatch !== null) {
      const innerName = wrappedMatch[1];
      if (innerName && innerName !== normalizedBase) {
        return innerName;
      }
    }
    return normalizedBase;
  }

  private findSourceRequestDisplayName(
    fileName: string,
    requestAttachments: Array<{ file_name?: string | null; file_path?: string | null }>,
  ): string | null {
    const match = fileName.match(/_([a-f0-9]{8})(\.[^.]+)$/i);
    if (!match) return null;
    const [, hash, ext] = match;
    const normalizedExt = ext.toLowerCase();

    const matchedAttachment = requestAttachments.find((attachment) => {
      const filePath = attachment.file_path ? path.basename(attachment.file_path) : "";
      const filePathMatch = filePath.match(/_([a-f0-9]{8})(\.[^.]+)$/i);
      if (!filePathMatch) return false;
      return (
        filePathMatch[1].toLowerCase() === hash.toLowerCase() &&
        filePathMatch[2].toLowerCase() === normalizedExt
      );
    });

    const displayName = matchedAttachment?.file_name?.trim();
    return displayName ? displayName : null;
  }

  private inferAttachmentType(fieldName: string, fileName: string): FileType {
    if (fieldName === 'license_file') return FileType.LICENSE;
    if (fieldName === 'applicant_signature') return FileType.SIGNATURE;

    const lower = fileName.toLowerCase();
    const looksLikeLicense =
      lower.includes('license') ||
      lower.includes('licence') ||
      lower.includes('ใบอนุญาต') ||
      lower.includes('ใบประกอบ') ||
      lower.includes('ประกอบวิชาชีพ');
    if (looksLikeLicense) return FileType.LICENSE;

    return FileType.OTHER;
  }

  private parseSubmissionData(value: unknown): Record<string, unknown> {
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
  }

  async persistManualOcrPrecheck(
    requestId: number,
    _userId: number,
    userRole: string,
    payload: {
      service_url?: string;
      worker?: string;
      count?: number;
      success_count?: number;
      failed_count?: number;
      error?: string | null;
      results?: Array<{
        name?: string;
        ok?: boolean;
        markdown?: string;
        error?: string;
      }>;
    },
  ): Promise<{ saved: true }> {
    if (userRole !== "PTS_OFFICER") {
      throw new AuthorizationError("ไม่มีสิทธิ์บันทึกผล OCR");
    }

    const requestRow = await requestRepository.findById(requestId);
    if (!requestRow) {
      throw new NotFoundError("Request not found");
    }

    await saveOcrPrecheck({ kind: 'request', id: requestId }, {
      status:
        Number(payload.success_count ?? 0) > 0
          ? "completed"
          : Number(payload.failed_count ?? 0) > 0 || payload.error
            ? "failed"
            : "completed",
      source: "MANUAL_VERIFY",
      service_url: payload.service_url ?? null,
      worker: payload.worker ?? "browser-manual",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: Number(payload.count ?? payload.results?.length ?? 0),
      success_count: Number(payload.success_count ?? 0),
      failed_count: Number(payload.failed_count ?? 0),
      error: payload.error ?? null,
      results: payload.results ?? [],
    });

    return { saved: true };
  }

  async runRequestAttachmentsOcr(
    requestId: number,
    _userId: number,
    userRole: string,
    payload: {
      attachments: Array<{
        attachment_id: number;
      }>;
    },
  ): Promise<{
    saved: true;
    count: number;
    success_count: number;
    failed_count: number;
    results: OcrBatchResultItem[];
  }> {
    if (userRole !== "PTS_OFFICER") {
      throw new AuthorizationError("ไม่มีสิทธิ์ตรวจ OCR");
    }

    const requestRow = await requestRepository.findById(requestId);
    if (!requestRow) {
      throw new NotFoundError("Request not found");
    }

    const ocrBase = OcrHttpProvider.getServiceBase();
    if (!ocrBase) {
      throw new ValidationError("ยังไม่ได้ตั้งค่า OCR service");
    }

    const attachmentsToRun: Array<{ file_name: string; file_path: string }> = [];
    for (const item of payload.attachments) {
      const attachment = await requestRepository.findAttachmentById(item.attachment_id);
      if (!attachment || Number(attachment.request_id) !== requestId) {
        throw new ValidationError("ไฟล์แนบนี้ไม่ได้อยู่ในคำขอนี้");
      }
      attachmentsToRun.push({
        file_name: attachment.file_name,
        file_path: attachment.file_path,
      });
    }

    const batchSummary = await runStoredFileOcrBatch(attachmentsToRun, ocrBase, {
      disableFallbackChain: true,
    });
    const existingResults = await getExistingOcrResults({ kind: 'request', id: requestId });
    const mergedResults = mergeOcrResultsByFileName(existingResults, batchSummary.results);
    const successCount = mergedResults.filter((item) => item.ok).length;
    const failedCount = mergedResults.length - successCount;

    await saveOcrPrecheck({ kind: 'request', id: requestId }, {
      status: successCount > 0 ? "completed" : "failed",
      source: "MANUAL_VERIFY",
      service_url: batchSummary.service_url,
      worker: "server-manual",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: mergedResults.length,
      success_count: successCount,
      failed_count: failedCount,
      error: null,
      results: mergedResults,
    });

    void this.enhanceOcrResultsInBackground({
      kind: 'request',
      id: requestId,
      ocrBase,
      serviceUrl: batchSummary.service_url,
      files: attachmentsToRun,
      baseResults: batchSummary.results,
    });

    return {
      saved: true,
      count: mergedResults.length,
      success_count: successCount,
      failed_count: failedCount,
      results: mergedResults,
    };
  }

  async clearRequestAttachmentOcr(
    requestId: number,
    _userId: number,
    userRole: string,
    fileName: string,
  ): Promise<{
    saved: true;
    count: number;
    success_count: number;
    failed_count: number;
  }> {
    if (userRole !== "PTS_OFFICER") {
      throw new AuthorizationError("ไม่มีสิทธิ์ล้างผล OCR");
    }

    const requestRow = await requestRepository.findById(requestId);
    if (!requestRow) {
      throw new NotFoundError("Request not found");
    }

    const normalizedFileName = String(fileName ?? "").trim().toLowerCase();
    if (!normalizedFileName) {
      throw new ValidationError("ต้องระบุชื่อไฟล์");
    }

    const existingResults = await getExistingOcrResults({ kind: 'request', id: requestId });
    const filteredResults = existingResults.filter(
      (item) => String(item?.name ?? "").trim().toLowerCase() !== normalizedFileName,
    );
    const nextResults = [
      ...filteredResults,
      {
        name: fileName.trim(),
        suppressed: true,
      } as OcrBatchResultItem,
    ];

    const activeResults = nextResults.filter((item) => !(item as any)?.suppressed);
    const successCount = activeResults.filter((item) => item.ok).length;
    const failedCount = activeResults.length - successCount;

    await saveOcrPrecheck({ kind: 'request', id: requestId }, {
      status: activeResults.length === 0 ? "queued" : successCount > 0 ? "completed" : "failed",
      source: "MANUAL_VERIFY",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: activeResults.length,
      success_count: successCount,
      failed_count: failedCount,
      error: null,
      results: nextResults,
    });

    return {
      saved: true,
      count: activeResults.length,
      success_count: successCount,
      failed_count: failedCount,
    };
  }

  async persistEligibilityManualOcrPrecheck(
    eligibilityId: number,
    _userId: number,
    userRole: string,
    payload: {
      service_url?: string;
      worker?: string;
      count?: number;
      success_count?: number;
      failed_count?: number;
      error?: string | null;
      results?: Array<{
        name?: string;
        ok?: boolean;
        markdown?: string;
        error?: string;
      }>;
    },
  ): Promise<{ saved: true }> {
    if (userRole !== "PTS_OFFICER") {
      throw new AuthorizationError("ไม่มีสิทธิ์บันทึกผล OCR");
    }

    const eligibilityRow = await requestRepository.findEligibilityById(eligibilityId);
    if (!eligibilityRow) {
      throw new NotFoundError("Eligibility not found");
    }

    await saveOcrPrecheck({ kind: 'eligibility', id: eligibilityId }, {
      status:
        Number(payload.success_count ?? 0) > 0
          ? "completed"
          : Number(payload.failed_count ?? 0) > 0 || payload.error
            ? "failed"
            : "completed",
      source: "MANUAL_VERIFY",
      service_url: payload.service_url ?? null,
      worker: payload.worker ?? "browser-manual",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: Number(payload.count ?? payload.results?.length ?? 0),
      success_count: Number(payload.success_count ?? 0),
      failed_count: Number(payload.failed_count ?? 0),
      error: payload.error ?? null,
      results: payload.results ?? [],
    });

    return { saved: true };
  }

  async runEligibilityAttachmentsOcr(
    eligibilityId: number,
    _userId: number,
    userRole: string,
    payload: {
      attachments: Array<{
        attachment_id: number;
        source: 'eligibility' | 'request';
      }>;
    },
  ): Promise<{
    saved: true;
    count: number;
    success_count: number;
    failed_count: number;
    results: OcrBatchResultItem[];
  }> {
    if (userRole !== "PTS_OFFICER") {
      throw new AuthorizationError("ไม่มีสิทธิ์ตรวจ OCR");
    }

    const eligibilityRow = await requestRepository.findEligibilityById(eligibilityId);
    if (!eligibilityRow) {
      throw new NotFoundError("Eligibility not found");
    }

    const ocrBase = OcrHttpProvider.getServiceBase();
    if (!ocrBase) {
      throw new ValidationError("ยังไม่ได้ตั้งค่า OCR service");
    }

    const attachmentsToRun: Array<{ file_name: string; file_path: string }> = [];
    for (const item of payload.attachments) {
      if (item.source === 'eligibility') {
        const attachment = await requestRepository.findEligibilityAttachmentById(item.attachment_id);
        if (!attachment || Number(attachment.eligibility_id) !== eligibilityId) {
          throw new ValidationError("ไฟล์แนบนี้ไม่ได้อยู่ในรายการสิทธินี้");
        }
        attachmentsToRun.push({
          file_name: attachment.file_name,
          file_path: attachment.file_path,
        });
        continue;
      }

      const linkedRequestId = Number((eligibilityRow as any).request_id ?? 0) || null;
      if (!linkedRequestId) {
        throw new ValidationError("รายการสิทธินี้ไม่มีคำขอต้นทาง");
      }
      const attachment = await requestRepository.findAttachmentById(item.attachment_id);
      if (!attachment || Number(attachment.request_id) !== linkedRequestId) {
        throw new ValidationError("ไฟล์แนบนี้ไม่ได้อยู่ในคำขอต้นทางของรายการสิทธินี้");
      }
      attachmentsToRun.push({
        file_name: attachment.file_name,
        file_path: attachment.file_path,
      });
    }

    const batchSummary = await runStoredFileOcrBatch(attachmentsToRun, ocrBase, {
      disableFallbackChain: true,
    });
    const existingResults = await getExistingOcrResults({ kind: 'eligibility', id: eligibilityId });
    const mergedResults = mergeOcrResultsByFileName(existingResults, batchSummary.results);
    const successCount = mergedResults.filter((item) => item.ok).length;
    const failedCount = mergedResults.length - successCount;

    await saveOcrPrecheck({ kind: 'eligibility', id: eligibilityId }, {
      status: successCount > 0 ? "completed" : "failed",
      source: "MANUAL_VERIFY",
      service_url: batchSummary.service_url,
      worker: "server-manual",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: mergedResults.length,
      success_count: successCount,
      failed_count: failedCount,
      error: null,
      results: mergedResults,
    });

    void this.enhanceOcrResultsInBackground({
      kind: 'eligibility',
      id: eligibilityId,
      ocrBase,
      serviceUrl: batchSummary.service_url,
      files: attachmentsToRun,
      baseResults: batchSummary.results,
    });

    return {
      saved: true,
      count: mergedResults.length,
      success_count: successCount,
      failed_count: failedCount,
      results: mergedResults,
    };
  }

  async clearEligibilityAttachmentOcr(
    eligibilityId: number,
    _userId: number,
    userRole: string,
    fileName: string,
  ): Promise<{
    saved: true;
    count: number;
    success_count: number;
    failed_count: number;
  }> {
    if (userRole !== "PTS_OFFICER") {
      throw new AuthorizationError("ไม่มีสิทธิ์ล้างผล OCR");
    }

    const eligibilityRow = await requestRepository.findEligibilityById(eligibilityId);
    if (!eligibilityRow) {
      throw new NotFoundError("Eligibility not found");
    }

    const normalizedFileName = String(fileName ?? "").trim().toLowerCase();
    if (!normalizedFileName) {
      throw new ValidationError("ต้องระบุชื่อไฟล์");
    }

    const existingResults = await getExistingOcrResults({ kind: 'eligibility', id: eligibilityId });
    const filteredResults = existingResults.filter(
      (item) => String(item?.name ?? "").trim().toLowerCase() !== normalizedFileName,
    );
    const nextResults = [
      ...filteredResults,
      {
        name: fileName.trim(),
        suppressed: true,
      } as OcrBatchResultItem,
    ];

    const activeResults = nextResults.filter((item) => !(item as any)?.suppressed);
    const successCount = activeResults.filter((item) => item.ok).length;
    const failedCount = activeResults.length - successCount;

    await saveOcrPrecheck({ kind: 'eligibility', id: eligibilityId }, {
      status: activeResults.length === 0 ? "queued" : successCount > 0 ? "completed" : "failed",
      source: "MANUAL_VERIFY",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: activeResults.length,
      success_count: successCount,
      failed_count: failedCount,
      error: null,
      results: nextResults,
    });

    return {
      saved: true,
      count: activeResults.length,
      success_count: successCount,
      failed_count: failedCount,
    };
  }

  private async removeEligibilityAttachmentOcrResultByFileName(
    eligibilityId: number,
    fileName: string,
  ): Promise<void> {
    const normalizedFileName = String(fileName ?? "").trim().toLowerCase();
    if (!normalizedFileName) return;

    const existingResults = await getExistingOcrResults({ kind: 'eligibility', id: eligibilityId });
    const nextResults = existingResults.filter(
      (item) => String(item?.name ?? "").trim().toLowerCase() !== normalizedFileName,
    );

    if (nextResults.length === existingResults.length) {
      return;
    }

    const activeResults = nextResults.filter((item) => !(item as any)?.suppressed);
    const successCount = activeResults.filter((item) => item.ok).length;
    const failedCount = activeResults.length - successCount;

    await saveOcrPrecheck({ kind: 'eligibility', id: eligibilityId }, {
      status: activeResults.length === 0 ? "queued" : successCount > 0 ? "completed" : "failed",
      source: "MANUAL_VERIFY",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: activeResults.length,
      success_count: successCount,
      failed_count: failedCount,
      error: null,
      results: nextResults,
    });
  }

  private async removeRequestAttachmentOcrResultByFileName(
    requestId: number,
    fileName: string,
  ): Promise<void> {
    const normalizedFileName = String(fileName ?? "").trim().toLowerCase();
    if (!normalizedFileName) return;

    const existingResults = await getExistingOcrResults({ kind: 'request', id: requestId });
    const nextResults = existingResults.filter(
      (item) => String(item?.name ?? "").trim().toLowerCase() !== normalizedFileName,
    );

    if (nextResults.length === existingResults.length) {
      return;
    }

    const activeResults = nextResults.filter((item) => !(item as any)?.suppressed);
    const successCount = activeResults.filter((item) => item.ok).length;
    const failedCount = activeResults.length - successCount;

    await saveOcrPrecheck({ kind: 'request', id: requestId }, {
      status: activeResults.length === 0 ? "queued" : successCount > 0 ? "completed" : "failed",
      source: "MANUAL_VERIFY",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      count: activeResults.length,
      success_count: successCount,
      failed_count: failedCount,
      error: null,
      results: nextResults,
    });
  }

  async removeRequestAttachment(
    requestId: number,
    attachmentId: number,
    userId: number,
    userRole: string,
  ): Promise<RequestWithDetails> {
    const requestEntity = await requestRepository.findById(requestId);
    if (!requestEntity) {
      throw new NotFoundError("ไม่พบคำขอ");
    }

    const officerCreatorId =
      userRole === 'PTS_OFFICER'
        ? await this.getOfficerCreatorIdWithFallback(requestEntity)
        : null;
    const isOwner = requestEntity.user_id === userId;
    const isOfficerCreator = officerCreatorId === userId;

    if (!isOwner && !isOfficerCreator) {
      throw new AuthorizationError("คุณไม่มีสิทธิ์ลบไฟล์แนบของคำขอนี้");
    }
    if (
      requestEntity.status !== RequestStatus.DRAFT &&
      requestEntity.status !== RequestStatus.RETURNED
    ) {
      throw new ValidationError("สามารถลบไฟล์แนบได้เฉพาะคำขอสถานะ DRAFT หรือ RETURNED");
    }

    const attachment = await requestRepository.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new NotFoundError("ไม่พบไฟล์แนบ");
    }
    if (Number(attachment.request_id) !== requestId) {
      throw new ValidationError("ไฟล์แนบนี้ไม่ได้อยู่ในคำขอนี้");
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      await requestRepository.deleteAttachmentById(attachmentId, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (attachment.file_path) {
      const absolutePath = path.isAbsolute(attachment.file_path)
        ? attachment.file_path
        : path.join(process.cwd(), attachment.file_path);
      await unlink(absolutePath).catch(() => undefined);
    }

    await this.removeRequestAttachmentOcrResultByFileName(
      requestId,
      String(attachment.file_name ?? ""),
    );

    await emitAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: "request_attachment",
      entityId: requestId,
      actorId: userId,
      actionDetail: {
        request_id: requestId,
        removed_attachment_id: attachmentId,
        removed_file_name: attachment.file_name,
      },
    });

    return requestQueryService.getRequestDetails(requestId);
  }

  private getOfficerCreatorId(
    requestEntity: Awaited<ReturnType<typeof requestRepository.findById>>,
  ): number | null {
    if (!requestEntity) return null;
    const submissionData = this.parseSubmissionData(requestEntity.submission_data);
    const createdByOfficerId = Number(submissionData.created_by_officer_id ?? 0);
    return Number.isInteger(createdByOfficerId) && createdByOfficerId > 0
      ? createdByOfficerId
      : null;
  }

  private async getOfficerCreatorIdWithFallback(
    requestEntity: Awaited<ReturnType<typeof requestRepository.findById>>,
  ): Promise<number | null> {
    const direct = this.getOfficerCreatorId(requestEntity);
    if (direct !== null || !requestEntity?.request_id) return direct;

    if (this.legacyOfficerCreatorCache.has(requestEntity.request_id)) {
      return this.legacyOfficerCreatorCache.get(requestEntity.request_id) ?? null;
    }

    const auditMeta = await requestRepository.findRequestCreateAuditMeta(requestEntity.request_id);
    const actorRole =
      typeof auditMeta?.actor_role === 'string' ? auditMeta.actor_role.trim() : null;
    const actorId = Number(auditMeta?.actor_id ?? 0);
    const fallbackId =
      actorRole === 'PTS_OFFICER' && Number.isInteger(actorId) && actorId > 0
        ? actorId
        : null;

    this.legacyOfficerCreatorCache.set(requestEntity.request_id, fallbackId);
    return fallbackId;
  }

  private async ensureRequestCanBeSubmitted(
    requestEntity: Awaited<ReturnType<typeof requestRepository.findById>>,
    userId: number,
    userRole: string,
  ): Promise<NonNullable<Awaited<ReturnType<typeof requestRepository.findById>>>> {
    if (!requestEntity) {
      throw new Error("Request not found");
    }
    const officerCreatorId =
      userRole === 'PTS_OFFICER' ? await this.getOfficerCreatorIdWithFallback(requestEntity) : null;
    const isOfficerCreator = officerCreatorId === userId;
    if (requestEntity.user_id !== userId && !isOfficerCreator) {
      throw new Error("You do not have permission to submit this request");
    }
    if (requestEntity.status !== RequestStatus.DRAFT) {
      throw new Error(`Cannot submit request with status: ${requestEntity.status}`);
    }
    if (!requestEntity.requested_amount || requestEntity.requested_amount <= 0) {
      throw new Error("requested_amount is required before submit");
    }
    return requestEntity;
  }

  private resolveSubmitStep(
    stepRaw: number | null | undefined,
    userRole: string,
    activeHeadRoles: Array<"WARD_SCOPE" | "DEPT_SCOPE"> = [],
  ): {
    stepNo: number;
    nextStep: number;
  } {
    const stepNo = stepRaw && stepRaw > 0 ? stepRaw : 1;
    let nextStep = stepNo;
    const effectiveSubmitRole =
      userRole === "HEAD_SCOPE"
        ? (activeHeadRoles.includes("DEPT_SCOPE")
            ? "DEPT_SCOPE"
            : activeHeadRoles.includes("WARD_SCOPE")
              ? "WARD_SCOPE"
              : "HEAD_SCOPE")
        : userRole;
    if (stepNo === 1 && effectiveSubmitRole === "WARD_SCOPE") {
      nextStep = 2;
    } else if (stepNo === 1 && effectiveSubmitRole === "DEPT_SCOPE") {
      nextStep = 3;
    }
    return { stepNo, nextStep };
  }

  private async resolveSubmitSignature(
    citizenId: string | null | undefined,
    requestId: number,
    connection: PoolConnection,
    fallbackCitizenId?: string | null,
  ): Promise<Buffer> {
    let signatureSnapshot = citizenId
      ? await requestRepository.findSignatureSnapshot(citizenId, connection)
      : null;
    if (!signatureSnapshot && fallbackCitizenId && fallbackCitizenId !== citizenId) {
      signatureSnapshot = await requestRepository.findSignatureSnapshot(
        fallbackCitizenId,
        connection,
      );
    }
    if (!signatureSnapshot) {
      const signaturePath = await requestRepository.findSignatureAttachmentPath(
        requestId,
        connection,
      );
      if (signaturePath) {
        signatureSnapshot = await readFile(signaturePath);
      }
    }
    if (!signatureSnapshot) {
      throw new Error("ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนส่งคำขอ");
    }
    return signatureSnapshot;
  }

  private async assertRateMappingUpdatePermission(
    request: NonNullable<Awaited<ReturnType<typeof requestRepository.findById>>>,
    userId: number,
    role: string,
  ): Promise<void> {
    const isOwner = request.user_id === userId;
    const officerCreatorId =
      role === 'PTS_OFFICER' ? await this.getOfficerCreatorIdWithFallback(request) : null;
    const isOfficerCreator = officerCreatorId === userId;
    const isOfficer = role === "PTS_OFFICER";
    if (!isOwner && !isOfficer) {
      throw new AuthorizationError("You do not have permission to update rate mapping");
    }
    if (isOwner || isOfficerCreator) {
      const canOwnerEdit =
        request.status === RequestStatus.DRAFT ||
        request.status === RequestStatus.RETURNED;
      if (!canOwnerEdit) {
        throw new Error("Rate mapping can only be updated in draft or returned status");
      }
    }
    if (!isOfficer) return;
    if (isOfficerCreator && (request.status === RequestStatus.DRAFT || request.status === RequestStatus.RETURNED)) {
      return;
    }
    const officerStep = ROLE_STEP_MAP["PTS_OFFICER"];
    const isOfficerStep =
      request.status === RequestStatus.PENDING &&
      request.current_step === officerStep;
    if (!isOfficerStep) {
      throw new Error("Request is not at PTS officer step");
    }
    if (request.assigned_officer_id && request.assigned_officer_id !== userId) {
      throw new Error("Request is assigned to another officer");
    }
  }

  // --- Helpers (Internal) ---

  private buildSubmissionDataJson(data: CreateRequestDTO): string | null {
    if (data.submission_data) {
      return JSON.stringify({
        ...data.submission_data,
        main_duty: data.main_duty ?? null,
      });
    }
    if (data.main_duty) {
      return JSON.stringify({ main_duty: data.main_duty });
    }
    return null;
  }

  private async resolveCreateRequestOwner(
    actorId: number,
    actorRole: string,
    data: CreateRequestDTO,
    connection: PoolConnection,
  ): Promise<{
    ownerUserId: number;
    ownerCitizenId: string;
    actorSignatureUserId: number;
    actorRoleForAudit: string;
    submissionDataExtras: Record<string, unknown>;
  }> {
    if (actorRole === 'PTS_OFFICER' && data.target_user_id) {
      const targetCitizenId = await requestRepository.findUserCitizenId(data.target_user_id);
      if (!targetCitizenId) {
        throw new ValidationError('ไม่พบบุคลากรที่เลือก');
      }
      const targetProfile = await requestRepository.findEmployeeProfile(
        targetCitizenId,
        connection,
      );
      if (!targetProfile) {
        throw new ValidationError('ไม่พบข้อมูลบุคลากรที่เลือก');
      }

      return {
        ownerUserId: data.target_user_id,
        ownerCitizenId: targetCitizenId,
        actorSignatureUserId: actorId,
        actorRoleForAudit: actorRole,
        submissionDataExtras: {
          created_by_officer_id: actorId,
          created_by_officer_role: actorRole,
          target_user_id: data.target_user_id,
          target_citizen_id: targetCitizenId,
          created_mode: 'OFFICER_ON_BEHALF',
        },
      };
    }

    const citizenId = await requestRepository.findUserCitizenId(actorId);
    if (!citizenId) {
      throw new Error('User not found');
    }

    return {
      ownerUserId: actorId,
      ownerCitizenId: citizenId,
      actorSignatureUserId: actorId,
      actorRoleForAudit: actorRole,
      submissionDataExtras: {},
    };
  }

  private async finalizeOfficerCreatedRequest(
    requestId: number,
    actorId: number,
    actorRole: string,
    requestRow: NonNullable<Awaited<ReturnType<typeof requestRepository.findById>>>,
    connection: PoolConnection,
    signatureSnapshot: Buffer | null,
  ): Promise<PTSRequest> {
    const submissionData = this.parseSubmissionData(requestRow.submission_data);
    const rateMapping =
      (submissionData.rate_mapping as Record<string, unknown> | undefined) ?? {};
    const rateIdFromMapping = Number(rateMapping.rate_id ?? submissionData.rate_id ?? 0) || null;
    const effectiveDateStr = normalizeDateToYMD(requestRow.effective_date as string | Date);
    const positionName = String(
      rateMapping.position_name ?? submissionData.position_name ?? requestRow.position_name ?? '',
    );
    const professionCode =
      String(rateMapping.profession_code ?? submissionData.profession_code ?? '').trim().toUpperCase() ||
      resolveProfessionCode(positionName);
    const rateId =
      rateIdFromMapping ??
      (await requestRepository.findMatchingRateId(
        Number(requestRow.requested_amount ?? 0),
        professionCode || undefined,
        connection,
      ));

    if (!rateId) {
      throw new ValidationError('ไม่พบอัตรา พ.ต.ส. ที่ใช้สร้างสิทธิ');
    }

    await requestRepository.insertApproval(
      {
        request_id: requestId,
        actor_id: actorId,
        step_no: requestRow.current_step || 1,
        action: ActionType.SUBMIT,
        comment: 'เจ้าหน้าที่ พ.ต.ส. สร้างคำขอแทนบุคลากร',
        signature_snapshot: signatureSnapshot,
      },
      connection,
    );

    await requestRepository.update(
      requestId,
      {
        status: RequestStatus.APPROVED,
        current_step: 7,
        step_started_at: null,
      },
      connection,
    );

    await requestRepository.insertVerificationSnapshot(
      {
        request_id: requestId,
        user_id: requestRow.user_id ?? null,
        citizen_id: requestRow.citizen_id,
        master_rate_id: rateId,
        effective_date: effectiveDateStr,
        snapshot_data: {
          source: 'PTS_OFFICER_ON_BEHALF',
          rate_mapping: rateMapping,
        },
        created_by: actorId,
      },
      connection,
    );

    await requestRepository.deactivateEligibility(
      requestRow.user_id ?? null,
      requestRow.citizen_id,
      effectiveDateStr,
      connection,
    );

    await requestRepository.insertEligibility(
      requestRow.user_id ?? null,
      requestRow.citizen_id,
      rateId,
      requestId,
      effectiveDateStr,
      connection,
    );

    await emitAuditEvent(
      {
        eventType: AuditEventType.REQUEST_SUBMIT,
        entityType: 'request',
        entityId: requestId,
        actorId,
        actorRole,
        actionDetail: {
          request_no: requestRow.request_no,
          mode: 'PTS_OFFICER_ON_BEHALF',
          finalized_immediately: true,
        },
      },
      connection,
    );

    await OcrRequestRepository.upsertRequestPrecheck(
      requestId,
      {
        status: 'queued',
        queued_at: new Date().toISOString(),
        source: 'AUTO_ON_SUBMIT',
      },
      connection,
    );

    await connection.commit();

    void enqueueRequestOcrPrecheck(requestId).catch((error) => {
      console.error('[OCRQueue] enqueue failed:', error);
    });

    const updatedEntity = await requestRepository.findById(requestId);
    if (!updatedEntity) {
      throw new Error('Request not found after immediate approval');
    }
    return mapRequestRow(updatedEntity) as PTSRequest;
  }

  private async insertAttachments(
    connection: PoolConnection,
    requestId: number,
    files?: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) return;
    for (const file of files) {
      if (!file.path) continue; // Skip files without path (e.g., MemoryStorage signatures)

      const relativePath = path.isAbsolute(file.path)
        ? path.relative(process.cwd(), file.path)
        : file.path;
      const normalizedPath = relativePath.split(path.sep).join('/');
      const normalizedName = this.normalizeFilename(file.originalname);
      const fileType = this.inferAttachmentType(file.fieldname, normalizedName);
      await requestRepository.insertAttachment(
        {
          request_id: requestId,
          file_type: fileType,
          file_path: normalizedPath,
          file_name: normalizedName,
        },
        connection,
      );
    }
  }

  private isOfficerOnBehalfCreate(actorRole: string, data: CreateRequestDTO): boolean {
    return actorRole === 'PTS_OFFICER' && Boolean(data.target_user_id);
  }

  private hasOfficerDisallowedFields(data: UpdateRequestDTO): boolean {
    return (
      data.personnel_type !== undefined ||
      data.position_number !== undefined ||
      data.department_group !== undefined ||
      data.main_duty !== undefined ||
      data.work_attributes !== undefined ||
      data.request_type !== undefined ||
      data.requested_amount !== undefined ||
      data.effective_date !== undefined ||
      data.reason !== undefined
    );
  }

  private assertOfficerSubmissionData(data: UpdateRequestDTO): void {
    if (!data.submission_data) return;
    const keys = Object.keys(data.submission_data);
    const allowedKeys = new Set(['verification_checks']);
    const hasOther = keys.some((key) => !allowedKeys.has(key));
    if (hasOther) {
      throw new Error('PTS_OFFICER can only update verification_checks in submission_data');
    }
  }

  private assertOfficerCanEditRequest(
    requestEntity: NonNullable<Awaited<ReturnType<typeof requestRepository.findById>>>,
    userId: number,
    data: UpdateRequestDTO,
    files?: Express.Multer.File[],
    signatureFile?: Express.Multer.File,
  ): void {
    const officerStep = ROLE_STEP_MAP['PTS_OFFICER'];
    if (
      requestEntity.status !== RequestStatus.PENDING ||
      requestEntity.current_step !== officerStep
    ) {
      throw new Error('คำขอนี้ไม่อยู่ในขั้นตอนที่เจ้าหน้าที่สามารถแก้ไขได้');
    }
    if (requestEntity.assigned_officer_id && requestEntity.assigned_officer_id !== userId) {
      throw new Error('คำขอนี้ถูกมอบหมายให้เจ้าหน้าที่ท่านอื่นแล้ว');
    }
    if ((files && files.length > 0) || signatureFile) {
      throw new Error('PTS_OFFICER cannot modify attachments or signature');
    }
    if (this.hasOfficerDisallowedFields(data)) {
      throw new Error('PTS_OFFICER can only update verification checks via submission_data');
    }
    this.assertOfficerSubmissionData(data);
  }

  private async assertCanUpdateRequest(
    requestEntity: NonNullable<Awaited<ReturnType<typeof requestRepository.findById>>>,
    userId: number,
    userRole: string,
    data: UpdateRequestDTO,
    files?: Express.Multer.File[],
    signatureFile?: Express.Multer.File,
  ): Promise<{ isOwner: boolean; isOfficer: boolean }> {
    const isOwner = requestEntity.user_id === userId;
    const officerCreatorId =
      userRole === 'PTS_OFFICER'
        ? await this.getOfficerCreatorIdWithFallback(requestEntity)
        : null;
    const isOfficerCreator = officerCreatorId === userId;
    const isOfficer = userRole === 'PTS_OFFICER';

    if (!isOwner && !isOfficer) {
      throw new Error('คุณไม่มีสิทธิ์แก้ไขคำขอนี้');
    }

    if (isOwner || isOfficerCreator) {
      const canOwnerEdit =
        requestEntity.status === RequestStatus.DRAFT ||
        requestEntity.status === RequestStatus.RETURNED;
      if (!canOwnerEdit) {
        throw new Error(
          `ไม่สามารถแก้ไขคำขอที่มีสถานะ ${requestEntity.status} ได้ (ต้องเป็น DRAFT หรือ RETURNED เท่านั้น)`,
        );
      }
    }

    if (isOfficer) {
      if (isOfficerCreator && (
        requestEntity.status === RequestStatus.DRAFT ||
        requestEntity.status === RequestStatus.RETURNED
      )) {
        return { isOwner: true, isOfficer };
      }
      this.assertOfficerCanEditRequest(requestEntity, userId, data, files, signatureFile);
    }

    return { isOwner, isOfficer };
  }

  private buildRequestUpdateData(
    data: UpdateRequestDTO,
    isOwner: boolean,
    currentStatus: string,
    currentSubmissionData?: unknown,
  ): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    if (data.personnel_type !== undefined) updateData.personnel_type = data.personnel_type;
    if (data.position_number !== undefined)
      updateData.current_position_number = data.position_number || null;
    if (data.department_group !== undefined)
      updateData.current_department = data.department_group || null;
    if (data.main_duty !== undefined) updateData.main_duty = data.main_duty || null;
    if (data.work_attributes !== undefined) updateData.work_attributes = data.work_attributes;
    if (data.request_type !== undefined) updateData.request_type = data.request_type;
    if (data.requested_amount !== undefined) {
      updateData.requested_amount = Number(data.requested_amount);
    }
    if (data.effective_date !== undefined) {
      updateData.effective_date = normalizeDateToYMD(data.effective_date);
    }
    if (data.submission_data !== undefined) {
      updateData.submission_data = {
        ...this.parseSubmissionData(currentSubmissionData),
        ...data.submission_data,
      };
    }

    if (isOwner && currentStatus === RequestStatus.RETURNED) {
      updateData.status = RequestStatus.DRAFT;
      updateData.step_started_at = null;
    }

    return updateData;
  }

  async confirmAttachments(requestId: number, userId: number) {
    const request = await requestRepository.findById(requestId);
    if (!request) {
      throw new ValidationError("ไม่พบคำขอที่ระบุ");
    }
    if (request.user_id !== userId && this.getOfficerCreatorId(request) !== userId) {
      throw new AuthorizationError("ไม่มีสิทธิ์ยืนยันไฟล์แนบของคำขอนี้");
    }
    const status = request.status as RequestStatus;
    if (![RequestStatus.DRAFT, RequestStatus.RETURNED].includes(status)) {
      throw new ValidationError("ไม่สามารถยืนยันไฟล์แนบในสถานะนี้ได้");
    }

    const attachments = await requestRepository.findAttachments(requestId);
    const hasLicense = attachments.some((att) => att.file_type === FileType.LICENSE);
    if (!hasLicense) {
      throw new ValidationError("ไม่พบไฟล์ใบอนุญาต");
    }

    return { confirmed: true };
  }

  async addEligibilityAttachments(
    eligibilityId: number,
    userId: number,
    files?: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new ValidationError("กรุณาเลือกไฟล์ที่ต้องการอัปโหลด");
    }

    const eligibility = await requestRepository.findEligibilityById(eligibilityId);
    if (!eligibility) {
      throw new NotFoundError("ไม่พบรายการสิทธิ");
    }
    const linkedRequestId = Number((eligibility as any).request_id ?? 0) || null;
    const requestAttachments =
      linkedRequestId !== null
        ? await requestRepository.findAttachmentsWithMetadata(linkedRequestId)
        : [];
    const existingAttachments = await requestRepository.findEligibilityAttachments(eligibilityId);
    const existingNames = new Set(
      existingAttachments.map((attachment) => String(attachment.file_name ?? "").trim().toLowerCase()),
    );
    const pendingNames = new Set<string>();

    for (const file of files) {
      const normalizedName = this.normalizeFilename(file.originalname);
      const displayName =
        this.findSourceRequestDisplayName(normalizedName, requestAttachments) ?? normalizedName;
      const dedupeName = displayName.trim().toLowerCase();
      if (!dedupeName) continue;
      if (existingNames.has(dedupeName) || pendingNames.has(dedupeName)) {
        throw new ValidationError(`มีไฟล์ชื่อนี้อยู่แล้ว: ${displayName}`);
      }
      pendingNames.add(dedupeName);
    }

    const connection = await getConnection();

    try {
      await connection.beginTransaction();
      for (const file of files) {
        if (!file.path) continue;
        const relativePath = path.isAbsolute(file.path)
          ? path.relative(process.cwd(), file.path)
          : file.path;
        const normalizedPath = relativePath.split(path.sep).join('/');
        const normalizedName = this.normalizeFilename(file.originalname);
        const displayName =
          this.findSourceRequestDisplayName(normalizedName, requestAttachments) ?? normalizedName;
        const fileType = this.inferAttachmentType(file.fieldname, normalizedName);
        await requestRepository.insertEligibilityAttachment(
          {
            eligibility_id: eligibilityId,
            file_type: fileType,
            file_path: normalizedPath,
            file_name: displayName,
            uploaded_by: userId,
          },
          connection,
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await emitAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: "eligibility_attachment",
      entityId: eligibilityId,
      actorId: userId,
      actionDetail: {
        eligibility_id: eligibilityId,
        uploaded_count: files.length,
        file_names: files.map((file) => {
          const normalizedName = this.normalizeFilename(file.originalname);
          return this.findSourceRequestDisplayName(normalizedName, requestAttachments) ?? normalizedName;
        }),
      },
    });

    return requestRepository.findEligibilityAttachments(eligibilityId);
  }

  async removeEligibilityAttachment(
    eligibilityId: number,
    attachmentId: number,
    userId: number,
  ) {
    const eligibility = await requestRepository.findEligibilityById(eligibilityId);
    if (!eligibility) {
      throw new NotFoundError("ไม่พบรายการสิทธิ");
    }
    const attachment = await requestRepository.findEligibilityAttachmentById(attachmentId);
    if (!attachment) {
      throw new NotFoundError("ไม่พบไฟล์แนบ");
    }
    if (Number(attachment.eligibility_id) !== eligibilityId) {
      throw new ValidationError("ไฟล์แนบนี้ไม่ได้อยู่ในรายการสิทธินี้");
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      await requestRepository.deleteEligibilityAttachmentById(attachmentId, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (attachment.file_path) {
      const absolutePath = path.isAbsolute(attachment.file_path)
        ? attachment.file_path
        : path.join(process.cwd(), attachment.file_path);
      await unlink(absolutePath).catch(() => undefined);
    }

    const linkedRequestId = Number((eligibility as any).request_id ?? 0) || null;
    const requestAttachments =
      linkedRequestId !== null
        ? await requestRepository.findAttachmentsWithMetadata(linkedRequestId)
        : [];
    const normalizedDeletedName = String(attachment.file_name ?? "").trim().toLowerCase();
    const hasRequestAttachmentWithSameName = requestAttachments.some(
      (item) => String(item.file_name ?? "").trim().toLowerCase() === normalizedDeletedName,
    );
    if (!hasRequestAttachmentWithSameName) {
      await this.removeEligibilityAttachmentOcrResultByFileName(
        eligibilityId,
        String(attachment.file_name ?? ""),
      );
    }

    await emitAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: "eligibility_attachment",
      entityId: eligibilityId,
      actorId: userId,
      actionDetail: {
        eligibility_id: eligibilityId,
        deleted_attachment_id: attachmentId,
        file_name: attachment.file_name,
      },
    });

    return { deleted: true, attachment_id: attachmentId };
  }

  // ============================================================================
  // Create Request (DRAFT)
  // ============================================================================

  async createRequest(
    userId: number,
    userRole: string,
    data: CreateRequestDTO,
    files?: Express.Multer.File[],
    _signatureFile?: Express.Multer.File,
  ): Promise<RequestWithDetails> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const owner = await this.resolveCreateRequestOwner(
        userId,
        userRole,
        data,
        connection,
      );

      const officerOnBehalfCreate = this.isOfficerOnBehalfCreate(userRole, data);
      const signatureId = officerOnBehalfCreate
        ? null
        : await requestRepository.findSignatureIdByUserId(
            owner.actorSignatureUserId,
            connection,
          );
      if (!officerOnBehalfCreate && !signatureId && !_signatureFile) {
        throw new Error('ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนยื่นคำขอ');
      }

      const requestedAmount = data.requested_amount ?? 0;
      // Rate validation skipped - allowing any amount for testing

      const effectiveDateStr = normalizeDateToYMD(data.effective_date as string | Date);

      // [REFACTOR] Use Repo Create
      const requestId = await requestRepository.create(
        {
          user_id: owner.ownerUserId,
          citizen_id: owner.ownerCitizenId,
          personnel_type: data.personnel_type,
          current_position_number: data.position_number || null,
          current_department: data.department_group || null,
          work_attributes: data.work_attributes, // Repo handles JSON.stringify
          applicant_signature_id: signatureId ?? null,
          request_type: data.request_type,
          requested_amount: requestedAmount,
          effective_date: effectiveDateStr,
          status: RequestStatus.DRAFT,
          current_step: 1,
          submission_data: (() => {
            const submissionDataJson = this.buildSubmissionDataJson(data);
            const parsed = submissionDataJson ? JSON.parse(submissionDataJson) : {};
            return { ...parsed, ...owner.submissionDataExtras };
          })(),
        },
        connection,
      );

      const requestNo = await this.generateUniqueRequestNo(requestId, connection);
      await requestRepository.updateRequestNo(requestId, requestNo, connection);

      await this.insertAttachments(connection, requestId, files);

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_CREATE,
          entityType: 'request',
          entityId: requestId,
          actorId: userId,
          actorRole: owner.actorRoleForAudit,
          actionDetail: {
            request_no: requestNo,
            personnel_type: data.personnel_type,
            request_type: data.request_type,
            requested_amount: requestedAmount,
            effective_date: effectiveDateStr,
            owner_user_id: owner.ownerUserId,
            owner_citizen_id: owner.ownerCitizenId,
          },
        },
        connection,
      );

      await connection.commit();

      return await requestQueryService.getRequestDetails(requestId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Verification Snapshot (PTS_OFFICER/HEAD_HR)
  // ============================================================================

  async createVerificationSnapshot(
    requestId: number,
    actorId: number,
    actorRole: string,
    payload: {
      master_rate_id: number;
      effective_date: string;
      expiry_date?: string;
      snapshot_data: Record<string, unknown>;
    },
  ) {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const requestEntity = await requestRepository.findById(requestId, connection);
      if (!requestEntity) {
        throw new Error('Request not found');
      }

      if (!['PTS_OFFICER', 'HEAD_HR'].includes(actorRole)) {
        throw new Error('Invalid role for verification snapshot');
      }

      let normalizedEffectiveDate: string;
      try {
        normalizedEffectiveDate = normalizeDateToYMD(payload.effective_date);
      } catch {
        throw new ValidationError('effective_date ต้องเป็นวันที่ที่ถูกต้อง');
      }

      let normalizedExpiryDate: string | null = null;
      if (payload.expiry_date) {
        try {
          normalizedExpiryDate = normalizeDateToYMD(payload.expiry_date);
        } catch {
          throw new ValidationError('expiry_date ต้องเป็นวันที่ที่ถูกต้อง');
        }
      }

      const snapshotId = await requestRepository.insertVerificationSnapshot(
        {
          request_id: requestId,
          user_id: requestEntity.user_id ?? null,
          citizen_id: requestEntity.citizen_id,
          master_rate_id: payload.master_rate_id,
          effective_date: normalizedEffectiveDate,
          expiry_date: normalizedExpiryDate,
          snapshot_data: payload.snapshot_data,
          created_by: actorId,
        },
        connection,
      );

      const snapshot = await requestRepository.findVerificationSnapshotById(snapshotId, connection);

      await connection.commit();
      return snapshot;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Submit Request
  // ============================================================================

  async submitRequest(requestId: number, userId: number, userRole: string): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // [REFACTOR] Lock row for update check
      const requestEntity = await requestRepository.findById(requestId, connection);

      const requestRow = await this.ensureRequestCanBeSubmitted(requestEntity, userId, userRole);
      const officerCreatorId =
        userRole === 'PTS_OFFICER' ? await this.getOfficerCreatorIdWithFallback(requestRow) : null;
      const isOfficerCreatedRequest = officerCreatorId === userId;
      const actorCitizenId = isOfficerCreatedRequest
        ? await requestRepository.findUserCitizenId(userId)
        : null;
      const activeHeadRoles =
        userRole === "HEAD_SCOPE"
          ? await getActiveHeadScopeRoles(userId, userRole)
          : [];
      const { stepNo, nextStep } = this.resolveSubmitStep(
        requestRow.current_step,
        userRole,
        activeHeadRoles,
      );
      if (isOfficerCreatedRequest) {
        return await this.finalizeOfficerCreatedRequest(
          requestId,
          userId,
          userRole,
          requestRow,
          connection,
          null,
        );
      }

      const signatureSnapshot = await this.resolveSubmitSignature(
        requestRow.citizen_id,
        requestId,
        connection,
        actorCitizenId,
      );

      const submissionData = this.parseSubmissionData(requestRow.submission_data);
      const nowIso = new Date().toISOString();

      // [REFACTOR] Use Repo Update
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.PENDING,
          current_step: nextStep,
          step_started_at: new Date(),
          submission_data: submissionData,
        },
        connection,
      );
      await OcrRequestRepository.upsertRequestPrecheck(
        requestId,
        {
          status: 'queued',
          queued_at: nowIso,
          source: 'AUTO_ON_SUBMIT',
        },
        connection,
      );

      // [REFACTOR] Use Repo Insert Approval
      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: userId,
          step_no: stepNo,
          action: ActionType.SUBMIT,
          comment: null,
          signature_snapshot: signatureSnapshot,
        },
        connection,
      );

      await connection.commit();

      // Notification (After commit)
      const nextRole =
        nextStep === 1 || nextStep === 2
          ? 'HEAD_SCOPE'
          : STEP_ROLE_MAP[nextStep] || 'HEAD_SCOPE';
      await NotificationService.notifyRole(
        nextRole,
        'มีคำขอใหม่รออนุมัติ',
        `มีคำขอเลขที่ ${requestRow.request_no} รอการตรวจสอบจากท่าน`,
        getRequestLinkForRole(nextRole, requestId),
      ).catch((error) => {
        console.error('[Notification] enqueue failed after submit:', error);
      });

      // Fire-and-forget OCR precheck enqueue (worker handles processing).
      void enqueueRequestOcrPrecheck(requestId).catch((error) => {
        console.error('[OCRQueue] enqueue failed:', error);
      });

      const updatedEntity = await requestRepository.findById(requestId);
      if (!updatedEntity) {
        throw new Error("Request not found after creation");
      }
      return mapRequestRow(updatedEntity) as PTSRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Update Request (DRAFT or RETURNED only)
  // ============================================================================

  async updateRequest(
    requestId: number,
    userId: number,
    userRole: string,
    data: UpdateRequestDTO,
    files?: Express.Multer.File[],
    _signatureFile?: Express.Multer.File,
  ): Promise<RequestWithDetails> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // [REFACTOR] Lock row
      const requestEntity = await requestRepository.findById(requestId, connection);

      if (!requestEntity) {
        throw new Error('ไม่พบคำขอที่ต้องการแก้ไข');
      }

      const { isOwner } = await this.assertCanUpdateRequest(
        requestEntity,
        userId,
        userRole,
        data,
        files,
        _signatureFile,
      );
      const updateData = this.buildRequestUpdateData(
        data,
        isOwner,
        requestEntity.status,
        requestEntity.submission_data,
      );

      // [REFACTOR] Use Repo Update
      if (Object.keys(updateData).length > 0) {
        await requestRepository.update(requestId, updateData, connection);
      }

      // Insert new files
      await this.insertAttachments(connection, requestId, files);

      await connection.commit();
      return await requestQueryService.getRequestDetails(requestId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Update Verification Checks
  // ============================================================================

  async updateVerificationChecks(
    requestId: number,
    actorId: number,
    actorRole: string,
    checks: any, // Typed specifically in real code
  ): Promise<RequestWithDetails> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const requestEntity = await requestRepository.findById(requestId, connection);

      if (!requestEntity) {
        throw new Error('Request not found');
      }

      if (requestEntity.status !== RequestStatus.PENDING) {
        throw new Error(`Cannot update verification checks with status: ${requestEntity.status}`);
      }

      const expectedRole = STEP_ROLE_MAP[requestEntity.current_step];
      if (expectedRole !== actorRole) {
        throw new Error(
          `Invalid role for verification update. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      // Logic to handle JSON
      const submissionData =
        parseJsonField<Record<string, unknown>>(requestEntity.submission_data, 'submission_data') ||
        {};
      const existingChecks =
        (submissionData.verification_checks as Record<string, unknown> | undefined) || {};
      const nextChecks: Record<string, unknown> = { ...existingChecks };

      const buildCheck = (input: any) => ({
        ...input,
        updated_by: actorId,
        updated_role: actorRole,
        updated_at: new Date().toISOString(),
      });

      if (checks.qualification_check) {
        nextChecks.qualification_check = buildCheck(checks.qualification_check);
      }
      if (checks.evidence_check) {
        nextChecks.evidence_check = buildCheck(checks.evidence_check);
      }

      const nextSubmissionData = {
        ...submissionData,
        verification_checks: nextChecks,
      };

      // [REFACTOR] Repo Update
      await requestRepository.update(
        requestId,
        {
          submission_data: nextSubmissionData,
        },
        connection,
      );

      await connection.commit();
      return await requestQueryService.getRequestDetails(requestId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Cancel Request
  // ============================================================================

  async cancelRequest(requestId: number, userId: number, reason?: string): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const requestEntity = await requestRepository.findById(requestId, connection);
      if (!requestEntity) {
        throw new NotFoundError('คำขอ', requestId);
      }

      if (requestEntity.user_id !== userId && this.getOfficerCreatorId(requestEntity) !== userId) {
        throw new AuthorizationError('คุณไม่มีสิทธิ์ยกเลิกคำขอนี้');
      }

      const nonCancellableStatuses = [RequestStatus.APPROVED, RequestStatus.CANCELLED];
      if (nonCancellableStatuses.includes(requestEntity.status as RequestStatus)) {
        throw new ConflictError(
          `ไม่สามารถยกเลิกคำขอที่มีสถานะ ${requestEntity.status} ได้`,
        );
      }

      // [REFACTOR] Update Status
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.CANCELLED,
          step_started_at: null,
        },
        connection,
      );

      // [REFACTOR] Record Action
      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: userId,
          step_no: requestEntity.current_step || 0,
          action: ActionType.CANCEL,
          comment: reason || 'ผู้ยื่นขอยกเลิกคำขอ',
          signature_snapshot: null,
        },
        connection,
      );

      await connection.commit();

      const updatedEntity = await requestRepository.findById(requestId);
      if (!updatedEntity) {
        throw new Error("Request not found after cancellation update");
      }
      return mapRequestRow(updatedEntity) as PTSRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private resolvePreviousDateYmd(value: unknown): string {
    const ymd = normalizeDateToYMD(value as string | Date);
    const date = new Date(`${ymd}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return ymd;
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  private ensureEligibilityManageRole(actorRole: string): void {
    if (actorRole !== 'PTS_OFFICER') {
      throw new AuthorizationError('Only PTS officer can manage eligibility');
    }
  }

  async setPrimaryEligibility(
    eligibilityId: number,
    actorId: number,
    actorRole: string,
    reason?: string | null,
  ): Promise<{ eligibility_id: number; is_active: boolean; deactivated_count: number }> {
    this.ensureEligibilityManageRole(actorRole);
    const connection = await getConnection();

    try {
      await connection.beginTransaction();
      const eligibility = await requestRepository.findEligibilityById(eligibilityId, connection);
      if (!eligibility) throw new NotFoundError('สิทธิ์', eligibilityId);

      const citizenId = String((eligibility as any).citizen_id ?? '').trim();
      const professionCode = String((eligibility as any).profession_code ?? '').trim();
      if (!citizenId || !professionCode) {
        throw new ValidationError('Eligibility data is incomplete');
      }

      const expiryDate = this.resolvePreviousDateYmd((eligibility as any).effective_date);
      const deactivatedCount =
        await requestRepository.deactivateActiveEligibilityByCitizenAndProfession(
          citizenId,
          professionCode,
          expiryDate,
          eligibilityId,
          connection,
        );
      await requestRepository.setEligibilityActiveState(eligibilityId, true, null, connection);

      await emitAuditEvent(
        {
          eventType: AuditEventType.OTHER,
          entityType: 'eligibility',
          entityId: eligibilityId,
          actorId,
          actorRole,
          actionDetail: {
            action: 'set_primary_eligibility',
            reason: reason?.trim() || null,
            citizen_id: citizenId,
            profession_code: professionCode,
            deactivated_count: deactivatedCount,
          },
        },
        connection,
      );

      await connection.commit();
      return { eligibility_id: eligibilityId, is_active: true, deactivated_count: deactivatedCount };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deactivateEligibilityById(
    eligibilityId: number,
    actorId: number,
    actorRole: string,
    reason?: string | null,
  ): Promise<{ eligibility_id: number; is_active: boolean }> {
    this.ensureEligibilityManageRole(actorRole);
    const connection = await getConnection();

    try {
      await connection.beginTransaction();
      const eligibility = await requestRepository.findEligibilityById(eligibilityId, connection);
      if (!eligibility) throw new NotFoundError('สิทธิ์', eligibilityId);

      const nowYmd = new Date().toISOString().slice(0, 10);
      await requestRepository.setEligibilityActiveState(eligibilityId, false, nowYmd, connection);

      await emitAuditEvent(
        {
          eventType: AuditEventType.OTHER,
          entityType: 'eligibility',
          entityId: eligibilityId,
          actorId,
          actorRole,
          actionDetail: {
            action: 'deactivate_eligibility',
            reason: reason?.trim() || null,
          },
        },
        connection,
      );

      await connection.commit();
      return { eligibility_id: eligibilityId, is_active: false };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async reactivateEligibilityById(
    eligibilityId: number,
    actorId: number,
    actorRole: string,
    reason?: string | null,
  ): Promise<{ eligibility_id: number; is_active: boolean; deactivated_count: number }> {
    this.ensureEligibilityManageRole(actorRole);
    return this.setPrimaryEligibility(eligibilityId, actorId, actorRole, reason);
  }

  // ============================================================================
  // Update Rate Mapping
  // ============================================================================

  async updateRateMapping(
    requestId: number,
    userId: number,
    role: string,
    data: { group_no: number; item_no?: string | null; sub_item_no?: string | null },
  ): Promise<any> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const request = await requestRepository.findById(requestId, connection);
      if (!request) throw new Error('Request not found');

      await this.assertRateMappingUpdatePermission(request, userId, role);

      // Resolve profession from position name (joined field) or fallback
      const positionName = request.position_name || '';
      const professionCode = resolveProfessionCode(positionName);

      if (!professionCode) {
        throw new Error(`Cannot resolve profession from position: ${positionName}`);
      }

      const rate = await requestRepository.findRateByDetails(
        professionCode,
        data.group_no,
        data.item_no ?? null,
        data.sub_item_no ?? null,
      );

      if (!rate) {
        throw new Error('Invalid rate mapping');
      }

      const submissionData =
        parseJsonField<Record<string, unknown>>(request.submission_data, 'submission_data') || {};
      const existingRateMapping =
        (submissionData as any).rate_mapping || (submissionData as any).classification;
      const nextSubmissionData = {
        ...submissionData,
        rate_mapping: {
          ...(existingRateMapping || {}),
          group_no: rate.group_no,
          item_no: rate.item_no,
          sub_item_no: rate.sub_item_no ?? null,
          rate_id: rate.rate_id,
          amount: rate.amount,
          profession_code: professionCode,
        },
      };

      await requestRepository.update(
        requestId,
        { requested_amount: rate.amount, submission_data: nextSubmissionData },
        connection,
      );

      await connection.commit();

      // Return merged data
      return {
        request_id: requestId,
        rate_id: rate.rate_id,
        amount: rate.amount,
        group_no: rate.group_no,
        item_no: rate.item_no,
        sub_item_no: rate.sub_item_no,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const requestCommandService = new RequestCommandService();
