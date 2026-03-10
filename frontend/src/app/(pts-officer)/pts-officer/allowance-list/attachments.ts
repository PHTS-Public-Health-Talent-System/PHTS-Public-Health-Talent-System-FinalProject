import {
  detectOcrDocumentKind,
  getOcrDocumentTypeLabel,
  isLikelyOcrNoiseLine,
  normalizeOcrAnalysisText,
} from "@/features/request/detail/utils";
import { shouldSuppressAssignmentOrderOcrUi } from "@/features/request/detail/utils";
import {
  getLicenseOcrNotice,
  shouldSuppressLicenseOcrUi,
} from "@/features/request/detail/utils";
import { shouldSuppressMemoOcrActions } from "@/features/request/detail/utils";

export type AllowanceAttachmentSource = "request" | "eligibility";

export type AllowanceAttachmentLike = {
  attachment_id: number;
  file_name: string;
  file_path: string;
  file_type?: string | null;
};

export type AllowanceAttachmentListItem = {
  attachment_id: number;
  delete_attachment_id?: number;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  source: AllowanceAttachmentSource;
  sources: AllowanceAttachmentSource[];
};

export type AllowanceAttachmentOcrLike = {
  name?: string;
  ok?: boolean;
  markdown?: string;
  error?: string;
  suppressed?: boolean;
  document_kind?: string;
  fields?: Record<string, unknown>;
};

export type AllowanceAttachmentOcrUiState = {
  hasOcrResult: boolean;
  canRunOcr: boolean;
  canClearOcr: boolean;
  shouldShowResetHint: boolean;
};

export type AllowanceAttachmentOcrPolicy = {
  documentLabel: string | null;
  notice: string | null;
  uiState: AllowanceAttachmentOcrUiState;
};

const normalizeVisibleFileNameSet = (
  visibleFileNames?: Iterable<string>,
): Set<string> | null => {
  if (!visibleFileNames) return null;
  const set = new Set<string>();
  for (const fileName of visibleFileNames) {
    const normalized = String(fileName ?? "").trim().toLowerCase();
    if (!normalized) continue;
    set.add(normalized);
  }
  return set;
};

const getReadableOcrFirstLine = (markdown?: string | null): string | null => {
  const lines = String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => normalizeOcrAnalysisText(line))
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    if (isLikelyOcrNoiseLine(line)) continue;
    return line;
  }
  return null;
};

export function buildAllowanceOcrDocuments(params: {
  eligibilityResults?: AllowanceAttachmentOcrLike[];
  requestResults?: AllowanceAttachmentOcrLike[];
  latestResults?: AllowanceAttachmentOcrLike[];
  visibleFileNames?: Iterable<string>;
}): Array<{ fileName: string; markdown: string }> {
  const byFileName = buildAllowanceAttachmentOcrResultMap(params);
  return Array.from(byFileName.values())
    .filter((item) => !item.suppressed && item.ok && item.markdown)
    .map((item) => ({
      fileName: item.name?.trim() || "ผล OCR",
      markdown: item.markdown?.trim() || "",
    }))
    .filter((item) => item.markdown.length > 0)
}

export function buildAllowanceAttachmentOcrResultMap(params: {
  eligibilityResults?: AllowanceAttachmentOcrLike[];
  requestResults?: AllowanceAttachmentOcrLike[];
  latestResults?: AllowanceAttachmentOcrLike[];
  visibleFileNames?: Iterable<string>;
}): Map<string, AllowanceAttachmentOcrLike> {
  const entries = new Map<string, AllowanceAttachmentOcrLike>();
  const visibleFileNameSet = normalizeVisibleFileNameSet(params.visibleFileNames);

  for (const item of params.eligibilityResults ?? []) {
    const fileName = (item.name ?? "").trim();
    if (!fileName) continue;
    if (visibleFileNameSet && !visibleFileNameSet.has(fileName.toLowerCase())) continue;
    entries.set(fileName, item);
  }

  for (const item of params.requestResults ?? []) {
    const fileName = (item.name ?? "").trim();
    if (!fileName || entries.has(fileName)) continue;
    if (visibleFileNameSet && !visibleFileNameSet.has(fileName.toLowerCase())) continue;
    entries.set(fileName, item);
  }

  for (const item of params.latestResults ?? []) {
    const fileName = (item.name ?? "").trim();
    if (!fileName) continue;
    if (visibleFileNameSet && !visibleFileNameSet.has(fileName.toLowerCase())) continue;
    entries.set(fileName, item);
  }

  return entries;
}

