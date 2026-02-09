import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { Decimal } from "decimal.js";
import pool from '@config/database.js';
import {
  calculateDeductions,
  LeaveRow,
  NoSalaryPeriodRow,
  QuotaRow,
  ReturnReportRow,
} from '@/modules/payroll/core/deductions.js';
import { formatLocalDate, makeLocalDate } from '@/modules/payroll/core/utils.js';
import { LEAVE_RULES } from '@/modules/payroll/payroll.constants.js';
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
}

export interface RetroDetail {
  month: number;
  year: number;
  diff: number;
  remark: string;
}

interface WorkPeriod {
  start: Date;
  end: Date;
}

type EligibilityInfo = Readonly<{
  effectiveTs: number;
  expiryTs: number;
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

  let eligibleWeight = hasLicense ? 1 : 0;
  eligibleWeight -= deductionWeight;
  if (eligibleWeight < 0) eligibleWeight = 0;

  if (deductionWeight > 0) totals.totalDeductionDays += deductionWeight;
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
  const returnReports = new Map<number, Date>();

  for (const row of returnReportRows) {
    const existing = returnReports.get(row.leave_record_id);
    const candidate = new Date(row.return_date);
    if (!existing || candidate < existing) {
      returnReports.set(row.leave_record_id, candidate);
    }
  }

  const studyLeaves = buildStudyLeaves(movements, endOfMonth);
  const mergedLeaves = [...leaves, ...studyLeaves];

  const { periods, remark } = resolveWorkPeriods(
    movements,
    startOfMonth,
    endOfMonth,
  );
  if (periods.length === 0) {
    return emptyResult(remark || "ไม่ได้ปฏิบัติงานในเดือนนี้");
  }

  // Use start_work_date for "อายุราชการรวม" (total civil service years)
  const serviceStartDate = employee.start_work_date
    ? new Date(employee.start_work_date)
    : employee.first_entry_date
      ? new Date(employee.first_entry_date)
      : null;

  const quotaStatus = calculateLeaveQuotaStatus({
    leaveRows: leaves,
    holidays,
    quota,
    rules: LEAVE_RULES,
    serviceStartDate,
    rangeStart: fiscalYearStart,
    rangeEnd: endOfMonth < fiscalYearEnd ? endOfMonth : fiscalYearEnd,
  });
  const quotaDecisions = new Map<number, { overQuota: boolean; exceedDate: Date | null }>();
  Object.entries(quotaStatus.perLeave).forEach(([leaveId, info]) => {
    const id = Number(leaveId);
    if (!Number.isNaN(id)) {
      quotaDecisions.set(id, {
        overQuota: info.overQuota,
        exceedDate: info.exceedDate ? new Date(info.exceedDate) : null,
      });
    }
  });
  const deductionMap = calculateDeductions(
    mergedLeaves,
    quota,
    holidays,
    startOfMonth,
    endOfMonth,
    serviceStartDate,
    noSalaryPeriods,
    returnReports,
    quotaDecisions,
  );
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

  const orderedPeriods = [...periods].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  for (const period of orderedPeriods) {
    for (
      let d = new Date(period.start);
      d <= period.end;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = formatLocalDate(d);
      const dayTs = d.getTime();

      const activeEligibility = getActiveEligibility(
        eligibilityState,
        eligibilities,
        dayTs,
      );
      const currentRate = activeEligibility ? activeEligibility.rate : 0;

      if (activeEligibility) {
        totals.lastRateSnapshot = currentRate;
        totals.lastMasterRateId = activeEligibility.rateId;
        totals.lastProfessionCode = activeEligibility.professionCode;
        totals.lastGroupNo = activeEligibility.groupNo;
        totals.lastItemNo = activeEligibility.itemNo;
      }

      const hasLicense = licenseChecker(dateStr);
      const deductionWeight = deductionMap.get(dateStr) || 0;
      applyDailyTotals(
        totals,
        currentRate,
        hasLicense,
        deductionWeight,
        daysInMonth,
      );
    }
  }

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
      (period_id, user_id, citizen_id, master_rate_id, profession_code, pts_rate_snapshot, calculated_amount, total_payable, deducted_days, eligible_days, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      periodId,
      userId,
      citizenId,
      masterRateId,
      result.professionCode ?? null,
      baseRateSnapshot,
      result.netPayment,
      totalPayable,
      result.totalDeductionDays,
      result.eligibleDays,
      result.remark,
    ],
  );

  const payoutId = res.insertId;

  if (result.netPayment !== 0) {
    await conn.query(
      `
        INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
        VALUES (?, ?, ?, 'CURRENT', ?, 'ค่าตอบแทนงวดปัจจุบัน')
      `,
      [payoutId, referenceMonth, referenceYear, result.netPayment],
    );
  }

  if (result.retroDetails && result.retroDetails.length > 0) {
    for (const detail of result.retroDetails) {
      const itemType =
        detail.diff > 0 ? "RETROACTIVE_ADD" : "RETROACTIVE_DEDUCT";
      await conn.query(
        `
          INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          payoutId,
          detail.month,
          detail.year,
          itemType,
          Math.abs(detail.diff),
          detail.remark,
        ],
      );
    }
  } else if (
    result.retroactiveTotal &&
    Math.abs(result.retroactiveTotal) > 0.01
  ) {
    const itemType =
      result.retroactiveTotal > 0 ? "RETROACTIVE_ADD" : "RETROACTIVE_DEDUCT";
    await conn.query(
      `
        INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payoutId,
        0,
        0,
        itemType,
        Math.abs(result.retroactiveTotal),
        "ปรับตกเบิกย้อนหลัง (รวมยอด)",
      ],
    );
  }

  return payoutId;
}

