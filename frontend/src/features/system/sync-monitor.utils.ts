import type { DataIssueRecord } from '@/features/system/shared';

const LEAVE_RECLASS_ISSUE_CODE = 'LEAVE_TYPE_RECLASSIFIED';
const SICK_FAMILY_CARE_REVIEW_ISSUE_CODE = 'SICK_LEAVE_FAMILY_CARE_REVIEW';
const LEAVE_DATE_NORMALIZED_ISSUE_CODE = 'LEAVE_DATE_NORMALIZED';
const LEAVE_DATE_INVALID_ISSUE_CODE = 'LEAVE_DATE_INVALID';

const LEAVE_REASON_CODE_LABELS: Record<string, string> = {
  MATERNITY_WIFE_HELP_PATTERN: 'ลาคลอดถูกจัดเป็นลาช่วยภริยาเลี้ยงดูบุตร',
  WIFE_HELP_PATTERN: 'ตรวจพบบริบทช่วยภริยาคลอด/เลี้ยงดูบุตร',
  SICK_LEAVE_FAMILY_CARE_REVIEW: 'ข้อความการลาส่อว่าเป็นการดูแลบุคคลอื่น',
  LEAVE_DATE_NORMALIZED: 'ระบบปรับรูปแบบวันที่ลา',
  LEAVE_DATE_INVALID: 'ไม่สามารถแปลงวันที่ลาได้',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  vacation: 'ลาพักผ่อน',
  wife_help: 'ลาช่วยภริยาเลี้ยงดูบุตร',
  maternity: 'ลาคลอด',
  ordain: 'ลาบวช',
  education: 'ลาไปศึกษา/ประชุม',
};

const ISSUE_CODE_LABELS: Record<string, string> = {
  LEAVE_TYPE_RECLASSIFIED: 'มีการจัดหมวดหมู่ประเภทการลาใหม่',
  SICK_LEAVE_FAMILY_CARE_REVIEW: 'ลาป่วยที่ข้อความการลาคล้ายการดูแลบุคคลอื่น',
  LEAVE_DATE_NORMALIZED: 'ระบบต้องปรับรูปแบบวันที่ลา',
  LEAVE_DATE_INVALID: 'ข้อมูลวันที่ลาใช้ไม่ได้',
};

export type LeaveIssueSummary = {
  total: number;
  reclassified: number;
  review: number;
  dateAdjusted: number;
  dateInvalid: number;
  topReasons: Array<{ reasonCode: string; count: number }>;
};

const parseIssueDetail = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return null;
};

const toLeaveTypeLabel = (raw: unknown): string => {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  return LEAVE_TYPE_LABELS[key] || key || '-';
};

const toReasonLabel = (reasonCode: unknown): string => {
  const key = String(reasonCode ?? '').trim();
  return LEAVE_REASON_CODE_LABELS[key] ?? key || '-';
};

