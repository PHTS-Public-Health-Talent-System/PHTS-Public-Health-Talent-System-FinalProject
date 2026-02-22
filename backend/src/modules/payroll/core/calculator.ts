import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { Decimal } from "decimal.js";
import pool from '@config/database.js';
import {
  calculateDeductions,
  DeductionReason,
  DeductionReasonCode,
  DeductionResult,
  LeaveRow,
  NoSalaryPeriodRow,
  QuotaDecision,
  QuotaRow,
  ReturnReportRow,
} from '@/modules/payroll/core/deductions.js';
import { formatLocalDate, makeLocalDate } from '@/modules/payroll/core/utils.js';
import {
  LEAVE_RULES,
  RETURN_REPORT_REQUIRED_LEAVE_TYPES,
} from '@/modules/payroll/payroll.constants.js';
import { calculateLeaveQuotaStatus } from '@/modules/leave-records/services/leave-domain.service.js';

export interface EligibilityRow extends RowDataPacket {
  effective_date: Date | string;
  expiry_date: Date | string | null;
  rate: number;
  profession_code?: string | null;
  group_no?: number | null;
  item_no?: string | null;
}

export interface MovementRow extends RowDataPacket {
  effective_date: Date | string;
  movement_type: string;
}

export interface LicenseRow extends RowDataPacket {
  valid_from: Date | string;
  valid_until: Date | string;
  status: string;
  license_name?: string;
  license_type?: string;
  occupation_name?: string;
}

export interface HolidayRow extends RowDataPacket {
  holiday_date: Date | string;
}

export interface EmployeeRow extends RowDataPacket {
  position_name?: string | null;
  first_entry_date?: Date | string | null;
  start_work_date?: Date | string | null;
}

export interface CalculationResult {
  netPayment: number;
  totalDeductionDays: number;
  validLicenseDays: number;
  eligibleDays: number;
  remark: string;
  masterRateId: number | null;
  rateSnapshot: number;
  ptsGroupNo?: number | null;
  ptsItemNo?: string | null;
  professionCode?: string | null;
  retroactiveTotal?: number;
  retroDetails?: RetroDetail[];
  checks?: PayrollCheck[];
}

export interface RetroDetail {
  month: number;
  year: number;
  diff: number;
  remark: string;
}

export type PayrollCheckSeverity = "BLOCKER" | "WARNING";
export type PayrollCheckCode =
  | "NO_PAY"
  | "OVER_QUOTA"
  | "ELIGIBILITY_GAP"
  | "NO_LICENSE"
  | "NOT_WORKING"
  | "PENDING_RETURN_REPORT"
  | "MISSING_START_WORK_DATE"
  | "RETRO_DEDUCT";

export type PayrollCheckEvidence =
  | {
      type: "leave";
      leave_record_id: number;
      leave_type: string;
      start_date: string;
      end_date: string;
      is_no_pay?: boolean;
      over_quota?: boolean;
      exceed_date?: string | null;
      return_report_status?: string | null;
      // Extra context for OVER_QUOTA / leave deductions (from quota engine).
      quota_limit?: number | null;
      leave_duration?: number | null;
      quota_unit?: string | null;
    }
  | {
      type: "eligibility";
      effective_date: string;
      expiry_date: string | null;
      rate: number;
      rate_id?: number | null;
    }
  | {
      type: "license";
      valid_from: string;
      valid_until: string;
      status: string;
      license_name?: string;
      license_type?: string;
      occupation_name?: string;
    }
  | {
      type: "movement";
      movement_type: string;
      effective_date: string;
    }
  | {
      type: "retro";
      reference_month: number;
      reference_year: number;
      diff: number;
      remark: string;
    };

export type PayrollCheck = {
  code: PayrollCheckCode;
  severity: PayrollCheckSeverity;
  title: string;
  summary: string;
  impactDays: number;
  impactAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  evidence: PayrollCheckEvidence[];
};

interface WorkPeriod {
  start: Date;
  end: Date;
}

type EligibilityInfo = Readonly<{
  effectiveTs: number;
  expiryTs: number;
  effectiveDate: string;
  expiryDate: string | null;
  rate: number;
  rateId: number | null;
  professionCode: string | null;
  groupNo: number | null;
  itemNo: string | null;
}>;

type EligibilityState = {
  index: number;
  current: EligibilityInfo | null;
};

type PaymentTotals = {
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

const buildEligibilities = (rows: EligibilityRow[]): EligibilityInfo[] =>
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
    }))
    .sort((a, b) => a.effectiveTs - b.effectiveTs);