// ============================================================================
// Internal: Timeline Resolution Logic (Refactored)
// ============================================================================

function resolveWorkPeriods(
  movements: MovementRow[],
  monthStart: Date,
  monthEnd: Date,
): { periods: WorkPeriod[]; remark: string } {
  // 1. Flatten movements into chronological events
  const relevantMovements = normalizeMovementsForTimeline(
    movements.filter((m) => new Date(m.effective_date) <= monthEnd),
  );

  if (relevantMovements.length === 0) {
    return { periods: [{ start: monthStart, end: monthEnd }], remark: "" };
  }

  // Sort by date ASC, then by creation order (id) ASC
  const sorted = [...relevantMovements].sort((a, b) => {
    const dateA = new Date(a.effective_date).getTime();
    const dateB = new Date(b.effective_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a as any).movement_id - (b as any).movement_id;
  });

  const timelineMonthStart = monthStart.getTime();
  const timelineMonthEnd = monthEnd.getTime();
  const periods: WorkPeriod[] = [];
  let isActive = false;
  let currentSegmentStart = -1;
  const lastRemark = "";

  const exitTypes = new Set(["RESIGN", "RETIRE", "DEATH", "TRANSFER_OUT"]);

  for (let i = 0; i < sorted.length; i++) {
    const mov = sorted[i];
    const movDate = new Date(mov.effective_date).getTime();
    const type = mov.movement_type;

    let nextIsActive: boolean = isActive;

    if (
      type === "ENTRY" ||
      type === "TRANSFER_IN" ||
      type === "REINSTATE" ||
      type === "STUDY"
    ) {
      nextIsActive = true;
    } else if (exitTypes.has(type)) {
      nextIsActive = false;
    }

    if (!isActive && nextIsActive) {
      currentSegmentStart = movDate;
    } else if (isActive && !nextIsActive) {
      const segmentEnd = movDate - 24 * 60 * 60 * 1000;
      if (currentSegmentStart !== -1) {
        addPeriod(
          periods,
          currentSegmentStart,
          segmentEnd,
          timelineMonthStart,
          timelineMonthEnd,
        );
      }
      currentSegmentStart = -1;
    }
    isActive = nextIsActive;
  }

  if (isActive && currentSegmentStart !== -1) {
    addPeriod(
      periods,
      currentSegmentStart,
      timelineMonthEnd,
      timelineMonthStart,
      timelineMonthEnd,
    );
  }

  return { periods, remark: isActive ? "" : lastRemark };
}

function normalizeMovementsForTimeline(
  movements: MovementRow[],
): MovementRow[] {
  if (movements.length === 0) return movements;
  const entryTypes = new Set(["ENTRY", "TRANSFER_IN", "REINSTATE", "STUDY"]);
  const exitTypes = new Set(["RESIGN", "RETIRE", "DEATH", "TRANSFER_OUT"]);
  const grouped = new Map<
    string,
    { hasEntry: boolean; hasExit: boolean; minId: number; date: Date }
  >();

  for (const mov of movements) {
    const dateStr = formatLocalDate(mov.effective_date);
    if (!dateStr) continue;
    const existing = grouped.get(dateStr);
    const minId = existing
      ? Math.min(existing.minId, (mov as any).movement_id || 0)
      : (mov as any).movement_id || 0;
    const hasEntry =
      existing?.hasEntry || false || entryTypes.has(mov.movement_type);
    const hasExit =
      existing?.hasExit || false || exitTypes.has(mov.movement_type);
    grouped.set(dateStr, {
      hasEntry,
      hasExit,
      minId,
      date: new Date(mov.effective_date),
    });
  }

  const normalized: MovementRow[] = [];
  for (const entry of grouped.values()) {
    if (!entry.hasEntry && !entry.hasExit) continue;
    const movement_type = entry.hasEntry ? "ENTRY" : "RESIGN";
    normalized.push({
      movement_id: entry.minId,
      citizen_id: "",
      movement_type,
      effective_date: entry.date,
      remark: null,
      synced_at: null as any,
      created_at: null as any,
    } as MovementRow);
  }

  return normalized;
}

function buildStudyLeaves(
  movements: MovementRow[],
  monthEnd: Date,
): LeaveRow[] {
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

function addPeriod(
  periods: WorkPeriod[],
  startTs: number,
  endTs: number,
  monthStartTs: number,
  monthEndTs: number,
) {
  const actualStart = Math.max(startTs, monthStartTs);
  const actualEnd = Math.min(endTs, monthEndTs);

  if (actualStart <= actualEnd) {
    // Check merge with last period (if contiguous within 1 day + buffer)
    const lastPeriod = periods[periods.length - 1];
    if (lastPeriod) {
      const lastEndTs = lastPeriod.end.getTime();
      // Allow tiny gap (e.g. milliseconds) but logic is based on days.
      // 24h + 1h buffer.
      if (actualStart <= lastEndTs + 50 * 60 * 60 * 1000) {
        lastPeriod.end = new Date(actualEnd);
        return;
      }
    }
    periods.push({
      start: new Date(actualStart),
      end: new Date(actualEnd),
    });
  }
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