export function buildAllowanceClearableOcrFileNameSet(params: {
  eligibilityResults?: AllowanceAttachmentOcrLike[];
  latestResults?: AllowanceAttachmentOcrLike[];
  visibleFileNames?: Iterable<string>;
}): Set<string> {
  const names = new Set<string>();
  const visibleFileNameSet = normalizeVisibleFileNameSet(params.visibleFileNames);

  for (const item of [...(params.eligibilityResults ?? []), ...(params.latestResults ?? [])]) {
    const fileName = String(item.name ?? "").trim().toLowerCase();
    if (!fileName) continue;
    if (visibleFileNameSet && !visibleFileNameSet.has(fileName)) continue;
    if (item.suppressed) continue;
    names.add(fileName);
  }

  return names;
}

export function mergeAllowanceAttachments(params: {
  requestAttachments: AllowanceAttachmentLike[];
  eligibilityAttachments: AllowanceAttachmentLike[];
}): AllowanceAttachmentListItem[] {
  const requestFiles: AllowanceAttachmentListItem[] = params.requestAttachments.map((file) => ({
    attachment_id: file.attachment_id,
    file_name: file.file_name,
    file_path: file.file_path,
    file_type: file.file_type,
    source: "request",
    sources: ["request"],
  }));
  const directFiles: AllowanceAttachmentListItem[] = params.eligibilityAttachments.map((file) => ({
    attachment_id: file.attachment_id,
    delete_attachment_id: file.attachment_id,
    file_name: file.file_name,
    file_path: file.file_path,
    file_type: file.file_type,
    source: "eligibility",
    sources: ["eligibility"],
  }));

  const merged = new Map<string, AllowanceAttachmentListItem>();

  for (const file of [...requestFiles, ...directFiles]) {
    const dedupeKey = file.file_name.trim().toLowerCase();
    const existing = merged.get(dedupeKey);
    if (!existing) {
      merged.set(dedupeKey, file);
      continue;
    }
    if (!existing.sources.includes(file.source)) {
      existing.sources.push(file.source);
    }
    if (file.source === "eligibility") {
      existing.delete_attachment_id = file.attachment_id;
    }
    if (file.source === "request") {
      existing.source = "request";
      existing.attachment_id = file.attachment_id;
      existing.file_path = file.file_path;
      existing.file_type = file.file_type;
    }
  }

  return Array.from(merged.values());
}

export function getAllowanceAttachmentNotice(
  item: AllowanceAttachmentListItem,
): string | null {
  if (item.sources.includes("request") && item.sources.includes("eligibility")) {
    return "ไฟล์นี้มีทั้งต้นฉบับจากคำขอเดิมและสำเนาที่เพิ่มในหน้านี้ ปุ่มลบจะลบเฉพาะสำเนาที่เพิ่มในหน้านี้";
  }
  return null;
}

export function getAllowanceAttachmentOcrSummary(
  item?: AllowanceAttachmentOcrLike | null,
): { tone: "success" | "muted" | "error"; text: string } | null {
  if (!item) return null;
  if (item.suppressed) return null;
  if (item.ok === false) {
    return {
      tone: "error",
      text: "ตรวจ OCR ไม่สำเร็จ",
    };
  }

  const firstLine = getReadableOcrFirstLine(item.markdown);

  if (firstLine) {
    return {
      tone: "success",
      text: `OCR พบข้อความ: ${firstLine}`,
    };
  }

  if (item.ok) {
    return {
      tone: "muted",
      text: "ตรวจ OCR แล้ว แต่ยังไม่พบข้อความที่นำมาใช้ได้",
    };
  }

  return null;
}

