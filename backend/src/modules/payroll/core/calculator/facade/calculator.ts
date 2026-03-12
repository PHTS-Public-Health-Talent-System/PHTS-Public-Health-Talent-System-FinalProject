import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { Decimal } from "decimal.js";
import {
  calculateDeductions,
  LeaveRow,
  NoSalaryPeriodRow,
  QuotaRow,
  ReturnReportRow,
} from '@/modules/payroll/core/deductions/deductions.js';
import { formatLocalDate, makeLocalDate } from '@/modules/payroll/core/utils/date.utils.js';
import { LEAVE_RULES } from '@/modules/payroll/payroll.constants.js';
import { calculateLeaveQuotaStatus } from '@/modules/leave-management/services/leave-domain.service.js';
import { loadEmployeeBatchData } from "@/modules/payroll/core/calculator/facade/calculator.data.js";
import { savePayout } from "@/modules/payroll/core/calculator/facade/calculator.persistence.js";
import {
  assignSyntheticIdsToLeaves,
  buildStudyLeaveRowsFromMovements,
  resolveWorkPeriods,
} from "@/modules/payroll/core/calculator/facade/calculator.work-period.js";
import {
  buildEligibilities,
  buildQuotaMaps,
  buildReturnReportsMap,
  buildWorkDayWindow,
  createLicenseChecker,
  EligibilityState,
  PaymentTotals,
  sumDeductionDaysInMonth,
} from "@/modules/payroll/core/calculator/engine/calculator.engine.js";
import {
  addEligibilityGapCheck,
  addLicenseEvidence,
  addNotWorkingCheck,
  addPendingReturnReportChecks,
  buildLeaveByIdMap,
  buildPayrollChecks,
  createCheckAccumulator,
  DailyCheckImpactContext,
  markMissingStartWorkDateCheck,
  processDailyPeriods,
} from "@/modules/payroll/core/calculator/checks/calculator.checks.js";

export interface EligibilityRow extends RowDataPacket {
  effective_date: Date | string;
  expiry_date: Date | string | null;
  rate: number;
  profession_code?: string | null;
  group_no?: number | null;
  item_no?: string | null;
  sub_item_no?: string | null;
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
      group_no?: number | null;
      item_no?: string | null;
      sub_item_no?: string | null;
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
  returnReportRows?: ReturnReportRow[];
}

const parseLocalDateString = (value: string): Date => {
  const [yy, mm, dd] = value.split("-").map((v) => Number(v));
  return makeLocalDate(yy, (mm ?? 1) - 1, dd ?? 1);
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
  const deductionResult = calculateDeductions(
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
  const totalDeductionDaysInMonth = sumDeductionDaysInMonth(deductionResult);
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
  const batchData = await loadEmployeeBatchData(citizenId, year, month, connection);
  return calculateMonthlyWithData(year, month, batchData);
}

export function checkLicense(
  licenses: LicenseRow[],
  dateStr: string,
  positionName = "",
): boolean {
  return createLicenseChecker(licenses, positionName)(dateStr);
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
