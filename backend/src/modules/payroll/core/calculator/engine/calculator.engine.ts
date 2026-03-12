import { Decimal } from "decimal.js";
import type {
  DeductionResult,
  QuotaDecision,
  ReturnReportRow,
} from "@/modules/payroll/core/deductions/deductions.js";
import { formatLocalDate, makeLocalDate } from "@/modules/payroll/core/utils/date.utils.js";
import { calculateLeaveQuotaStatus } from "@/modules/leave-management/services/leave-domain.service.js";
import type { WorkPeriod } from "@/modules/payroll/core/calculator/facade/calculator.work-period.js";
import type { EligibilityRow, LicenseRow } from "@/modules/payroll/core/calculator/facade/calculator.js";

export type EligibilityInfo = Readonly<{
  effectiveTs: number;
  expiryTs: number;
  effectiveDate: string;
  expiryDate: string | null;
  rate: number;
  rateId: number | null;
  professionCode: string | null;
  groupNo: number | null;
  itemNo: string | null;
  subItemNo: string | null;
}>;

export type EligibilityState = {
  index: number;
  current: EligibilityInfo | null;
};

export type PaymentTotals = {
  totalPayment: Decimal;
  validLicenseDays: number;
  totalDeductionDays: number;
  daysCounted: number;
  lastRateSnapshot: number;
  lastMasterRateId: number | null;
  lastProfessionCode: string | null;
  lastGroupNo: number | null;
  lastItemNo: string | null;
};

export type QuotaInfoByLeaveId = Map<
  number,
  { limit: number | null; duration: number; exceedDate: string | null; leaveType: string }
>;

export const buildEligibilities = (rows: EligibilityRow[]): EligibilityInfo[] =>
  rows
    .map((row) => ({
      effectiveTs: new Date(row.effective_date).getTime(),
      expiryTs: row.expiry_date
        ? new Date(row.expiry_date).getTime()
        : makeLocalDate(9999, 11, 31).getTime(),
      effectiveDate: formatLocalDate(row.effective_date),
      expiryDate: row.expiry_date ? formatLocalDate(row.expiry_date) : null,
      rate: Number(row.rate),
      rateId: (row as any).rate_id ?? null,
      professionCode:
        row.profession_code !== undefined && row.profession_code !== null
          ? String(row.profession_code)
          : null,
      groupNo:
        row.group_no !== undefined && row.group_no !== null
          ? Number(row.group_no)
          : null,
      itemNo:
        row.item_no !== undefined && row.item_no !== null
          ? String(row.item_no)
          : null,
      subItemNo:
        row.sub_item_no !== undefined && row.sub_item_no !== null
          ? String(row.sub_item_no)
          : null,
    }))
    .sort((a, b) => a.effectiveTs - b.effectiveTs);

export const getActiveEligibility = (
  state: EligibilityState,
  eligibilities: EligibilityInfo[],
  dayTs: number,
): EligibilityInfo | null => {
  while (
    state.index < eligibilities.length &&
    eligibilities[state.index].effectiveTs <= dayTs
  ) {
    state.current = eligibilities[state.index];
    state.index += 1;
  }
  if (state.current && state.current.expiryTs >= dayTs) {
    return state.current;
  }
  return null;
};

export const applyDailyTotals = (
  totals: PaymentTotals,
  currentRate: number,
  hasLicense: boolean,
  deductionWeight: number,
  daysInMonth: number,
) => {
  if (hasLicense) totals.validLicenseDays += 1;

  const hasEligibilityRate = currentRate > 0;
  const isPayEligible = hasLicense && hasEligibilityRate;

  let eligibleWeight = isPayEligible ? 1 : 0;
  eligibleWeight -= deductionWeight;
  if (eligibleWeight < 0) eligibleWeight = 0;

  if (isPayEligible && deductionWeight > 0) totals.totalDeductionDays += deductionWeight;
  if (eligibleWeight > 0) totals.daysCounted += eligibleWeight;

  const dailyRate = new Decimal(currentRate || 0).div(daysInMonth);
  totals.totalPayment = totals.totalPayment.plus(dailyRate.mul(eligibleWeight));
};

export function createLicenseChecker(
  licenses: LicenseRow[],
  _positionName = "",
): (dateStr: string) => boolean {
  if (!licenses || licenses.length === 0) {
    return () => false;
  }

  const ranges = licenses
    .filter((lic) => {
      // Use valid date range as primary signal.
      // EXPIRED rows may still cover earlier dates in the same month.
      // Exclude explicit invalid statuses only.
      const status = String(lic.status ?? "ACTIVE").toUpperCase();
      if (status === "REVOKED" || status === "CANCELLED") return false;
      const start = formatLocalDate(lic.valid_from);
      const end = formatLocalDate(lic.valid_until);
      return !!start && !!end && start <= end;
    })
    .map((lic) => ({
      start: formatLocalDate(lic.valid_from),
      end: formatLocalDate(lic.valid_until),
    }));

  if (ranges.length === 0) {
    return () => false;
  }

  return (dateStr: string) =>
    ranges.some((range) => dateStr >= range.start && dateStr <= range.end);
}

export const buildReturnReportsMap = (rows: ReturnReportRow[]): Map<number, Date> => {
  const returnReports = new Map<number, Date>();
  for (const row of rows) {
    const existing = returnReports.get(row.leave_record_id);
    const candidate = new Date(row.return_date);
    if (!existing || candidate < existing) {
      returnReports.set(row.leave_record_id, candidate);
    }
  }
  return returnReports;
};

export const buildQuotaMaps = (quotaStatus: ReturnType<typeof calculateLeaveQuotaStatus>): {
  quotaDecisions: Map<number, QuotaDecision>;
  quotaInfoByLeaveId: QuotaInfoByLeaveId;
} => {
  const quotaDecisions = new Map<number, QuotaDecision>();
  const quotaInfoByLeaveId: QuotaInfoByLeaveId = new Map();
  Object.entries(quotaStatus.perLeave).forEach(([leaveId, info]) => {
    const id = Number(leaveId);
    if (Number.isNaN(id)) return;
    quotaDecisions.set(id, {
      overQuota: info.overQuota,
      exceedDate: info.exceedDate ? new Date(info.exceedDate) : null,
    });
    quotaInfoByLeaveId.set(id, {
      limit: info.limit === null || info.limit === undefined ? null : Number(info.limit),
      duration: Number(info.duration ?? 0),
      exceedDate: info.exceedDate ?? null,
      leaveType: String(info.leaveType ?? ""),
    });
  });
  return { quotaDecisions, quotaInfoByLeaveId };
};

export const buildWorkDayWindow = (periods: WorkPeriod[]): {
  orderedPeriods: WorkPeriod[];
  workDaySet: Set<string>;
  firstWorkDay: string | null;
  lastWorkDay: string | null;
} => {
  const orderedPeriods = [...periods].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const workDaySet = new Set<string>();
  for (const period of orderedPeriods) {
    for (
      let d = new Date(period.start);
      d <= period.end;
      d.setDate(d.getDate() + 1)
    ) {
      workDaySet.add(formatLocalDate(d));
    }
  }

  let firstWorkDay: string | null = null;
  let lastWorkDay: string | null = null;
  for (const day of workDaySet) {
    if (!firstWorkDay || day < firstWorkDay) firstWorkDay = day;
    if (!lastWorkDay || day > lastWorkDay) lastWorkDay = day;
  }
  return { orderedPeriods, workDaySet, firstWorkDay, lastWorkDay };
};

export const sumDeductionDaysInMonth = (deductionResult: DeductionResult): number => {
  return Array.from(deductionResult.deductionMap.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
};
