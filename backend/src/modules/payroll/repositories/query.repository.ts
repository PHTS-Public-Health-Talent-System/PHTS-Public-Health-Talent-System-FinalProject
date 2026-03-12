import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db from "@config/database.js";

export interface BatchEmployeeData {
  eligibilityRows: RowDataPacket[];
  movementRows: RowDataPacket[];
  employeeRows: RowDataPacket[];
  licenseRows: RowDataPacket[];
  leaveRows: RowDataPacket[];
  quotaRows: RowDataPacket[];
  noSalaryRows: RowDataPacket[];
  returnReportRows: Array<{ leave_record_id: number; return_date: string | Date }>;
}

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
    let leaveEvents = eventMap.get(leaveId);
    if (!leaveEvents) {
      leaveEvents = [];
      eventMap.set(leaveId, leaveEvents);
    }
    leaveEvents.push({
      report_date: String(event.report_date),
      resume_date:
        event.resume_date === null || event.resume_date === undefined
          ? null
          : String(event.resume_date),
      resume_study_institution:
        event.resume_study_institution === null || event.resume_study_institution === undefined
          ? null
          : String(event.resume_study_institution),
      resume_study_program:
        event.resume_study_program === null || event.resume_study_program === undefined
          ? null
          : String(event.resume_study_program),
      resume_study_major:
        event.resume_study_major === null || event.resume_study_major === undefined
          ? null
          : String(event.resume_study_major),
    });
  }
  return leaveRows.map((row: any) => ({
    ...row,
    return_report_events: eventMap.get(Number(row.id)) ?? [],
  }));
};