const getActiveEligibility = (
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

const applyDailyTotals = (
  totals: PaymentTotals,
  currentRate: number,
  hasLicense: boolean,
  deductionWeight: number,
  daysInMonth: number,
) => {
  if (hasLicense) totals.validLicenseDays += 1;

  // Only count "eligible days" when the day has an active eligibility rate AND a valid license.
  // This aligns UI meaning: "วันมีสิทธิ" should reflect days that can actually be paid.
  const hasEligibilityRate = currentRate > 0;
  const isPayEligible = hasLicense && hasEligibilityRate;

  let eligibleWeight = isPayEligible ? 1 : 0;
  eligibleWeight -= deductionWeight;
  if (eligibleWeight < 0) eligibleWeight = 0;

  // "วันถูกหัก" should represent deduction against payable/eligible days, not days outside eligibility.
  if (isPayEligible && deductionWeight > 0) totals.totalDeductionDays += deductionWeight;
  if (eligibleWeight > 0) totals.daysCounted += eligibleWeight;

  const dailyRate = new Decimal(currentRate || 0).div(daysInMonth);
  totals.totalPayment = totals.totalPayment.plus(dailyRate.mul(eligibleWeight));
};

function createLicenseChecker(
  licenses: LicenseRow[],
  _positionName = "",
): (dateStr: string) => boolean {
  if (!licenses || licenses.length === 0) {
    return () => false;
  }

  const ranges = licenses
    .filter(
      (lic) => ((lic.status || "ACTIVE") as string).toUpperCase() === "ACTIVE",
    )
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

// Batch interface
export interface EmployeeBatchData {
  eligibilityRows: RowDataPacket[];
  movementRows: RowDataPacket[];
  employeeRow: RowDataPacket;
  licenseRows: RowDataPacket[];
  leaveRows: RowDataPacket[];
  quotaRow: RowDataPacket | null;
  holidays: string[];
  noSalaryPeriods?: RowDataPacket[];
  returnReportRows?: RowDataPacket[];
}

const normalizeReasonCode = (code: DeductionReasonCode): PayrollCheckCode => {
  switch (code) {
    case "NO_PAY":
      return "NO_PAY";
    case "OVER_QUOTA":
      return "OVER_QUOTA";
  }
};

const reasonSeverity = (code: PayrollCheckCode): PayrollCheckSeverity => {
  switch (code) {
    case "NO_PAY":
      return "BLOCKER";
    case "NO_LICENSE":
      return "BLOCKER";
    case "MISSING_START_WORK_DATE":
      return "BLOCKER";
    default:
      return "WARNING";
  }
};

const checkTitle = (code: PayrollCheckCode): string => {
  switch (code) {
    case "NO_PAY":
      return "ช่วง no-pay (ไม่รับเงินเดือน)";
    case "OVER_QUOTA":
      return "ลาเกินโควต้า";
    case "ELIGIBILITY_GAP":
      return "สิทธิเริ่มมีผลกลางเดือน / สิทธิไม่ครอบคลุมทั้งงวด";
    case "NO_LICENSE":
      return "ใบอนุญาตไม่ ACTIVE บางช่วง";
    case "NOT_WORKING":
      return "ไม่ได้ปฏิบัติงานตลอดเดือน";
    case "PENDING_RETURN_REPORT":
      return "ยังไม่รายงานตัวกลับ";
    case "MISSING_START_WORK_DATE":
      return "ไม่พบข้อมูลวันเริ่มงาน";
    case "RETRO_DEDUCT":
      return "ตกเบิกย้อนหลัง (หัก)";
  }
};

type CheckAgg = {
  code: PayrollCheckCode;
  impactDays: number;
  impactAmount: number;
  startDate: string | null;
  endDate: string | null;
  // Optional, used for checks that need more explicit human-readable ranges.
  rangeLabel?: string;
  evidence: PayrollCheckEvidence[];
  evidenceKeySet: Set<string>;
};

const pushEvidence = (agg: CheckAgg, key: string, evidence: PayrollCheckEvidence) => {
  if (agg.evidenceKeySet.has(key)) return;
  agg.evidenceKeySet.add(key);
  agg.evidence.push(evidence);
};

const parseLocalDateString = (value: string): Date => {
  const [yy, mm, dd] = value.split("-").map((v) => Number(v));
  return makeLocalDate(yy, (mm ?? 1) - 1, dd ?? 1);
};

const addDaysToLocalDateString = (value: string, deltaDays: number): string => {
  const d = parseLocalDateString(value);
  d.setDate(d.getDate() + deltaDays);
  return formatLocalDate(d);
};

type QuotaInfoByLeaveId = Map<
  number,
  { limit: number | null; duration: number; exceedDate: string | null; leaveType: string }
>;

const buildReturnReportsMap = (rows: ReturnReportRow[]): Map<number, Date> => {
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

const buildQuotaMaps = (quotaStatus: ReturnType<typeof calculateLeaveQuotaStatus>): {
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

const buildWorkDayWindow = (periods: WorkPeriod[]): {
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

type EnsureAggFn = (code: PayrollCheckCode) => CheckAgg;
type UpdateAggRangeFn = (agg: CheckAgg, dateStr: string) => void;

const addPendingReturnReportChecks = (
  mergedLeaves: LeaveRow[],
  endOfMonth: Date,
  ensureAgg: EnsureAggFn,
  updateAggRange: UpdateAggRangeFn,
): void => {
  const returnReportRequiredTypes = new Set<string>(RETURN_REPORT_REQUIRED_LEAVE_TYPES);
  const monthEndStr = formatLocalDate(endOfMonth);
  for (const leave of mergedLeaves) {
    const leaveType = String(leave.leave_type ?? "");
    if (!returnReportRequiredTypes.has(leaveType)) continue;
    if (leave.id === undefined || leave.id === null || Number(leave.id) <= 0) continue;

    const status = String((leave as any).return_report_status ?? "").toUpperCase();
    if (status === "DONE") continue;

    const leaveEndStr = formatLocalDate((leave as any).document_end_date ?? leave.end_date);
    if (!leaveEndStr || leaveEndStr > monthEndStr) continue;

    const agg = ensureAgg("PENDING_RETURN_REPORT");
    agg.impactDays += 1;
    updateAggRange(agg, leaveEndStr);
    pushEvidence(agg, `leave:${leave.id}:pending_return`, {
      type: "leave",
      leave_record_id: Number(leave.id),
      leave_type: leaveType,
      start_date: formatLocalDate((leave as any).document_start_date ?? leave.start_date),
      end_date: leaveEndStr,
      return_report_status: status || null,
    });
  }
};

type CheckAccumulator = {
  checkAggs: Map<PayrollCheckCode, CheckAgg>;
  ensureAgg: EnsureAggFn;
  updateAggRange: UpdateAggRangeFn;
};

type EligibilityCoverage = {
  daysWithEligibilityRate: number;
  firstEligibilityDay: string | null;
  lastEligibilityDay: string | null;
};

const createCheckAccumulator = (): CheckAccumulator => {
  const checkAggs = new Map<PayrollCheckCode, CheckAgg>();
  const ensureAgg = (code: PayrollCheckCode): CheckAgg => {
    const existing = checkAggs.get(code);
    if (existing) return existing;
    const next: CheckAgg = {
      code,
      impactDays: 0,
      impactAmount: 0,
      startDate: null,
      endDate: null,
      evidence: [],
      evidenceKeySet: new Set(),
    };
    checkAggs.set(code, next);
    return next;
  };
  const updateAggRange = (agg: CheckAgg, dateStr: string): void => {
    if (!agg.startDate || dateStr < agg.startDate) agg.startDate = dateStr;
    if (!agg.endDate || dateStr > agg.endDate) agg.endDate = dateStr;
  };
  return { checkAggs, ensureAgg, updateAggRange };
};

const buildLeaveByIdMap = (mergedLeaves: LeaveRow[]): Map<number, LeaveRow> => {
  const leaveById = new Map<number, LeaveRow>();
  for (const leave of mergedLeaves) {
    if (leave.id !== undefined && leave.id !== null) leaveById.set(Number(leave.id), leave);
  }
  return leaveById;
};

type MissingStartWorkDateContext = {
  startWorkDateStr: string | null;
  workDaySet: Set<string>;
  daysInMonth: number;
  firstWorkDay: string | null;
  lastWorkDay: string | null;
  startOfMonth: Date;
  endOfMonth: Date;
  ensureAgg: EnsureAggFn;
};

const markMissingStartWorkDateCheck = ({
  startWorkDateStr,
  workDaySet,
  daysInMonth,
  firstWorkDay,
  lastWorkDay,
  startOfMonth,
  endOfMonth,
  ensureAgg,
}: MissingStartWorkDateContext): void => {
  if (startWorkDateStr) return;
  const agg = ensureAgg("MISSING_START_WORK_DATE");
  agg.impactDays = workDaySet.size > 0 ? workDaySet.size : daysInMonth;
  agg.impactAmount = 0;
  agg.startDate = firstWorkDay ?? formatLocalDate(startOfMonth);
  agg.endDate = lastWorkDay ?? formatLocalDate(endOfMonth);
};

const updateEligibilityCoverage = (
  coverage: EligibilityCoverage,
  dateStr: string,
  currentRate: number,
): void => {
  if (currentRate <= 0) return;
  coverage.daysWithEligibilityRate += 1;
  if (!coverage.firstEligibilityDay || dateStr < coverage.firstEligibilityDay) {
    coverage.firstEligibilityDay = dateStr;
  }
  if (!coverage.lastEligibilityDay || dateStr > coverage.lastEligibilityDay) {
    coverage.lastEligibilityDay = dateStr;
  }
};

const resolveReasonLeaveType = (
  reason: DeductionReason,
  leave: LeaveRow | undefined,
  quotaInfo: { leaveType: string } | undefined,
): string => {
  if (reason.leave_type) return String(reason.leave_type);
  if (quotaInfo?.leaveType) return String(quotaInfo.leaveType);
  if (leave) return String(leave.leave_type);
  return "unknown";
};

type ReasonImpactContext = {
  ensureAgg: EnsureAggFn;
  updateAggRange: UpdateAggRangeFn;
  leaveById: Map<number, LeaveRow>;
  quotaInfoByLeaveId: QuotaInfoByLeaveId;
};

const applyReasonImpact = (
  reason: DeductionReason,
  dateStr: string,
  dailyRate: number,
  context: ReasonImpactContext,
): void => {
  const { ensureAgg, updateAggRange, leaveById, quotaInfoByLeaveId } = context;
  const code = normalizeReasonCode(reason.code);
  const agg = ensureAgg(code);
  agg.impactDays += reason.weight;
  agg.impactAmount += dailyRate * reason.weight;
  updateAggRange(agg, dateStr);

  if (!reason.leave_record_id) return;
  const leaveId = Number(reason.leave_record_id);
  const leave = leaveById.get(leaveId);
  const quotaInfo = quotaInfoByLeaveId.get(leaveId);
  const leaveStartRaw = leave ? ((leave as any).document_start_date ?? leave.start_date) : null;
  const leaveEndRaw = leave ? ((leave as any).document_end_date ?? leave.end_date) : null;
  const start = leaveStartRaw ? formatLocalDate(leaveStartRaw) : dateStr;
  const end = leaveEndRaw ? formatLocalDate(leaveEndRaw) : dateStr;
  const leaveType = resolveReasonLeaveType(reason, leave, quotaInfo);

  pushEvidence(agg, `leave:${reason.leave_record_id}:${code}`, {
    type: "leave",
    leave_record_id: leaveId,
    leave_type: leaveType,
    start_date: start,
    end_date: end,
    is_no_pay: code === "NO_PAY",
    over_quota: code === "OVER_QUOTA",
    exceed_date: reason.exceed_date
      ? formatLocalDate(reason.exceed_date)
      : quotaInfo?.exceedDate ?? null,
    quota_limit: quotaInfo?.limit ?? null,
    leave_duration: Number.isFinite(quotaInfo?.duration ?? NaN)
      ? Number(quotaInfo?.duration ?? 0)
      : null,
    quota_unit: LEAVE_RULES[leaveType]?.unit ?? null,
  });
};

type DailyCheckImpactInput = {
  currentRate: number;
  hasLicense: boolean;
  reasons: DeductionReason[];
  deductionWeight: number;
  dateStr: string;
};

type DailyCheckImpactContext = ReasonImpactContext & {
  daysInMonth: number;
};

const applyDailyCheckImpact = (
  input: DailyCheckImpactInput,
  context: DailyCheckImpactContext,
): void => {
  const { currentRate, hasLicense, reasons, deductionWeight, dateStr } = input;
  const { ensureAgg, updateAggRange, daysInMonth } = context;
  if (currentRate <= 0) return;
  const dailyRate = Number(new Decimal(currentRate).div(daysInMonth).toFixed(10));

  if (!hasLicense) {
    const agg = ensureAgg("NO_LICENSE");
    agg.impactDays += 1;
    agg.impactAmount += dailyRate;
    updateAggRange(agg, dateStr);
    return;
  }

  if (reasons.length === 0) {
    if (deductionWeight <= 0) return;
    const agg = ensureAgg("OVER_QUOTA");
    agg.impactDays += deductionWeight;
    agg.impactAmount += dailyRate * deductionWeight;
    updateAggRange(agg, dateStr);
    return;
  }

  for (const reason of reasons) applyReasonImpact(reason, dateStr, dailyRate, context);
};

type DailyPeriodsContext = {
  orderedPeriods: WorkPeriod[];
  eligibilities: EligibilityInfo[];
  eligibilityState: EligibilityState;
  totals: PaymentTotals;
  licenseChecker: (dateStr: string) => boolean;
  reasonsByDate: Map<string, DeductionReason[]>;
  deductionMap: Map<string, number>;
  dailyCheckContext: DailyCheckImpactContext;
};

const processDailyPeriods = ({
  orderedPeriods,
  eligibilities,
  eligibilityState,
  totals,
  licenseChecker,
  reasonsByDate,
  deductionMap,
  dailyCheckContext,
}: DailyPeriodsContext): EligibilityCoverage => {
  const coverage: EligibilityCoverage = {
    daysWithEligibilityRate: 0,
    firstEligibilityDay: null,
    lastEligibilityDay: null,
  };

  for (const period of orderedPeriods) {
    for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatLocalDate(d);
      const activeEligibility = getActiveEligibility(eligibilityState, eligibilities, d.getTime());
      const currentRate = activeEligibility ? activeEligibility.rate : 0;

      if (activeEligibility) {
        totals.lastRateSnapshot = currentRate;
        totals.lastMasterRateId = activeEligibility.rateId;
        totals.lastProfessionCode = activeEligibility.professionCode;
        totals.lastGroupNo = activeEligibility.groupNo;
        totals.lastItemNo = activeEligibility.itemNo;
      }
      updateEligibilityCoverage(coverage, dateStr, currentRate);

      const hasLicense = licenseChecker(dateStr);
      const reasons = reasonsByDate.get(dateStr) || [];
      const deductionWeight = deductionMap.get(dateStr) || 0;
      applyDailyTotals(
        totals,
        currentRate,
        hasLicense,
        deductionWeight,
        dailyCheckContext.daysInMonth,
      );
      applyDailyCheckImpact(
        { currentRate, hasLicense, reasons, deductionWeight, dateStr },
        dailyCheckContext,
      );
    }
  }

  return coverage;
};

const addLicenseEvidence = (
  checkAggs: Map<PayrollCheckCode, CheckAgg>,
  licenses: LicenseRow[],
): void => {
  if (!checkAggs.has("NO_LICENSE")) return;
  const agg = checkAggs.get("NO_LICENSE")!;
  for (const lic of licenses) {
    pushEvidence(
      agg,
      `license:${formatLocalDate(lic.valid_from)}:${formatLocalDate(lic.valid_until)}:${lic.status}`,
      {
        type: "license",
        valid_from: formatLocalDate(lic.valid_from),
        valid_until: formatLocalDate(lic.valid_until),
        status: String(lic.status ?? ""),
        license_name: (lic as any).license_name ?? undefined,
        license_type: (lic as any).license_type ?? undefined,
        occupation_name: (lic as any).occupation_name ?? undefined,
      },
    );
  }
};

const addNotWorkingCheck = (
  workDaySet: Set<string>,
  daysInMonth: number,
  movements: MovementRow[],
  endOfMonth: Date,
  ensureAgg: EnsureAggFn,
): void => {
  if (!(workDaySet.size > 0 && workDaySet.size < daysInMonth)) return;
  const agg = ensureAgg("NOT_WORKING");
  agg.impactDays = daysInMonth - workDaySet.size;
  agg.impactAmount = 0;
  movements
    .filter((m) => new Date(m.effective_date) <= endOfMonth)
    .slice(-10)
    .forEach((m) => {
      pushEvidence(agg, `movement:${formatLocalDate(m.effective_date)}:${m.movement_type}`, {
        type: "movement",
        movement_type: String(m.movement_type),
        effective_date: formatLocalDate(m.effective_date),
      });
    });
};

type EligibilityGapContext = {
  totals: PaymentTotals;
  workDaySet: Set<string>;
  coverage: EligibilityCoverage;
  startOfMonth: Date;
  endOfMonth: Date;
  firstWorkDay: string | null;
  lastWorkDay: string | null;
  eligibilities: EligibilityInfo[];
  ensureAgg: EnsureAggFn;
};

const buildMissingEligibilityRanges = (
  firstWorkDay: string | null,
  lastWorkDay: string | null,
  coverage: EligibilityCoverage,
): { start: string; end: string }[] => {
  const missingRanges: { start: string; end: string }[] = [];
  if (
    firstWorkDay &&
    coverage.firstEligibilityDay &&
    coverage.firstEligibilityDay > firstWorkDay
  ) {
    const end = addDaysToLocalDateString(coverage.firstEligibilityDay, -1);
    if (end >= firstWorkDay) missingRanges.push({ start: firstWorkDay, end });
  }
  if (
    lastWorkDay &&
    coverage.lastEligibilityDay &&
    coverage.lastEligibilityDay < lastWorkDay
  ) {
    const start = addDaysToLocalDateString(coverage.lastEligibilityDay, 1);
    if (start <= lastWorkDay) missingRanges.push({ start, end: lastWorkDay });
  }
  return missingRanges;
};

const setEligibilityGapRange = (
  agg: CheckAgg,
  missingRanges: { start: string; end: string }[],
): void => {
  if (missingRanges.length === 1) {
    agg.startDate = missingRanges[0]!.start;
    agg.endDate = missingRanges[0]!.end;
    return;
  }
  agg.startDate = null;
  agg.endDate = null;
};

const addEligibilityGapRangeEvidence = (
  agg: CheckAgg,
  missingRanges: { start: string; end: string }[],
  monthStartStr: string,
  monthEndStr: string,
  firstWorkDay: string | null,
  lastWorkDay: string | null,
): void => {
  if (missingRanges.length === 0) return;
  agg.rangeLabel = missingRanges.map((r) => `${r.start} ถึง ${r.end}`).join(", ");
  pushEvidence(agg, `elig_gap:${monthStartStr}:${monthEndStr}`, {
    type: "eligibility_gap" as any,
    work_start_date: firstWorkDay ?? monthStartStr,
    work_end_date: lastWorkDay ?? monthEndStr,
    missing_ranges: missingRanges,
  } as any);
};

const addOverlappingEligibilityEvidence = (
  agg: CheckAgg,
  eligibilities: EligibilityInfo[],
  monthStartStr: string,
  monthEndStr: string,
): void => {
  for (const elig of eligibilities) {
    if (elig.rate <= 0) continue;
    const overlaps =
      elig.effectiveDate <= monthEndStr &&
      (elig.expiryDate ? elig.expiryDate >= monthStartStr : true);
    if (!overlaps) continue;
    pushEvidence(
      agg,
      `elig:${elig.effectiveDate}:${elig.expiryDate ?? "null"}:${elig.rate}:${elig.rateId ?? "null"}`,
      {
        type: "eligibility",
        effective_date: elig.effectiveDate,
        expiry_date: elig.expiryDate,
        rate: elig.rate,
        rate_id: elig.rateId,
      },
    );
  }
};

const addEligibilityGapCheck = ({
  totals,
  workDaySet,
  coverage,
  startOfMonth,
  endOfMonth,
  firstWorkDay,
  lastWorkDay,
  eligibilities,
  ensureAgg,
}: EligibilityGapContext): void => {
  if (!(totals.lastRateSnapshot > 0 && workDaySet.size > 0)) return;
  if (coverage.daysWithEligibilityRate >= workDaySet.size) return;

  const agg = ensureAgg("ELIGIBILITY_GAP");
  agg.impactDays = workDaySet.size - coverage.daysWithEligibilityRate;
  const expectedFull = totals.lastRateSnapshot;
  agg.impactAmount = Math.max(
    0,
    expectedFull -
      Number(totals.totalPayment.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()),
  );
  const monthStartStr = formatLocalDate(startOfMonth);
  const monthEndStr = formatLocalDate(endOfMonth);
  const missingRanges = buildMissingEligibilityRanges(firstWorkDay, lastWorkDay, coverage);
  setEligibilityGapRange(agg, missingRanges);
  addEligibilityGapRangeEvidence(
    agg,
    missingRanges,
    monthStartStr,
    monthEndStr,
    firstWorkDay,
    lastWorkDay,
  );
  addOverlappingEligibilityEvidence(agg, eligibilities, monthStartStr, monthEndStr);
};

const buildPayrollChecks = (checkAggs: Map<PayrollCheckCode, CheckAgg>): PayrollCheck[] => {
  return Array.from(checkAggs.values())
    .filter((agg) => agg.impactDays > 0.0001 || Math.abs(agg.impactAmount) > 0.01)
    .map((agg) => {
      const severity = reasonSeverity(agg.code);
      const impactDays = Number.parseFloat(agg.impactDays.toFixed(2));
      const impactAmount =
        agg.code === "NOT_WORKING"
          ? null
          : Number.parseFloat(agg.impactAmount.toFixed(2));
      const title = checkTitle(agg.code);
      const summaryParts: string[] = [];
      if (agg.code === "PENDING_RETURN_REPORT") {
        summaryParts.push(`พบ ${impactDays.toLocaleString('th-TH')} รายการที่ยังไม่รายงานตัวกลับ`);
      } else {
        summaryParts.push(`กระทบ ${impactDays.toLocaleString('th-TH')} วัน`);
        if (impactAmount !== null && impactAmount > 0) {
          summaryParts.push(`ประมาณ -${impactAmount.toLocaleString('th-TH')} บาท`);
        }
      }
      if (agg.code === "ELIGIBILITY_GAP" && agg.rangeLabel) {
        summaryParts.push(`ไม่มีสิทธิ ${agg.rangeLabel}`);
      } else if (agg.startDate && agg.endDate) {
        summaryParts.push(`${agg.startDate} ถึง ${agg.endDate}`);
      }
      return {
        code: agg.code,
        severity,
        title,
        summary: summaryParts.join(" • "),
        impactDays,
        impactAmount,
        startDate: agg.startDate,
        endDate: agg.endDate,
        evidence: agg.evidence,
      };
    })
    .sort((a, b) => {
      const sevA = a.severity === "BLOCKER" ? 0 : 1;
      const sevB = b.severity === "BLOCKER" ? 0 : 1;
      if (sevA !== sevB) return sevA - sevB;
      const amtA = a.impactAmount ?? 0;
      const amtB = b.impactAmount ?? 0;
      if (amtA !== amtB) return amtB - amtA;
      return b.impactDays - a.impactDays;
    });
};

export async function calculateMonthlyWithData(
  year: number,
  month: number,
  data: EmployeeBatchData,
): Promise<CalculationResult> {
  const startOfMonth = makeLocalDate(year, month - 1, 1);
  const endOfMonth = makeLocalDate(year, month, 0);
  const daysInMonth = endOfMonth.getDate();
  const fiscalYearStart =
    month >= 10
      ? makeLocalDate(year, 9, 1)
      : makeLocalDate(year - 1, 9, 1);
  const fiscalYearEnd =
    month >= 10
      ? makeLocalDate(year + 1, 9, 0)
      : makeLocalDate(year, 9, 0);

  const eligibilities = buildEligibilities(
    data.eligibilityRows as EligibilityRow[],
  );
  const movements = data.movementRows as MovementRow[];
  const employee = (data.employeeRow as EmployeeRow) || {};
  const licenses = data.licenseRows as LicenseRow[];
  const leaves = data.leaveRows as LeaveRow[];
  const quota = (data.quotaRow as QuotaRow) || ({} as QuotaRow);
  const holidays = data.holidays;
  const noSalaryPeriods = (data.noSalaryPeriods as NoSalaryPeriodRow[]) || [];
  const returnReportRows = (data.returnReportRows as ReturnReportRow[]) || [];
  const returnReports = buildReturnReportsMap(returnReportRows);

  // สร้างใบลา education จาก movement_type = STUDY
  // แล้วรวมกับ leave จริงจากฐานข้อมูล
  const studyLeaveRows = buildStudyLeaveRowsFromMovements(movements, endOfMonth);
  const mergedLeaves = assignSyntheticIdsToLeaves([...leaves, ...studyLeaveRows]);

  const { periods, remark } = resolveWorkPeriods(
    movements,
    startOfMonth,
    endOfMonth,
  );
  if (periods.length === 0) {
    return emptyResult(remark || "ไม่ได้ปฏิบัติงานในเดือนนี้");
  }

  // ส่งวันเริ่มงานให้ leave-domain ใช้คำนวณกฎที่อิงอายุงาน
  // (เช่น personal ปีแรก, ordain ไม่ถึง 1 ปี)
  const startWorkDateStr = formatLocalDate(employee.start_work_date ?? null);
  const serviceStartDate = startWorkDateStr
    ? parseLocalDateString(startWorkDateStr)
    : null;

  const quotaStatus = calculateLeaveQuotaStatus({
    leaveRows: mergedLeaves,
    holidays,
    quota,
    rules: LEAVE_RULES,
    serviceStartDate,
    rangeStart: fiscalYearStart,
    rangeEnd: endOfMonth < fiscalYearEnd ? endOfMonth : fiscalYearEnd,
  });
  // แปลงผลจาก leave-domain ให้อยู่ในรูป Map<leave_id, QuotaDecision>
  // เพื่อส่งเข้าฟังก์ชัน calculateDeductions() ใน deductions.ts
  const { quotaDecisions, quotaInfoByLeaveId } = buildQuotaMaps(quotaStatus);
  const deductionResult: DeductionResult = calculateDeductions(
    mergedLeaves,
    holidays,
    startOfMonth,
    endOfMonth,
    quotaDecisions,
    noSalaryPeriods,
    returnReports,
  );
  const deductionMap = deductionResult.deductionMap;
  const reasonsByDate = deductionResult.reasonsByDate;
  // สรุปจำนวนวันถูกหักทั้งเดือน เพื่อนำไปบันทึก pay_results.deducted_days
  const totalDeductionDaysInMonth = Array.from(deductionMap.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const licenseChecker = createLicenseChecker(
    licenses,
    employee.position_name || "",
  );
  const eligibilityState: EligibilityState = { index: 0, current: null };
  const totals: PaymentTotals = {
    totalPayment: new Decimal(0),
    validLicenseDays: 0,
    totalDeductionDays: 0,
    daysCounted: 0,
    lastRateSnapshot: 0,
    lastMasterRateId: null,
    lastProfessionCode: null,
    lastGroupNo: null,
    lastItemNo: null,
  };

  const { orderedPeriods, workDaySet, firstWorkDay, lastWorkDay } = buildWorkDayWindow(periods);
  const { checkAggs, ensureAgg, updateAggRange } = createCheckAccumulator();
  const leaveById = buildLeaveByIdMap(mergedLeaves);
  markMissingStartWorkDateCheck({
    startWorkDateStr,
    workDaySet,
    daysInMonth,
    firstWorkDay,
    lastWorkDay,
    startOfMonth,
    endOfMonth,
    ensureAgg,
  });
  addPendingReturnReportChecks(mergedLeaves, endOfMonth, ensureAgg, updateAggRange);

  const dailyCheckContext: DailyCheckImpactContext = {
    daysInMonth,
    ensureAgg,
    updateAggRange,
    leaveById,
    quotaInfoByLeaveId,
  };
  const coverage = processDailyPeriods({
    orderedPeriods,
    eligibilities,
    eligibilityState,
    totals,
    licenseChecker,
    reasonsByDate,
    deductionMap,
    dailyCheckContext,
  });

  addLicenseEvidence(checkAggs, licenses);
  addNotWorkingCheck(workDaySet, daysInMonth, movements, endOfMonth, ensureAgg);
  addEligibilityGapCheck({
    totals,
    workDaySet,
    coverage,
    startOfMonth,
    endOfMonth,
    firstWorkDay,
    lastWorkDay,
    eligibilities,
    ensureAgg,
  });

  const checks = buildPayrollChecks(checkAggs);

  return {
    netPayment: totals.totalPayment
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber(),
    totalDeductionDays: totalDeductionDaysInMonth,
    validLicenseDays: totals.validLicenseDays,
    eligibleDays: totals.daysCounted,
    remark,
    masterRateId: totals.lastMasterRateId,
    rateSnapshot: totals.lastRateSnapshot,
    ptsGroupNo: totals.lastGroupNo,
    ptsItemNo: totals.lastItemNo,
    professionCode: totals.lastProfessionCode,
    checks,
  };
}

export async function calculateMonthly(
  citizenId: string,
  year: number,
  month: number,
  connection?: PoolConnection,
): Promise<CalculationResult> {
  const dbConn: Pick<PoolConnection, "query"> = connection ?? pool;
  const startOfMonth = makeLocalDate(year, month - 1, 1);
  const endOfMonth = makeLocalDate(year, month, 0);
  const startOfMonthStr = formatLocalDate(startOfMonth);
  const endOfMonthStr = formatLocalDate(endOfMonth);
  const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;

  const [eligibilityRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT e.effective_date, e.expiry_date, m.amount as rate, m.rate_id, m.profession_code, m.group_no, m.item_no
      FROM req_eligibility e
      JOIN cfg_payment_rates m ON e.master_rate_id = m.rate_id
      WHERE e.citizen_id = ?
      AND e.effective_date <= ?
      AND (e.expiry_date IS NULL OR e.expiry_date >= ?)
      ORDER BY e.effective_date ASC
    `,
    [citizenId, endOfMonthStr, startOfMonthStr],
  );

  const [movementRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT * FROM emp_movements
      WHERE citizen_id = ? AND effective_date <= ?
      ORDER BY effective_date ASC, created_at ASC
    `,
    [citizenId, endOfMonthStr],
  );

  const [employeeRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT position_name, first_entry_date, start_work_date FROM emp_profiles WHERE citizen_id = ? LIMIT 1`,
    [citizenId],
  );

  const [licenseRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT * FROM emp_licenses WHERE citizen_id = ?`,
    [citizenId],
  );

  const [leaveRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT lr.*,
             ext.document_start_date,
             ext.document_end_date,
             ext.document_duration_days,
             ext.require_return_report,
             ext.return_report_status,
             ext.pay_exception,
             COALESCE(ext.is_no_pay, ext.pay_exception, 0) AS is_no_pay
      FROM leave_records lr
      LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
      WHERE lr.citizen_id = ? AND lr.fiscal_year = ?
      ORDER BY lr.start_date ASC
    `,
    [citizenId, fiscalYear],
  );

  const [noSalaryRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT lr.citizen_id,
             lr.id AS leave_record_id,
             lr.leave_type,
             COALESCE(ext.document_start_date, lr.start_date) AS start_date,
             COALESCE(ext.document_end_date, lr.end_date) AS end_date
      FROM leave_record_extensions ext
      JOIN leave_records lr ON lr.id = ext.leave_record_id
      WHERE lr.citizen_id = ?
        AND COALESCE(ext.is_no_pay, ext.pay_exception) = 1
        AND COALESCE(ext.document_start_date, lr.start_date) <= ?
        AND COALESCE(ext.document_end_date, lr.end_date) >= ?
    `,
    [citizenId, endOfMonthStr, startOfMonthStr],
  );

  const [returnReportRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT ext.leave_record_id, ext.return_date
      FROM leave_record_extensions ext
      JOIN leave_records lr ON lr.id = ext.leave_record_id
      WHERE lr.citizen_id = ?
        AND ext.return_report_status = 'DONE'
        AND ext.return_date IS NOT NULL
    `,
    [citizenId],
  );

  const [quotaRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT * FROM leave_quotas WHERE citizen_id = ? AND fiscal_year = ?`,
    [citizenId, fiscalYear],
  );

  const [holidayRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT holiday_date FROM cfg_holidays WHERE holiday_date BETWEEN ? AND ?`,
    [`${year - 1}-01-01`, `${year}-12-31`],
  );

  return calculateMonthlyWithData(year, month, {
    eligibilityRows,
    movementRows,
    employeeRow: employeeRows[0] || {},
    licenseRows,
    leaveRows,
    quotaRow: quotaRows[0] || null,
    holidays: (holidayRows as HolidayRow[]).map((h) =>
      formatLocalDate(h.holiday_date),
    ),
    noSalaryPeriods: noSalaryRows,
    returnReportRows,
  });
}

export function checkLicense(
  licenses: LicenseRow[],
  dateStr: string,
  positionName = "",
): boolean {
  return createLicenseChecker(licenses, positionName)(dateStr);
}

type SavePayoutInput = {
  conn: PoolConnection;
  periodId: number;
  userId: number | null;
  citizenId: string;
  result: CalculationResult;
  masterRateId: number | null;
  baseRateSnapshot: number;
  referenceYear: number;
  referenceMonth: number;
};

const insertCurrentPayoutItem = async (
  conn: PoolConnection,
  payoutId: number,
  referenceMonth: number,
  referenceYear: number,
  netPayment: number,
): Promise<void> => {
  if (netPayment === 0) return;
  await conn.query(
    `
      INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
      VALUES (?, ?, ?, 'CURRENT', ?, 'ค่าตอบแทนงวดปัจจุบัน')
    `,
    [payoutId, referenceMonth, referenceYear, netPayment],
  );
};

const resolveRetroItemType = (value: number): "RETROACTIVE_ADD" | "RETROACTIVE_DEDUCT" => {
  return value > 0 ? "RETROACTIVE_ADD" : "RETROACTIVE_DEDUCT";
};

const insertRetroPayoutItems = async (
  conn: PoolConnection,
  payoutId: number,
  result: CalculationResult,
): Promise<void> => {
  if (result.retroDetails && result.retroDetails.length > 0) {
    for (const detail of result.retroDetails) {
      await conn.query(
        `
          INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          payoutId,
          detail.month,
          detail.year,
          resolveRetroItemType(detail.diff),
          Math.abs(detail.diff),
          detail.remark,
        ],
      );
    }
    return;
  }

  if (!result.retroactiveTotal || Math.abs(result.retroactiveTotal) <= 0.01) return;
  await conn.query(
    `
      INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      payoutId,
      0,
      0,
      resolveRetroItemType(result.retroactiveTotal),
      Math.abs(result.retroactiveTotal),
      "ปรับตกเบิกย้อนหลัง (รวมยอด)",
    ],
  );
};

const insertPayoutChecks = async (
  conn: PoolConnection,
  payoutId: number,
  checks: PayrollCheck[] | undefined,
): Promise<void> => {
  if (!checks || checks.length === 0) return;
  for (const check of checks) {
    await conn.query(
      `
        INSERT INTO pay_result_checks
        (payout_id, code, severity, title, summary, impact_days, impact_amount, start_date, end_date, evidence_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payoutId,
        check.code,
        check.severity,
        check.title,
        check.summary,
        check.impactDays,
        check.impactAmount,
        check.startDate,
        check.endDate,
        check.evidence.length ? JSON.stringify(check.evidence) : null,
      ],
    );
  }
};

export async function savePayout({
  conn,
  periodId,
  userId,
  citizenId,
  result,
  masterRateId,
  baseRateSnapshot,
  referenceYear,
  referenceMonth,
}: SavePayoutInput): Promise<number> {
  const totalPayable = result.netPayment + (result.retroactiveTotal ?? 0);

  const [res] = await conn.query<ResultSetHeader>(
    `
      INSERT INTO pay_results
      (period_id, user_id, citizen_id, master_rate_id, profession_code, pts_rate_snapshot, calculated_amount, retroactive_amount, total_payable, deducted_days, eligible_days, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      periodId,
      userId,
      citizenId,
      masterRateId,
      result.professionCode ?? null,
      baseRateSnapshot,
      result.netPayment,
      result.retroactiveTotal ?? 0,
      totalPayable,
      result.totalDeductionDays,
      result.eligibleDays,
      result.remark,
    ],
  );

  const payoutId = res.insertId;
  await insertCurrentPayoutItem(conn, payoutId, referenceMonth, referenceYear, result.netPayment);
  await insertRetroPayoutItems(conn, payoutId, result);
  await insertPayoutChecks(conn, payoutId, result.checks);

  return payoutId;
}

// ----------------------------------------------------------------------------
// กลุ่มฟังก์ชันช่วยคำนวณช่วงวันที่ "มีสถานะปฏิบัติงาน"
// ใช้กับ movement และใช้ต่อใน calculateMonthlyWithData()
// ----------------------------------------------------------------------------

function resolveWorkPeriods(
  movements: MovementRow[],
  monthStart: Date,
  monthEnd: Date,
): { periods: WorkPeriod[]; remark: string } {
  // นโยบายปัจจุบัน:
  // - ใช้เฉพาะสถานะออกจากงาน (RESIGN/RETIRE/DEATH/TRANSFER_OUT) เป็นตัว "ตัดสิทธิ"
  // - สถานะเข้าใหม่ในเดือนเดียวกันจะไม่เปิดสิทธิกลับใน payroll รอบนี้
  //   เพราะต้องไปยื่นสิทธิใหม่ผ่าน workflow request ก่อน
  //
  // ดังนั้นเดือนที่คำนวณนี้:
  // - ถ้าไม่มี exit ในเดือน => ถือว่ามีช่วงปฏิบัติงานครบเดือน
  // - ถ้ามี exit ในเดือน => มีสิทธิถึงวันก่อน exit ครั้งแรก
  const exitTypes = new Set(["RESIGN", "RETIRE", "DEATH", "TRANSFER_OUT"]);
  const monthStartStr = formatLocalDate(monthStart);
  const monthEndStr = formatLocalDate(monthEnd);
  const exitsInMonth = movements
    .filter((m) => {
      const dateStr = formatLocalDate(m.effective_date);
      return (
        exitTypes.has(String(m.movement_type ?? "")) &&
        dateStr >= monthStartStr &&
        dateStr <= monthEndStr
      );
    })
    .sort((a, b) => {
    const dateA = new Date(a.effective_date).getTime();
    const dateB = new Date(b.effective_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a as any).movement_id - (b as any).movement_id;
  });

  if (exitsInMonth.length === 0) {
    return { periods: [{ start: monthStart, end: monthEnd }], remark: "" };
  }

  const firstExit = exitsInMonth[0];
  if (!firstExit) {
    return { periods: [{ start: monthStart, end: monthEnd }], remark: "" };
  }
  const exitDate = new Date(firstExit.effective_date);
  const endBeforeExit = new Date(exitDate);
  endBeforeExit.setDate(endBeforeExit.getDate() - 1);

  if (endBeforeExit < monthStart) {
    return { periods: [], remark: "สถานะออกจากงานในเดือนนี้" };
  }

  return {
    periods: [{ start: monthStart, end: endBeforeExit }],
    remark: "",
  };
}

function buildStudyLeaveRowsFromMovements(
  movements: MovementRow[],
  monthEnd: Date,
): LeaveRow[] {
  // ฟังก์ชันนี้แปลง movement STUDY ให้กลายเป็นใบลา education
  // เพื่อให้ไปคำนวณโควต้าและวันหักใน flow เดียวกับใบลาปกติ
  const relevantMovements = movements.filter(
    (m) => new Date(m.effective_date) <= monthEnd,
  );
  if (relevantMovements.length === 0) return [];

  const sorted = [...relevantMovements].sort((a, b) => {
    const dateA = new Date(a.effective_date).getTime();
    const dateB = new Date(b.effective_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a as any).movement_id - (b as any).movement_id;
  });

  const studyLeaves: LeaveRow[] = [];
  let studyStart: Date | null = null;

  for (const mov of sorted) {
    const type = mov.movement_type;
    const movDate = new Date(mov.effective_date);

    if (type === "STUDY") {
      if (!studyStart) {
        studyStart = movDate;
      }
      continue;
    }

    if (studyStart) {
      const endDate = new Date(movDate);
      endDate.setDate(endDate.getDate() - 1);
      studyLeaves.push({
        leave_type: "education",
        start_date: studyStart,
        end_date: endDate,
        duration_days: 0,
      } as LeaveRow);
      studyStart = null;
    }
  }

  if (studyStart) {
    studyLeaves.push({
      leave_type: "education",
      start_date: studyStart,
      end_date: monthEnd,
      duration_days: 0,
    } as LeaveRow);
  }

  return studyLeaves;
}

function assignSyntheticIdsToLeaves(leaves: LeaveRow[]): LeaveRow[] {
  // ใบลาที่ไม่มี id (เช่นใบลาที่สร้างจาก movement) จะถูกใส่ id ติดลบ
  // เพื่อให้เชื่อมกับ quotaDecisions ใน deductions.ts ได้
  let syntheticId = -1;
  return leaves.map((leave) => {
    if (leave.id !== undefined && leave.id !== null) return leave;
    return {
      ...leave,
      id: syntheticId--,
    } as LeaveRow;
  });
}

function emptyResult(remark: string): CalculationResult {
  return {
    netPayment: 0,
    totalDeductionDays: 0,
    validLicenseDays: 0,
    eligibleDays: 0,
    remark,
    masterRateId: null,
    rateSnapshot: 0,
    ptsGroupNo: null,
    ptsItemNo: null,
  };
}

export const payrollService = {
  calculateMonthly,
  calculateMonthlyWithData,
  calculateDeductions,
  checkLicense,
  savePayout,
  formatLocalDate,
  makeLocalDate,
};