export function getAllowanceAttachmentOcrDocumentTypeLabel(
  item?: AllowanceAttachmentOcrLike | null,
): string | null {
  if (!item || item.suppressed) return null;
  const documentKind = String(item.document_kind ?? "").trim().toLowerCase();
  const detectedKind = item.markdown
    ? detectOcrDocumentKind({
        fileName: String(item.name ?? ""),
        markdown: item.markdown,
      })
    : "general";

  if (documentKind === "general" && detectedKind !== "general") {
    return getOcrDocumentTypeLabel(detectedKind);
  }

  if (documentKind) {
    switch (documentKind) {
      case "assignment_order":
        return "คำสั่งมอบหมายงาน";
      case "memo":
        return "หนังสือนำส่ง";
      case "license":
        return "ใบอนุญาต";
      case "general":
        return "เอกสารทั่วไป";
      default:
        return documentKind;
    }
  }
  return detectedKind !== "general" ? getOcrDocumentTypeLabel(detectedKind) : null;
}

export function shouldShowAllowanceAttachmentOcrAction(
  item?: AllowanceAttachmentOcrLike | null,
): boolean {
  if (!item) return true;
  if (item.suppressed) return true;
  if (item.ok === false) return false;
  if (item.ok) {
    return false;
  }
  return true;
}

export function getAllowanceAttachmentOcrUiState(params: {
  fileName: string;
  result?: AllowanceAttachmentOcrLike | null;
  documentLabel?: string | null;
  suppressActions?: boolean;
  clearableFileNames: Set<string>;
}): AllowanceAttachmentOcrUiState {
  const normalizedFileName = params.fileName.trim().toLowerCase();
  const hasOcrResult = Boolean(params.result);
  const suppressActions = Boolean(params.suppressActions);
  const isGeneralDocument = params.documentLabel === "เอกสารทั่วไป";
  const isLicenseDocument = params.documentLabel === "ใบอนุญาต";
  const canClearOcr = suppressActions
    ? false
    : isGeneralDocument || isLicenseDocument
      ? false
      : params.clearableFileNames.has(normalizedFileName);
  const canRunOcr =
    suppressActions || isLicenseDocument
      ? false
      : shouldShowAllowanceAttachmentOcrAction(params.result);

  return {
    hasOcrResult,
    canRunOcr,
    canClearOcr,
    shouldShowResetHint: hasOcrResult && canClearOcr,
  };
}

export function buildAllowanceAttachmentOcrPolicy(params: {
  fileName: string;
  result?: AllowanceAttachmentOcrLike | null;
  personName?: string | null;
  clearableFileNames: Set<string>;
  suppressActions?: boolean;
}): AllowanceAttachmentOcrPolicy {
  const documentLabel = getAllowanceAttachmentOcrDocumentTypeLabel(params.result);
  const personName = String(params.personName ?? "").trim();
  const ocrDocument =
    params.result?.markdown && personName
      ? {
          fileName: params.fileName,
          markdown: params.result.markdown,
        }
      : null;

  const suppressAssignmentOrderOcrUi =
    ocrDocument &&
    shouldSuppressAssignmentOrderOcrUi(ocrDocument, personName);
  const suppressMemoOcrActions =
    ocrDocument && shouldSuppressMemoOcrActions(ocrDocument, personName);
  const suppressLicenseOcrUi = personName
    ? shouldSuppressLicenseOcrUi({
        fullName: personName,
        result: params.result,
      })
    : false;

  const notice = suppressAssignmentOrderOcrUi
    ? "เป็นคำสั่งมอบหมายงาน แต่ยังไม่พบชื่อบุคลากรคนนี้"
    : suppressMemoOcrActions
      ? "เป็นหนังสือนำส่ง แต่ยังไม่พบชื่อบุคลากรคนนี้"
      : personName
        ? getLicenseOcrNotice({
            fullName: personName,
            result: params.result,
          })
        : null;

  const uiState = getAllowanceAttachmentOcrUiState({
    fileName: params.fileName,
    result: params.result,
    documentLabel,
    suppressActions:
      Boolean(params.suppressActions) ||
      Boolean(suppressAssignmentOrderOcrUi) ||
      Boolean(suppressMemoOcrActions) ||
      Boolean(suppressLicenseOcrUi),
    clearableFileNames: params.clearableFileNames,
  });

  return {
    documentLabel,
    notice,
    uiState,
  };
}