export class PayrollQueryRepository {
  static async findHolidayDatesInRange(
    startDate: string,
    endDate: string,
  ): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT holiday_date
      FROM cfg_holidays
      WHERE holiday_date BETWEEN ? AND ?
      `,
      [startDate, endDate],
    );
    return rows;
  }

  static async findHolidays(
    yearStart: number,
    yearEnd: number,
    conn: PoolConnection,
  ): Promise<RowDataPacket[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT holiday_date FROM cfg_holidays WHERE holiday_date BETWEEN ? AND ?`,
      [`${yearStart}-01-01`, `${yearEnd}-12-31`],
    );
    return rows;
  }

  static async findEligibleCitizenIds(
    year: number,
    month: number,
    conn: PoolConnection,
  ): Promise<string[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT DISTINCT citizen_id FROM req_eligibility
      WHERE effective_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
        AND (expiry_date IS NULL OR expiry_date >= STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
      `,
      [year, month, year, month],
    );
    return rows.map((r: any) => r.citizen_id);
  }

  static async fetchBatchData(
    citizenIds: string[],
    startOfMonth: Date,
    endOfMonth: Date,
    fiscalYear: number,
    conn: PoolConnection,
  ): Promise<BatchEmployeeData> {
    const ph = citizenIds.map(() => "?").join(",");
    const { start: fiscalStart, end: fiscalEnd } =
      PayrollQueryRepository.getFiscalYearRange(fiscalYear);

    const [eligibilityRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT
          e.eligibility_id,
          e.master_rate_id,
          citizen_id,
          effective_date,
          expiry_date,
          m.amount as rate,
          m.rate_id,
          m.group_no,
          m.item_no,
          m.sub_item_no
        FROM req_eligibility e
        JOIN cfg_payment_rates m ON e.master_rate_id = m.rate_id
        WHERE e.citizen_id IN (${ph})
        AND e.effective_date <= ?
        AND (e.expiry_date IS NULL OR e.expiry_date >= ?)
        ORDER BY e.effective_date ASC
      `,
      [...citizenIds, endOfMonth, startOfMonth],
    );

    const [movementRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT * FROM emp_movements
        WHERE citizen_id IN (${ph}) AND effective_date <= ?
        ORDER BY effective_date ASC, created_at ASC
      `,
      [...citizenIds, endOfMonth],
    );

    const [employeeRows] = await conn.query<RowDataPacket[]>(
      `SELECT citizen_id, position_name, first_entry_date, start_work_date
       FROM emp_profiles WHERE citizen_id IN (${ph})`,
      citizenIds,
    );

    const [licenseRows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM emp_licenses WHERE citizen_id IN (${ph})`,
      citizenIds,
    );

    const [rawLeaveRows] = await conn.query<RowDataPacket[]>(
      PayrollQueryRepository.buildLeaveRowsQuery(ph),
      [...citizenIds, fiscalEnd, fiscalStart],
    );
    const returnReportEventRows =
      await PayrollQueryRepository.findReturnReportEvents(citizenIds, ph, conn);
    const leaveRows = attachReturnReportEvents(rawLeaveRows, returnReportEventRows);

    const [noSalaryRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT lr.citizen_id,
               lr.id AS leave_record_id,
               lr.leave_type,
               COALESCE(ext.document_start_date, lr.start_date) AS start_date,
               COALESCE(ext.document_end_date, lr.end_date) AS end_date
        FROM leave_record_extensions ext
        JOIN leave_records lr ON lr.id = ext.leave_record_id
        WHERE lr.citizen_id IN (${ph})
          AND COALESCE(ext.is_no_pay, ext.pay_exception) = 1
          AND COALESCE(ext.document_start_date, lr.start_date) <= ?
          AND COALESCE(ext.document_end_date, lr.end_date) >= ?
      `,
      [...citizenIds, endOfMonth, startOfMonth],
    );

    const [quotaRows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM leave_quotas WHERE citizen_id IN (${ph}) AND fiscal_year = ?`,
      [...citizenIds, fiscalYear],
    );

    const [legacyReturnReportRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT ext.leave_record_id, ext.return_date
        FROM leave_record_extensions ext
        JOIN leave_records lr ON lr.id = ext.leave_record_id
        WHERE lr.citizen_id IN (${ph})
          AND ext.return_report_status = 'DONE'
          AND ext.return_date IS NOT NULL
      `,
      citizenIds,
    );
    const returnReportRows: Array<{ leave_record_id: number; return_date: string | Date }> =
      returnReportEventRows.length > 0
        ? returnReportEventRows.map((row) => ({
            leave_record_id: Number(row.leave_record_id),
            return_date: row.report_date,
          }))
        : legacyReturnReportRows.map((row: any) => ({
            leave_record_id: Number(row.leave_record_id),
            return_date: row.return_date,
          }));
    // Source of truth is leave_return_report_events; extension return_date is legacy fallback only.

    return {
      eligibilityRows,
      movementRows,
      employeeRows,
      licenseRows,
      leaveRows,
      quotaRows,
      noSalaryRows,
      returnReportRows,
    };
  }

  static buildLeaveRowsQuery(ph: string): string {
    return `
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
        WHERE lr.citizen_id IN (${ph})
          AND COALESCE(ext.document_start_date, lr.start_date) <= ?
          AND COALESCE(ext.document_end_date, lr.end_date) >= ?
        ORDER BY lr.start_date ASC
      `;
  }

  static async findReturnReportEvents(
    citizenIds: string[],
    placeholders: string,
    conn: PoolConnection,
  ): Promise<ReturnReportEventRow[]> {
    try {
      const [rows] = await conn.query<RowDataPacket[]>(
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
          WHERE lr.citizen_id IN (${placeholders})
          ORDER BY evt.leave_record_id ASC, evt.report_date ASC, evt.event_id ASC
        `,
        citizenIds,
      );
      return rows as ReturnReportEventRow[];
    } catch (error: any) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        return [];
      }
      throw error;
    }
  }

  static getFiscalYearRange(fiscalYear: number): { start: string; end: string } {
    const startYear = fiscalYear - 544;
    const endYear = fiscalYear - 543;
    return {
      start: `${startYear}-10-01`,
      end: `${endYear}-09-30`,
    };
  }
}
