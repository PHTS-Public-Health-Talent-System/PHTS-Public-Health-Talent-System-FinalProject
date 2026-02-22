import { countBusinessDays, countCalendarDays, formatLocalDate, isHoliday } from "@/modules/payroll/core/utils/date.utils.js";
import { LEAVE_RULES } from "@/modules/payroll/payroll.constants.js";
import type { LeaveUnit, LeaveRuleType } from "@/modules/payroll/payroll.constants.js";
import { LeaveManagementRepository } from "../repositories/leave-management.repository.js";

export type LeaveRule = {
  limit: number | null;
  unit: LeaveUnit;
  rule_type: LeaveRuleType;
};

export type LeaveRulesMap = Record<string, LeaveRule>;

export type LeaveQuotaRow = {
  quota_vacation?: number | string | null;
  quota_personal?: number | string | null;
  quota_sick?: number | string | null;
};

export type LeavePolicyInputRow = {
  id?: number;
  citizen_id?: string;
  leave_type: string;
  start_date: string | Date;
  end_date: string | Date;
  remark?: string | null;
  document_start_date?: string | Date | null;
  document_end_date?: string | Date | null;
  document_duration_days?: number | null;
  duration_days?: number | null;
  is_no_pay?: number | null;
  pay_exception?: number | null;
  study_institution?: string | null;
  study_program?: string | null;
  study_major?: string | null;
  return_report_events?: Array<{
    report_date: string | Date;
    resume_date?: string | Date | null;
    resume_study_institution?: string | null;
    resume_study_program?: string | null;
    resume_study_major?: string | null;
  }>;
};

export type LeaveQuotaStatusByType = {
  limit: number | null;
  used: number;
  remaining: number | null;
  overQuota: boolean;
  exceedDate: string | null;
};

export type LeaveQuotaStatus = {
  perType: Record<string, LeaveQuotaStatusByType>;
  perLeave: Record<number, {
    leaveType: string;
    duration: number;
    limit: number | null;
    overQuota: boolean;
    exceedDate: string | null;
  }>;
};

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
const CACHE_TTL_MS = 60 * 1000;
const quotaCache = new Map<string, { expiresAt: number; value: LeaveQuotaStatus }>();
const repository = new LeaveManagementRepository();

const getFiscalYear = (date: Date): number => {
  const month = date.getMonth();
  return month >= 9 ? date.getFullYear() + 1 : date.getFullYear();
};

const resolveLeaveLimit = (
  type: string,
  ruleLimit: number | null,
  quota: LeaveQuotaRow,
): number | null => {
  if (type === "vacation") {
    return quota.quota_vacation !== null && quota.quota_vacation !== undefined
      ? Number(quota.quota_vacation)
      : ruleLimit;
  }
  if (type === "personal") {
    return quota.quota_personal !== null && quota.quota_personal !== undefined
      ? Number(quota.quota_personal)
      : ruleLimit;
  }
  if (type === "sick") {
    return quota.quota_sick !== null && quota.quota_sick !== undefined
      ? Number(quota.quota_sick)
      : ruleLimit;
  }
  return ruleLimit;
};

const calculateDuration = (
  leave: LeavePolicyInputRow,
  start: Date,
  end: Date,
  ruleUnit: LeaveUnit,
  holidays: string[],
): { duration: number; isHalfDay: boolean } => {
  const durationOverride = leave.document_duration_days ?? leave.duration_days ?? null;
  const isHalfDay = durationOverride !== null && durationOverride > 0 && durationOverride < 1;
  if (isHalfDay) {
    const dateStr = formatLocalDate(start);
    if (!isHoliday(dateStr, holidays) && !isWeekend(start)) {
      return { duration: 0.5, isHalfDay: true };
    }
    return { duration: 0, isHalfDay: true };
  }

  if (ruleUnit === "business_days") {
    return { duration: countBusinessDays(start, end, holidays), isHalfDay: false };
  }
  return { duration: countCalendarDays(start, end), isHalfDay: false };
};