const pickFirstString = (parsed: Record<string, unknown>, candidates: string[]): string | null => {
  for (const key of candidates) {
    const value = parsed[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

export const toIssueCodeLabel = (issueCode: string): string =>
  ISSUE_CODE_LABELS[issueCode] ?? issueCode;

export const formatIssueDetailText = (issueCode: string, raw: string | null): string => {
  if (!raw) return '-';
  const parsed = parseIssueDetail(raw);
  if (!parsed) return raw;

  if (issueCode === LEAVE_RECLASS_ISSUE_CODE) {
    return [
      `บัตรประชาชน: ${parsed.citizen_id ?? '-'}`,
      `ปรับประเภท: ${toLeaveTypeLabel(parsed.original_type)} -> ${toLeaveTypeLabel(parsed.normalized_type)}`,
      `เหตุผล: ${toReasonLabel(parsed.reason_code)}`,
      parsed.remark ? `ข้อความการลาจากต้นทาง: ${String(parsed.remark).trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (issueCode === SICK_FAMILY_CARE_REVIEW_ISSUE_CODE) {
    return [
      `บัตรประชาชน: ${parsed.citizen_id ?? '-'}`,
      `ประเภทการลาจาก HRMS: ${toLeaveTypeLabel(parsed.leave_type ?? parsed.source_type)}`,
      `ข้อสังเกต: ${String(parsed.reason_text ?? toReasonLabel(parsed.reason_code) ?? '-')}`,
      parsed.remark ? `ข้อความการลาจากต้นทาง: ${String(parsed.remark).trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (
    issueCode === LEAVE_DATE_NORMALIZED_ISSUE_CODE ||
    issueCode === LEAVE_DATE_INVALID_ISSUE_CODE
  ) {
    return [
      `บัตรประชาชน: ${parsed.citizen_id ?? '-'}`,
      `ข้อสังเกต: ${String(parsed.reason_text ?? toReasonLabel(parsed.reason_code) ?? '-')}`,
      `วันที่ลาเดิม: ${pickFirstString(parsed, ['original_start_date', 'start_date']) ?? '-'}`,
      `วันที่ลาหลังปรับ: ${pickFirstString(parsed, ['normalized_start_date']) ?? '-'}`,
      `วันสิ้นสุดเดิม: ${pickFirstString(parsed, ['original_end_date', 'end_date']) ?? '-'}`,
      `วันสิ้นสุดหลังปรับ: ${pickFirstString(parsed, ['normalized_end_date']) ?? '-'}`,
    ]
      .filter((line) => !line.endsWith(': -') || issueCode === LEAVE_DATE_INVALID_ISSUE_CODE)
      .join('\n');
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return '-';
  return entries
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value ?? '-')}`)
    .join('\n');
};

export const buildLeaveIssueSummary = (issues: DataIssueRecord[]): LeaveIssueSummary => {
  const reasonCount = new Map<string, number>();
  const summary: LeaveIssueSummary = {
    total: 0,
    reclassified: 0,
    review: 0,
    dateAdjusted: 0,
    dateInvalid: 0,
    topReasons: [],
  };

  for (const issue of issues) {
    if (
      issue.issue_code !== LEAVE_RECLASS_ISSUE_CODE &&
      issue.issue_code !== SICK_FAMILY_CARE_REVIEW_ISSUE_CODE &&
      issue.issue_code !== LEAVE_DATE_NORMALIZED_ISSUE_CODE &&
      issue.issue_code !== LEAVE_DATE_INVALID_ISSUE_CODE
    ) {
      continue;
    }

    summary.total += 1;

    if (issue.issue_code === LEAVE_RECLASS_ISSUE_CODE) summary.reclassified += 1;
    if (issue.issue_code === SICK_FAMILY_CARE_REVIEW_ISSUE_CODE) summary.review += 1;
    if (issue.issue_code === LEAVE_DATE_NORMALIZED_ISSUE_CODE) summary.dateAdjusted += 1;
    if (issue.issue_code === LEAVE_DATE_INVALID_ISSUE_CODE) summary.dateInvalid += 1;

    const parsed = parseIssueDetail(issue.issue_detail);
    const reasonCode = String(parsed?.reason_code ?? issue.issue_code);
    reasonCount.set(reasonCode, (reasonCount.get(reasonCode) ?? 0) + 1);
  }

  summary.topReasons = [...reasonCount.entries()]
    .map(([reasonCode, count]) => ({ reasonCode, count }))
    .sort((a, b) => b.count - a.count);

  return summary;
};

export const leaveIssueConstants = {
  LEAVE_RECLASS_ISSUE_CODE,
  SICK_FAMILY_CARE_REVIEW_ISSUE_CODE,
  LEAVE_DATE_NORMALIZED_ISSUE_CODE,
  LEAVE_DATE_INVALID_ISSUE_CODE,
};

export const leaveIssueLabelMaps = {
  LEAVE_REASON_CODE_LABELS,
};
