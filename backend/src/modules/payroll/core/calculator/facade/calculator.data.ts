import { PoolConnection, RowDataPacket } from "mysql2/promise";
import pool from "@config/database.js";
import { formatLocalDate, makeLocalDate } from "@/modules/payroll/core/utils/date.utils.js";
import type {
  EmployeeBatchData,
  HolidayRow,
} from "@/modules/payroll/core/calculator/facade/calculator.js";
import type { ReturnReportRow } from "@/modules/payroll/core/deductions/deductions.js";

type ReturnReportEventRow = RowDataPacket & {
  leave_record_id: number;
  report_date: string | Date;
  resume_date?: string | Date | null;
  resume_study_institution?: string | null;
  resume_study_program?: string | null;
  resume_study_major?: string | null;
};

const attachReturnReportEvents = (
  leaveRows: RowDataPacket[],
  eventRows: ReturnReportEventRow[],
): RowDataPacket[] => {
  if (!leaveRows.length || !eventRows.length) {
    return leaveRows.map((row) => ({ ...row, return_report_events: [] }));
  }

  const eventMap = new Map<number, Array<{
    report_date: string;
    resume_date: string | null;
    resume_study_institution: string | null;
    resume_study_program: string | null;
    resume_study_major: string | null;
  }>>();
  for (const event of eventRows) {
    const leaveId = Number(event.leave_record_id);
    if (!Number.isFinite(leaveId)) continue;
    const events = eventMap.get(leaveId) ?? [];
    if (!eventMap.has(leaveId)) eventMap.set(leaveId, events);
    events.push({
      report_date: formatLocalDate(event.report_date),
      resume_date: formatLocalDate(event.resume_date ?? null) || null,
      resume_study_institution: event.resume_study_institution ?? null,
      resume_study_program: event.resume_study_program ?? null,
      resume_study_major: event.resume_study_major ?? null,
    });
  }

  return leaveRows.map((row: any) => ({
    ...row,
    return_report_events: eventMap.get(Number(row.id)) ?? [],
  }));
};

const loadReturnReportEventRows = async (
  dbConn: Pick<PoolConnection, "query">,
  citizenId: string,
): Promise<ReturnReportEventRow[]> => {
  try {
    const [rows] = await dbConn.query<RowDataPacket[]>(
      `
        SELECT
          evt.leave_record_id,
          evt.report_date,
          evt.resume_date,
          evt.resume_study_institution,
          evt.resume_study_program,
          evt.resume_study_major
        FROM leave_return_report_events evt
        JOIN leave_records lr ON lr.id = evt.leave_record_id
        WHERE lr.citizen_id = ?
        ORDER BY evt.leave_record_id ASC, evt.report_date ASC, evt.event_id ASC
      `,
      [citizenId],
    );
    return rows as ReturnReportEventRow[];
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return [];
    }
    throw error;
  }
};

export async function loadEmployeeBatchData(
  citizenId: string,
  year: number,
  month: number,
  connection?: PoolConnection,
): Promise<EmployeeBatchData> {
  const dbConn: Pick<PoolConnection, "query"> = connection ?? pool;
  const startOfMonth = makeLocalDate(year, month - 1, 1);
  const endOfMonth = makeLocalDate(year, month, 0);
  const startOfMonthStr = formatLocalDate(startOfMonth);
  const endOfMonthStr = formatLocalDate(endOfMonth);
  const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;

  const [eligibilityRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT e.effective_date, e.expiry_date, m.amount as rate, m.rate_id, m.profession_code, m.group_no, m.item_no, m.sub_item_no
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

  const [rawLeaveRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT lr.*,
             ext.document_start_date,
             ext.document_end_date,
             ext.document_duration_days,
             ext.require_return_report,
             ext.return_report_status,
             ext.pay_exception,
             ext.study_institution,
             ext.study_program,
             ext.study_major,
             COALESCE(ext.is_no_pay, ext.pay_exception, 0) AS is_no_pay
      FROM leave_records lr
      LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
      WHERE lr.citizen_id = ?
        AND COALESCE(ext.document_start_date, lr.start_date) <= ?
        AND COALESCE(ext.document_end_date, lr.end_date) >= ?
      ORDER BY lr.start_date ASC
    `,
    [citizenId, endOfMonthStr, startOfMonthStr],
  );
  const returnReportEventRows = await loadReturnReportEventRows(dbConn, citizenId);
  const leaveRows = attachReturnReportEvents(rawLeaveRows, returnReportEventRows);

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

  const fallbackReturnReportRows = await dbConn.query<RowDataPacket[]>(
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
  const returnReportRows: ReturnReportRow[] =
    returnReportEventRows.length > 0
      ? returnReportEventRows.map((row) => ({
          leave_record_id: Number(row.leave_record_id),
          return_date: row.report_date,
        }))
      : (fallbackReturnReportRows[0] as RowDataPacket[]).map((row: any) => ({
          leave_record_id: Number(row.leave_record_id),
          return_date: row.return_date,
        }));
  // Source of truth is leave_return_report_events; extension return_date is legacy fallback only.

  const [quotaRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT * FROM leave_quotas WHERE citizen_id = ? AND fiscal_year = ?`,
    [citizenId, fiscalYear],
  );

  const [holidayRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT holiday_date FROM cfg_holidays WHERE holiday_date BETWEEN ? AND ?`,
    [`${year - 1}-01-01`, `${year}-12-31`],
  );

  return {
    eligibilityRows,
    movementRows,
    employeeRow: employeeRows[0] || {},
    licenseRows,
    leaveRows,
    quotaRow: quotaRows[0] || null,
    holidays: (holidayRows as HolidayRow[]).map((h) => formatLocalDate(h.holiday_date)),
    noSalaryPeriods: noSalaryRows,
    returnReportRows,
  };
}
