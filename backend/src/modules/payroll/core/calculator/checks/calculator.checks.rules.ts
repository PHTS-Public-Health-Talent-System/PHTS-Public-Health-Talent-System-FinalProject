import { Decimal } from "decimal.js";
import {
  DeductionReason,
  DeductionReasonCode,
  LeaveRow,
} from "@/modules/payroll/core/deductions/deductions.js";
import { formatLocalDate, makeLocalDate } from "@/modules/payroll/core/utils/date.utils.js";
import { LEAVE_RULES } from "@/modules/payroll/payroll.constants.js";
import type {
  PayrollCheckCode,
  PayrollCheckEvidence,
  PayrollCheckSeverity,
} from "@/modules/payroll/core/calculator/facade/calculator.js";
import type {
  EligibilityInfo,
  QuotaInfoByLeaveId,
} from "@/modules/payroll/core/calculator/engine/calculator.engine.js";

export type CheckAgg = {
  code: PayrollCheckCode;
  impactDays: number;
  impactAmount: number;
  startDate: string | null;
  endDate: string | null;
  rangeLabel?: string;
  evidence: PayrollCheckEvidence[];
  evidenceKeySet: Set<string>;
};

export type EnsureAggFn = (code: PayrollCheckCode) => CheckAgg;
export type UpdateAggRangeFn = (agg: CheckAgg, dateStr: string) => void;

type ReasonImpactContext = {
  ensureAgg: EnsureAggFn;
  updateAggRange: UpdateAggRangeFn;
  leaveById: Map<number, LeaveRow>;
  quotaInfoByLeaveId: QuotaInfoByLeaveId;
};

type DailyCheckImpactInput = {
  currentRate: number;
  hasLicense: boolean;
  reasons: DeductionReason[];
  deductionWeight: number;
  dateStr: string;
};

export type DailyCheckImpactContext = ReasonImpactContext & {
  daysInMonth: number;
};

export type EligibilityCoverage = {
  daysWithEligibilityRate: number;
  firstEligibilityDay: string | null;
  lastEligibilityDay: string | null;
};

export const normalizeReasonCode = (code: DeductionReasonCode): PayrollCheckCode => {
  switch (code) {
    case "NO_PAY":
      return "NO_PAY";
    case "OVER_QUOTA":
      return "OVER_QUOTA";
  }
};

export const reasonSeverity = (code: PayrollCheckCode): PayrollCheckSeverity => {
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

export const checkTitle = (code: PayrollCheckCode): string => {
  switch (code) {
    case "NO_PAY":
      return "ลาไม่รับค่าตอบแทน";
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

export const pushEvidence = (
  agg: CheckAgg,
  key: string,
  evidence: PayrollCheckEvidence,
) => {
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

export const updateEligibilityCoverage = (
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

export const applyDailyCheckImpact = (
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

export const setEligibilityGapRange = (
  agg: CheckAgg,
  missingRanges: { start: string; end: string }[],
): void => {
  if (missingRanges.length === 1) {
    const [onlyRange] = missingRanges;
    agg.startDate = onlyRange.start;
    agg.endDate = onlyRange.end;
    return;
  }
  agg.startDate = null;
  agg.endDate = null;
};

export const addEligibilityGapRangeEvidence = (
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

export const addOverlappingEligibilityEvidence = (
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
        group_no: elig.groupNo,
        item_no: elig.itemNo,
        sub_item_no: elig.subItemNo,
      },
    );
  }
};

export const buildEligibilityGapRanges = (
  firstWorkDay: string | null,
  lastWorkDay: string | null,
  coverage: EligibilityCoverage,
): { start: string; end: string }[] => {
  return buildMissingEligibilityRanges(firstWorkDay, lastWorkDay, coverage);
};
