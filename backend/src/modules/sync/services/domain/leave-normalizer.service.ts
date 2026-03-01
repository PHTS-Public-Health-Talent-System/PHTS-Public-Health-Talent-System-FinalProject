import type { RowDataPacket } from 'mysql2/promise';
import {
  buildLeaveReviewMeta,
  buildReclassificationMeta,
  classifyLeaveType,
  type LeaveReclassificationMeta,
  type LeaveReviewMeta,
} from '@/modules/sync/services/domain/leave-classifier.js';
import {
  fiscalYearFromDate,
  normalizeDateRange,
  resolveDurationDays,
  toDateOnly,
  toDateString,
} from '@/modules/sync/services/domain/leave-date-normalizer.js';

const normalizeCitizenId = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits;
};

export const isValidCitizenId = (value: unknown): boolean => /^[0-9]{13}$/.test(normalizeCitizenId(value));

export type LeaveNormalizationIssueMeta = {
  issue_code: 'LEAVE_DATE_INVALID' | 'LEAVE_DATE_NORMALIZED';
  reason_text: string;
  detail: Record<string, string | null>;
};

const buildNormalizationIssues = (input: {
  row: RowDataPacket;
  startDate: string | null;
  endDate: string | null;
}): LeaveNormalizationIssueMeta[] => {
  const rawStartValue = input.row.start_date;
  const rawEndValue = input.row.end_date;
  const rawStartDate = String(rawStartValue ?? '').trim() || null;
  const rawEndDate = String(rawEndValue ?? '').trim() || null;
  const canonicalStartDate = toDateString(toDateOnly(rawStartValue));
  const canonicalEndDate = toDateString(toDateOnly(rawEndValue));
  const comparableStartDate = rawStartValue instanceof Date ? canonicalStartDate : rawStartDate;
  const comparableEndDate = rawEndValue instanceof Date ? canonicalEndDate : rawEndDate;
  const issues: LeaveNormalizationIssueMeta[] = [];

  if ((rawStartDate && !input.startDate) || (rawEndDate && !input.endDate)) {
    issues.push({
      issue_code: 'LEAVE_DATE_INVALID',
      reason_text: 'ไม่สามารถแปลงวันที่ลาได้จากข้อมูลต้นทาง',
      detail: {
        start_date: rawStartDate,
        end_date: rawEndDate,
      },
    });
    return issues;
  }

  const normalizedStartChanged =
    comparableStartDate !== null && comparableStartDate !== input.startDate;
  const normalizedEndChanged =
    comparableEndDate !== null && comparableEndDate !== input.endDate;
  if (normalizedStartChanged || normalizedEndChanged) {
    issues.push({
      issue_code: 'LEAVE_DATE_NORMALIZED',
      reason_text: 'ระบบปรับรูปแบบหรือแก้ไขวันที่ลาให้เป็นค่าที่ใช้งานได้',
      detail: {
        original_start_date: rawStartDate,
        normalized_start_date: input.startDate,
        original_end_date: rawEndDate,
        normalized_end_date: input.endDate,
      },
    });
  }

  return issues;
};

export const normalizeLeaveRowWithMeta = (row: RowDataPacket): {
  row: RowDataPacket;
  meta: LeaveReclassificationMeta | null;
  reviewMeta: LeaveReviewMeta | null;
  normalizationIssues: LeaveNormalizationIssueMeta[];
} => {
  const range = normalizeDateRange(row);
  const durationDays = resolveDurationDays(row, range);

  const remark = String(row.remark ?? '');
  const classifiedSourceLeaveType = String(row.hrms_leave_type ?? row.leave_type ?? '');
  const originalLeaveType = String(row.raw_hrms_leave_type ?? classifiedSourceLeaveType);
  const leaveType = classifyLeaveType({
    hrmsLeaveType: classifiedSourceLeaveType,
    remark,
    sex: row.sex as string | null,
    durationDays,
  });

  const normalizedRow = {
    ref_id: String(row.ref_id ?? '').trim(),
    citizen_id: normalizeCitizenId(row.citizen_id),
    leave_type: leaveType,
    start_date: toDateString(range.start),
    end_date: toDateString(range.end),
    duration_days: durationDays,
    fiscal_year: fiscalYearFromDate(range.start),
    remark,
    status: String(row.status ?? 'approved'),
  } as RowDataPacket;

  return {
    row: normalizedRow,
    meta: buildReclassificationMeta({
      originalType: originalLeaveType,
      normalizedType: leaveType,
      remark,
      sex: row.sex as string | null,
      durationDays,
    }),
    reviewMeta: buildLeaveReviewMeta({
      originalType: originalLeaveType,
      normalizedType: leaveType,
      remark,
      sex: row.sex as string | null,
    }),
    normalizationIssues: buildNormalizationIssues({
      row,
      startDate: normalizedRow.start_date,
      endDate: normalizedRow.end_date,
    }),
  };
};

export type { LeaveReclassificationMeta, LeaveReviewMeta };