const calculateExceedDate = (
  start: Date,
  end: Date,
  remainingQuota: number,
  isHalfDay: boolean,
  ruleUnit: LeaveUnit,
  holidays: string[],
): Date | null => {
  if (isHalfDay) {
    return remainingQuota < 0.5 ? new Date(start) : null;
  }

  if (ruleUnit === "calendar_days") {
    const exceedDate = new Date(start);
    exceedDate.setDate(exceedDate.getDate() + Math.floor(remainingQuota));
    return exceedDate;
  }

  if (remainingQuota <= 0) {
    return new Date(start);
  }

  let daysFound = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = formatLocalDate(cursor);
    if (!isHoliday(dateStr, holidays) && !isWeekend(cursor)) {
      daysFound += 1;
      if (daysFound >= remainingQuota) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (daysFound >= remainingQuota) {
    cursor.setDate(cursor.getDate() + 1);
    return cursor;
  }

  return null;
};

const resolveEffectiveDate = (
  primary: string | Date | null | undefined,
  fallback: string | Date,
) => (primary ? new Date(primary) : new Date(fallback));

const normalizeLeaveTypeForPolicy = (leaveType: string): string => {
  return String(leaveType ?? "").trim().toLowerCase();
};

const normalizeTextKey = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const buildLeaveSeriesKey = (row: LeavePolicyInputRow): string | null => {
  const leaveType = normalizeLeaveTypeForPolicy(String(row.leave_type ?? ""));
  if (leaveType === "education") {
    const institution = normalizeTextKey(row.study_institution);
    const program = normalizeTextKey(row.study_program);
    const major = normalizeTextKey(row.study_major);
    if (!institution && !program && !major) return null;
    return `education:${institution}|${program}|${major}`;
  }

  // ordain / military: ใช้ remark เป็นตัวผูกเหตุการณ์เดียวกัน
  // ถ้าไม่ระบุ remark จะคงพฤติกรรมเดิมแบบ per_event
  if (leaveType === "ordain" || leaveType === "military") {
    const remark = normalizeTextKey(row.remark);
    if (!remark) return null;
    return `${leaveType}:${remark}`;
  }
  return null;
};

type NormalizedLeaveEntry = {
  row: LeavePolicyInputRow;
  start: Date;
  end: Date;
  seriesContext: {
    study_institution?: string | null;
    study_program?: string | null;
    study_major?: string | null;
  };
};

type LeaveInterval = {
  start: Date;
  end: Date;
};

type LeaveUsageState = {
  byType: Record<string, number>;
  bySeries: Record<string, number>;
};

type QuotaEvaluation = {
  limit: number | null;
  duration: number;
  overQuota: boolean;
  exceedDate: Date | null;
  seriesKey: string | null;
  useSeriesCumulative: boolean;
  useCumulativeQuota: boolean;
};

const normalizeLeavesInRange = (
  leaveRows: LeavePolicyInputRow[],
  rangeStartDate: Date | null,
  rangeEndDate: Date | null,
): NormalizedLeaveEntry[] => {
  const splitByReturnReportEvents = (
    start: Date,
    end: Date,
    events: LeavePolicyInputRow["return_report_events"],
    baseSeriesContext: NormalizedLeaveEntry["seriesContext"],
  ): Array<LeaveInterval & { seriesContext: NormalizedLeaveEntry["seriesContext"] }> => {
    if (!events || events.length === 0) return [{ start, end, seriesContext: baseSeriesContext }];
    const sorted = [...events]
      .map((event) => {
        const reportDate = new Date(event.report_date);
        const resumeDate =
          event.resume_date === null || event.resume_date === undefined
            ? null
            : new Date(event.resume_date);
        if (Number.isNaN(reportDate.getTime())) return null;
        if (resumeDate && Number.isNaN(resumeDate.getTime())) return null;
        return {
          reportDate,
          resumeDate,
          resume_study_institution: event.resume_study_institution ?? null,
          resume_study_program: event.resume_study_program ?? null,
          resume_study_major: event.resume_study_major ?? null,
        };
      })
      .filter((event): event is {
        reportDate: Date;
        resumeDate: Date | null;
        resume_study_institution: string | null;
        resume_study_program: string | null;
        resume_study_major: string | null;
      } => Boolean(event))
      .sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime());

    const intervals: Array<LeaveInterval & { seriesContext: NormalizedLeaveEntry["seriesContext"] }> = [];
    let cursor = new Date(start);
    let currentSeriesContext: NormalizedLeaveEntry["seriesContext"] = { ...baseSeriesContext };
    for (const event of sorted) {
      if (event.reportDate > end) break;

      const reportDate =
        event.reportDate < cursor
          ? new Date(cursor)
          : event.reportDate < start
            ? new Date(start)
            : event.reportDate;
      const prePauseEnd = new Date(reportDate);
      prePauseEnd.setDate(prePauseEnd.getDate() - 1);
      if (prePauseEnd >= cursor) {
        intervals.push({
          start: new Date(cursor),
          end: prePauseEnd,
          seriesContext: { ...currentSeriesContext },
        });
      }

      if (!event.resumeDate) {
        return intervals;
      }

      let resumeDate =
        event.resumeDate < cursor
          ? new Date(cursor)
          : event.resumeDate < start
            ? new Date(start)
            : new Date(event.resumeDate);
      if (resumeDate <= reportDate) {
        resumeDate = new Date(reportDate);
        resumeDate.setDate(resumeDate.getDate() + 1);
      }
      if (resumeDate > end) {
        return intervals;
      }
      currentSeriesContext = {
        study_institution:
          event.resume_study_institution ?? currentSeriesContext.study_institution ?? null,
        study_program:
          event.resume_study_program ?? currentSeriesContext.study_program ?? null,
        study_major:
          event.resume_study_major ?? currentSeriesContext.study_major ?? null,
      };
      cursor = resumeDate;
    }

    if (cursor <= end) {
      intervals.push({
        start: new Date(cursor),
        end: new Date(end),
        seriesContext: { ...currentSeriesContext },
      });
    }
    return intervals;
  };

  return leaveRows
    .flatMap((row) => {
      if (Number(row.is_no_pay ?? 0) === 1 || Number(row.pay_exception ?? 0) === 1) {
        return [];
      }
      const start = resolveEffectiveDate(row.document_start_date, row.start_date);
      const end = resolveEffectiveDate(row.document_end_date, row.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return [];
      }

      const clampedStart =
        rangeStartDate && start < rangeStartDate ? new Date(rangeStartDate) : start;
      const clampedEnd =
        rangeEndDate && end > rangeEndDate ? new Date(rangeEndDate) : end;
      if (clampedEnd < clampedStart) return [];

      const baseSeriesContext: NormalizedLeaveEntry["seriesContext"] = {
        study_institution: row.study_institution ?? null,
        study_program: row.study_program ?? null,
        study_major: row.study_major ?? null,
      };
      const intervals = splitByReturnReportEvents(
        clampedStart,
        clampedEnd,
        row.return_report_events,
        baseSeriesContext,
      );
      return intervals.map((interval: any) => ({
        row,
        start: interval.start,
        end: interval.end,
        seriesContext: interval.seriesContext,
      }));
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
};

const applyDynamicLimitOverrides = (
  leaveType: string,
  limit: number | null,
  leaveStart: Date,
  serviceStartDate: Date | null,
): number | null => {
  if (leaveType === "ordain" && serviceStartDate) {
    const serviceDays = Math.floor(
      (leaveStart.getTime() - serviceStartDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (serviceDays < 365) return 0;
  }

  if (leaveType === "personal" && serviceStartDate && limit !== null) {
    const leaveFiscalYear = getFiscalYear(leaveStart);
    const serviceFiscalYear = getFiscalYear(serviceStartDate);
    if (leaveFiscalYear === serviceFiscalYear) return 15;
  }

  return limit;
};

const getCurrentUsage = (
  usageState: LeaveUsageState,
  leaveType: string,
  seriesKey: string | null,
  useSeriesCumulative: boolean,
  isCumulativeRule: boolean,
): number => {
  if (useSeriesCumulative) return usageState.bySeries[seriesKey as string] ?? 0;
  if (isCumulativeRule) return usageState.byType[leaveType] ?? 0;
  return 0;
};

const updateUsage = (
  usageState: LeaveUsageState,
  leaveType: string,
  seriesKey: string | null,
  useSeriesCumulative: boolean,
  isCumulativeRule: boolean,
  nextUsage: number,
): void => {
  if (useSeriesCumulative) {
    usageState.bySeries[seriesKey as string] = nextUsage;
    return;
  }
  if (isCumulativeRule) {
    usageState.byType[leaveType] = nextUsage;
  }
};

const evaluateLeaveQuota = (
  entry: NormalizedLeaveEntry,
  rule: LeaveRule,
  quota: LeaveQuotaRow,
  serviceStartDate: Date | null,
  holidays: string[],
  usageState: LeaveUsageState,
): QuotaEvaluation => {
  const leaveType = normalizeLeaveTypeForPolicy(entry.row.leave_type);
  const baseLimit = resolveLeaveLimit(leaveType, rule.limit, quota);
  const limit = applyDynamicLimitOverrides(leaveType, baseLimit, entry.start, serviceStartDate);
  const { duration, isHalfDay } = calculateDuration(entry.row, entry.start, entry.end, rule.unit, holidays);
  const seriesRow: LeavePolicyInputRow = {
    ...entry.row,
    study_institution: entry.seriesContext.study_institution ?? entry.row.study_institution ?? null,
    study_program: entry.seriesContext.study_program ?? entry.row.study_program ?? null,
    study_major: entry.seriesContext.study_major ?? entry.row.study_major ?? null,
  };
  const seriesKey = buildLeaveSeriesKey(seriesRow);
  const useSeriesCumulative = Boolean(seriesKey);
  const isCumulativeRule = rule.rule_type === "cumulative";
  const useCumulativeQuota = isCumulativeRule || useSeriesCumulative;
  const currentUsage = getCurrentUsage(
    usageState,
    leaveType,
    seriesKey,
    useSeriesCumulative,
    isCumulativeRule,
  );
  const nextUsage = useCumulativeQuota ? currentUsage + duration : currentUsage;
  updateUsage(usageState, leaveType, seriesKey, useSeriesCumulative, isCumulativeRule, nextUsage);

  let overQuota = false;
  let exceedDate: Date | null = null;
  if (limit !== null) {
    if (useCumulativeQuota) {
      overQuota = currentUsage + duration > limit;
      if (overQuota) {
        const remainingQuota = Math.max(0, limit - currentUsage);
        exceedDate = calculateExceedDate(
          entry.start,
          entry.end,
          remainingQuota,
          isHalfDay,
          rule.unit,
          holidays,
        );
      }
    } else {
      overQuota = duration > limit;
      if (overQuota) {
        exceedDate = calculateExceedDate(
          entry.start,
          entry.end,
          limit,
          isHalfDay,
          rule.unit,
          holidays,
        );
      }
    }
  }

  return {
    limit,
    duration,
    overQuota,
    exceedDate,
    seriesKey,
    useSeriesCumulative,
    useCumulativeQuota,
  };
};

const updatePerLeave = (
  perLeave: LeaveQuotaStatus["perLeave"],
  row: LeavePolicyInputRow,
  sourceLeaveType: string,
  evaluation: QuotaEvaluation,
): void => {
  if (row.id === undefined) return;
  const existing = perLeave[row.id];
  const nextExceedDate = evaluation.exceedDate
    ? formatLocalDate(evaluation.exceedDate)
    : null;
  if (!existing) {
    perLeave[row.id] = {
      leaveType: sourceLeaveType,
      duration: evaluation.duration,
      limit: evaluation.limit,
      overQuota: evaluation.overQuota,
      exceedDate: nextExceedDate,
    };
    return;
  }

  existing.duration += evaluation.duration;
  existing.limit = evaluation.limit;
  existing.overQuota = existing.overQuota || evaluation.overQuota;
  if (!existing.exceedDate) {
    existing.exceedDate = nextExceedDate;
  } else if (nextExceedDate && nextExceedDate < existing.exceedDate) {
    existing.exceedDate = nextExceedDate;
  }
};

const updatePerType = (
  perType: Record<string, LeaveQuotaStatusByType>,
  leaveType: string,
  evaluation: QuotaEvaluation,
  usageState: LeaveUsageState,
): void => {
  if (!perType[leaveType]) {
    perType[leaveType] = {
      limit: evaluation.limit,
      used: 0,
      remaining: evaluation.useCumulativeQuota && evaluation.limit !== null ? evaluation.limit : null,
      overQuota: false,
      exceedDate: null,
    };
  }

  const item = perType[leaveType];
  item.used += evaluation.duration;

  if (evaluation.useCumulativeQuota && evaluation.limit !== null) {
    const usedForRemaining = evaluation.useSeriesCumulative
      ? (usageState.bySeries[evaluation.seriesKey as string] ?? 0)
      : (usageState.byType[leaveType] ?? 0);
    item.remaining = Math.max(0, evaluation.limit - usedForRemaining);
  }

  if (evaluation.overQuota) {
    item.overQuota = true;
    if (!item.exceedDate && evaluation.exceedDate) {
      item.exceedDate = formatLocalDate(evaluation.exceedDate);
    }
  }
  item.limit = evaluation.limit;
};

export function calculateLeaveQuotaStatus({
  leaveRows,
  holidays,
  quota,
  rules,
  serviceStartDate,
  rangeStart,
  rangeEnd,
}: {
  leaveRows: LeavePolicyInputRow[];
  holidays: string[];
  quota: LeaveQuotaRow;
  rules: LeaveRulesMap;
  serviceStartDate: Date | null;
  rangeStart?: Date;
  rangeEnd?: Date;
}): LeaveQuotaStatus {
  const rangeStartDate = rangeStart ? new Date(rangeStart) : null;
  const rangeEndDate = rangeEnd ? new Date(rangeEnd) : null;
  const normalizedLeaves = normalizeLeavesInRange(leaveRows, rangeStartDate, rangeEndDate);
  const usageState: LeaveUsageState = { byType: {}, bySeries: {} };
  const perType: Record<string, LeaveQuotaStatusByType> = {};
  const perLeave: LeaveQuotaStatus["perLeave"] = {};

  for (const entry of normalizedLeaves) {
    const row = entry.row;
    const leaveType = normalizeLeaveTypeForPolicy(row.leave_type);
    const sourceLeaveType = row.leave_type;
    const rule = rules[leaveType];
    if (!rule) continue;
    const evaluation = evaluateLeaveQuota(
      entry,
      rule,
      quota,
      serviceStartDate,
      holidays,
      usageState,
    );
    updatePerLeave(perLeave, row, sourceLeaveType, evaluation);
    updatePerType(perType, leaveType, evaluation, usageState);
  }

  return { perType, perLeave };
}

export async function getLeaveQuotaStatus(citizenId: string, fiscalYear: number): Promise<LeaveQuotaStatus> {
  const cacheKey = `${citizenId}:${fiscalYear}`;
  const cached = quotaCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const [leaveRows, quotaRow, holidayRows, serviceDates] = await Promise.all([
    repository.listLeaveManagementRowsForQuota(citizenId, fiscalYear),
    repository.findQuotaRow(citizenId, fiscalYear),
    repository.findHolidaysForFiscalYear(fiscalYear),
    repository.findEmployeeServiceDates(citizenId),
  ]);
  const leaveIds = (leaveRows ?? [])
    .map((row: any) => Number(row.id))
    .filter((id: number) => Number.isFinite(id) && id > 0);
  const returnEvents = await repository.listLeaveReturnReportEventsByLeaveIds(leaveIds);
  const eventMap = new Map<number, Array<{
    report_date: string;
    resume_date: string | null;
    resume_study_institution: string | null;
    resume_study_program: string | null;
    resume_study_major: string | null;
  }>>();
  for (const event of returnEvents) {
    const leaveId = Number((event as any).leave_record_id);
    if (!Number.isFinite(leaveId)) continue;
    if (!eventMap.has(leaveId)) eventMap.set(leaveId, []);
    eventMap.get(leaveId)!.push({
      report_date: String((event as any).report_date),
      resume_date:
        (event as any).resume_date === null || (event as any).resume_date === undefined
          ? null
          : String((event as any).resume_date),
      resume_study_institution:
        (event as any).resume_study_institution === null || (event as any).resume_study_institution === undefined
          ? null
          : String((event as any).resume_study_institution),
      resume_study_program:
        (event as any).resume_study_program === null || (event as any).resume_study_program === undefined
          ? null
          : String((event as any).resume_study_program),
      resume_study_major:
        (event as any).resume_study_major === null || (event as any).resume_study_major === undefined
          ? null
          : String((event as any).resume_study_major),
    });
  }
  const leaveRowsWithEvents = (leaveRows ?? []).map((row: any) => ({
    ...row,
    return_report_events: eventMap.get(Number(row.id)) ?? [],
  }));

  let serviceStartDate: Date | null = null;
  if (serviceDates?.start_work_date) {
    serviceStartDate = new Date(serviceDates.start_work_date);
  } else if (serviceDates?.first_entry_date) {
    serviceStartDate = new Date(serviceDates.first_entry_date);
  }

  const result = calculateLeaveQuotaStatus({
    leaveRows: leaveRowsWithEvents,
    holidays: holidayRows ?? [],
    quota: quotaRow ?? {},
    rules: LEAVE_RULES,
    serviceStartDate,
  });

  quotaCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}
