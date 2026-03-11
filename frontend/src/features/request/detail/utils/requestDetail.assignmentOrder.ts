import { parseCanonicalAssignmentOrderSummary } from './requestDetail.assignmentOrder.parser';
import { normalizeAssignmentOrderMarkdown } from './requestDetail.assignmentOrder.normalizer';
import { detectOcrDocumentKind } from './requestDetail.ocrDocuments';

type OcrAssignmentDocument = {
  fileName?: string | null;
  markdown?: string | null;
  engineUsed?: string | null;
};

export type AssignmentOrderSummary = {
  fileName: string;
  orderNo: string | null;
  subject: string | null;
  department: string | null;
  effectiveDate: string | null;
  signedDate: string | null;
  signerName: string | null;
  signerTitle: string | null;
  personMatched: boolean;
  personLine: string | null;
  sectionTitle: string | null;
  dutyHighlights: string[];
  warnings?: string[];
};

export const parseAssignmentOrderSummary = (
  document: OcrAssignmentDocument,
  personName: string,
): AssignmentOrderSummary | null => {
  const normalizedMarkdown = normalizeAssignmentOrderMarkdown({
    markdown: document.markdown,
    engineUsed: document.engineUsed,
  });

  if (!normalizedMarkdown.trim()) {
    return null;
  }

  const detectedKind = detectOcrDocumentKind({
    fileName: document.fileName,
    markdown: normalizedMarkdown,
  });

  const summary = parseCanonicalAssignmentOrderSummary(
    {
      fileName: document.fileName,
      markdown: normalizedMarkdown,
    },
    personName,
  );

  if (!summary) {
    return null;
  }

  if (detectedKind === 'assignment_order') {
    return summary;
  }

  // Fallback path: detector can miss heavily noisy OCR text.
  // Keep parsed result only when canonical parser confidently identifies assignment structure.
  if (summary.orderNo || summary.subject || summary.sectionTitle || summary.dutyHighlights.length > 0) {
    return summary;
  }

  return null;
};

export const findAssignmentOrderSummary = (
  documents: OcrAssignmentDocument[],
  personName: string,
): AssignmentOrderSummary | null => {
  let best: { score: number; summary: AssignmentOrderSummary } | null = null;

  for (const document of documents) {
    const summary = parseAssignmentOrderSummary(document, personName);
    if (!summary) continue;
    if (!summary.personMatched) continue;
    const score =
      100 +
      (summary.sectionTitle ? 20 : 0) +
      summary.dutyHighlights.length * 5 +
      (summary.subject ? 3 : 0) +
      (summary.orderNo ? 2 : 0);
    if (!best || score > best.score) {
      best = { score, summary };
    }
  }

  return best?.summary ?? null;
};

export const shouldSuppressAssignmentOrderOcrUi = (
  document: OcrAssignmentDocument,
  personName: string,
): boolean => {
  const summary = parseAssignmentOrderSummary(document, personName);
  return Boolean(summary && !summary.personMatched);
};
