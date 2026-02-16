import { countBusinessDays, countCalendarDays, formatLocalDate, isHoliday } from "@/modules/payroll/core/utils.js";
import { LEAVE_RULES } from "@/modules/payroll/payroll.constants.js";
import type { LeaveUnit, LeaveRuleType } from "@/modules/payroll/payroll.constants.js";
import { LeaveRecordsRepository } from "../repositories/leave-records.repository.js";

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

export type LeaveQuotaLeaveRow = {
  id?: number;
  citizen_id?: string;
  leave_type: string;
  start_date: string | Date;
  end_date: string | Date;
  document_start_date?: string | Date | null;
  document_end_date?: string | Date | null;
  document_duration_days?: number | null;
  duration_days?: number | null;
  is_no_pay?: number | null;
  pay_exception?: number | null;
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
const repository = new LeaveRecordsRepository();

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
  leave: LeaveQuotaLeaveRow,
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

export function calculateLeaveQuotaStatus({
  leaveRows,
  holidays,
  quota,
  rules,
  serviceStartDate,
  rangeStart,
  rangeEnd,
}: {
  leaveRows: LeaveQuotaLeaveRow[];
  holidays: string[];
  quota: LeaveQuotaRow;
  rules: LeaveRulesMap;
  serviceStartDate: Date | null;
  rangeStart?: Date;
  rangeEnd?: Date;
}): LeaveQuotaStatus {
  const rangeStartDate = rangeStart ? new Date(rangeStart) : null;
  const rangeEndDate = rangeEnd ? new Date(rangeEnd) : null;
  const normalizedLeaves = leaveRows
    .map((row) => {
      if (Number(row.is_no_pay ?? 0) === 1 || Number(row.pay_exception ?? 0) === 1) {
        return null;
      }
      const start = resolveEffectiveDate(row.document_start_date, row.start_date);
      const end = resolveEffectiveDate(row.document_end_date, row.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return null;
      }

      const clampedStart =
        rangeStartDate && start < rangeStartDate ? new Date(rangeStartDate) : start;
      const clampedEnd =
        rangeEndDate && end > rangeEndDate ? new Date(rangeEndDate) : end;
      if (clampedEnd < clampedStart) {
        return null;
      }

      return { row, start: clampedStart, end: clampedEnd };
    })
    .filter(Boolean)
    .sort((a, b) => a!.start.getTime() - b!.start.getTime());

  const usage: Record<string, number> = {};
  const perType: Record<string, LeaveQuotaStatusByType> = {};
  const perLeave: LeaveQuotaStatus["perLeave"] = {};

  for (const entry of normalizedLeaves) {
    const row = entry!.row;
    const leaveType = row.leave_type;
    const rule = rules[leaveType];
    if (!rule) continue;
    const start = entry!.start;
    const end = entry!.end;

    let limit = resolveLeaveLimit(leaveType, rule.limit, quota);

    if (leaveType === "ordain" && serviceStartDate) {
      const serviceDays = Math.floor((start.getTime() - serviceStartDate.getTime()) / (1000 * 60 * 60 * 24));
      if (serviceDays < 365) {
        limit = 0;
      }
    }

    if (leaveType === "personal" && serviceStartDate && limit !== null) {
      const leaveFiscalYear = getFiscalYear(start);
      const serviceFiscalYear = getFiscalYear(serviceStartDate);
      if (leaveFiscalYear === serviceFiscalYear) {
        limit = 15;
      }
    }

    const { duration, isHalfDay } = calculateDuration(row, start, end, rule.unit, holidays);
    const currentUsage = usage[leaveType] ?? 0;
    const nextUsage = rule.rule_type === "cumulative" ? currentUsage + duration : currentUsage;

    if (rule.rule_type === "cumulative") {
      usage[leaveType] = nextUsage;
    }

    let overQuota = false;
    let exceedDate: Date | null = null;
    if (limit !== null) {
      if (rule.rule_type === "cumulative") {
        overQuota = currentUsage + duration > limit;
        if (overQuota) {
          const remainingQuota = Math.max(0, limit - currentUsage);
          exceedDate = calculateExceedDate(start, end, remainingQuota, isHalfDay, rule.unit, holidays);
        }
      } else {
        overQuota = duration > limit;
        if (overQuota) {
          exceedDate = calculateExceedDate(start, end, limit, isHalfDay, rule.unit, holidays);
        }
      }
    }

    if (row.id !== undefined) {
      perLeave[row.id] = {
        leaveType,
        duration,
        limit,
        overQuota,
        exceedDate: exceedDate ? formatLocalDate(exceedDate) : null,
      };
    }

    if (!perType[leaveType]) {
      perType[leaveType] = {
        limit,
        used: 0,
        remaining: rule.rule_type === "per_event" ? null : limit !== null ? limit : null,
        overQuota: false,
        exceedDate: null,
      };
    }

    perType[leaveType].used += duration;
    if (rule.rule_type === "cumulative") {
      if (limit !== null) {
        perType[leaveType].remaining = Math.max(0, limit - (usage[leaveType] ?? 0));
      }
    }

    if (overQuota) {
      perType[leaveType].overQuota = true;
      if (!perType[leaveType].exceedDate && exceedDate) {
        perType[leaveType].exceedDate = formatLocalDate(exceedDate);
      }
    }

    // Keep limit updated in case it is overridden by rules (personal/ordain).
    perType[leaveType].limit = limit;
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
    repository.listLeaveRowsForQuota(citizenId, fiscalYear),
    repository.findQuotaRow(citizenId, fiscalYear),
    repository.findHolidaysForFiscalYear(fiscalYear),
    repository.findEmployeeServiceDates(citizenId),
  ]);

  const serviceStartDate = serviceDates?.start_work_date
    ? new Date(serviceDates.start_work_date)
    : serviceDates?.first_entry_date
      ? new Date(serviceDates.first_entry_date)
      : null;

  const result = calculateLeaveQuotaStatus({
    leaveRows,
    holidays: holidayRows ?? [],
    quota: quotaRow ?? {},
    rules: LEAVE_RULES,
    serviceStartDate,
  });

  quotaCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}
