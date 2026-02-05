import { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import { PayPeriod, PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';

// ─── Types for batch-fetched data ────────────────────────────────────────────

export interface BatchEmployeeData {
  eligibilityRows: RowDataPacket[];
  movementRows: RowDataPacket[];
  employeeRows: RowDataPacket[];
  licenseRows: RowDataPacket[];
  leaveRows: RowDataPacket[];
  quotaRows: RowDataPacket[];
  noSalaryRows: RowDataPacket[];
  returnReportRows: RowDataPacket[];
}

// ─── PayrollRepository ──────────────────────────────────────────────────────

export class PayrollRepository {
  // ── Period CRUD ──────────────────────────────────────────────────────────

  static async findPeriodByMonthYear(
    month: number,
    year: number,
  ): Promise<PayPeriod | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_month = ? AND period_year = ?",
      [month, year],
    );
    return (rows[0] as PayPeriod) ?? null;
  }

  static async insertPeriod(
    month: number,
    year: number,
    status: PeriodStatus,
  ): Promise<number> {
    const [res] = await db.execute<ResultSetHeader>(
      "INSERT INTO pay_periods (period_month, period_year, status) VALUES (?, ?, ?)",
      [month, year, status],
    );
    return res.insertId;
  }

  static async findPeriodById(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<PayPeriod | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_id = ?",
      [periodId],
    );
    return (rows[0] as PayPeriod) ?? null;
  }

  static async findPeriodByIdForUpdate(
    periodId: number,
    conn: PoolConnection,
  ): Promise<PayPeriod | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE",
      [periodId],
    );
    return (rows[0] as PayPeriod) ?? null;
  }

  static async findAllPeriods(): Promise<PayPeriod[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods ORDER BY period_year DESC, period_month DESC",
    );
    return rows as PayPeriod[];
  }

  static async findPeriodItems(
    periodId: number,
  ): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        pi.period_item_id,
        pi.period_id,
        pi.request_id,
        pi.citizen_id,
        pi.snapshot_id,
        r.request_no,
        r.personnel_type,
        r.current_department,
        e.first_name,
        e.last_name,
        e.position_name
      FROM pay_period_items pi
      LEFT JOIN req_submissions r ON r.request_id = pi.request_id
      LEFT JOIN emp_profiles e ON e.citizen_id = pi.citizen_id
      WHERE pi.period_id = ?
      ORDER BY e.first_name ASC, e.last_name ASC, pi.citizen_id ASC
      `,
      [periodId],
    );
    return rows;
  }

  static async findPeriodItemCitizenIds(
    periodId: number,
    conn: PoolConnection,
  ): Promise<string[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT citizen_id FROM pay_period_items WHERE period_id = ?`,
      [periodId],
    );
    return rows.map((r: any) => r.citizen_id);
  }

  static async insertPeriodItem(
    periodId: number,
    requestId: number,
    citizenId: string,
    snapshotId: number | null,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `
      INSERT INTO pay_period_items (period_id, request_id, citizen_id, snapshot_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE snapshot_id = VALUES(snapshot_id)
      `,
      [periodId, requestId, citizenId, snapshotId],
    );
  }

  static async deletePeriodItem(
    periodId: number,
    itemId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `DELETE FROM pay_period_items WHERE period_id = ? AND period_item_id = ?`,
      [periodId, itemId],
    );
  }

  static async findRequestCitizenId(
    requestId: number,
    conn: PoolConnection,
  ): Promise<string | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT citizen_id FROM req_submissions WHERE request_id = ?`,
      [requestId],
    );
    return (rows[0] as any)?.citizen_id ?? null;
  }

  static async findLatestVerificationSnapshotId(
    requestId: number,
    conn: PoolConnection,
  ): Promise<number | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT snapshot_id
      FROM req_verification_snapshots
      WHERE request_id = ?
      ORDER BY created_at DESC, snapshot_id DESC
      LIMIT 1
      `,
      [requestId],
    );
    return (rows[0] as any)?.snapshot_id ?? null;
  }

  static async updatePeriodTotals(
    periodId: number,
    totalAmount: number,
    headCount: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      "UPDATE pay_periods SET total_amount = ?, total_headcount = ?, updated_at = NOW() WHERE period_id = ?",
      [totalAmount, headCount, periodId],
    );
  }

  static async updatePeriodStatus(
    periodId: number,
    status: PeriodStatus,
    conn: PoolConnection,
  ): Promise<void> {
    let sql = "UPDATE pay_periods SET status = ?";
    const params: unknown[] = [status];

    if (status === PeriodStatus.CLOSED) {
      sql += ", closed_at = NOW()";
    }

    sql += " WHERE period_id = ?";
    params.push(periodId);

    await conn.execute(sql, params);
  }

  static async updatePeriodFreeze(
    periodId: number,
    isFrozen: boolean,
    actorId: number | null,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `
      UPDATE pay_periods
      SET is_frozen = ?, frozen_at = ?, frozen_by = ?, updated_at = NOW()
      WHERE period_id = ?
      `,
      [isFrozen ? 1 : 0, isFrozen ? new Date() : null, isFrozen ? actorId : null, periodId],
    );
  }

  // ── Pay Results ─────────────────────────────────────────────────────────

  static async deletePayResultsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute("DELETE FROM pay_results WHERE period_id = ?", [
      periodId,
    ]);
  }

  static async findPayoutsByPeriod(periodId: number): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        p.payout_id,
        p.citizen_id,
        e.first_name,
        e.last_name,
        e.position_name,
        p.eligible_days,
        p.deducted_days,
        p.pts_rate_snapshot as rate,
        p.total_payable,
        p.remark
      FROM pay_results p
      LEFT JOIN emp_profiles e ON e.citizen_id = p.citizen_id
      WHERE p.period_id = ?
      ORDER BY e.first_name ASC, e.last_name ASC, p.citizen_id ASC
      `,
      [periodId],
    );
    return rows;
  }

  static async findPayResultCountByPeriod(periodId: number): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM pay_results WHERE period_id = ?",
      [periodId],
    );
    return Number((rows[0] as any)?.total || 0);
  }

  static async findProfessionSummaryByPeriod(
    periodId: number,
  ): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          COALESCE(e.position_name, 'UNKNOWN') AS position_name,
          COUNT(*) AS headcount,
          SUM(p.total_payable) AS total_payable,
          SUM(CASE WHEN p.deducted_days > 0 THEN 1 ELSE 0 END) AS deducted_count,
          SUM(CASE WHEN p.deducted_days > 0 THEN p.total_payable ELSE 0 END) AS deducted_total
        FROM pay_results p
        LEFT JOIN emp_profiles e ON e.citizen_id = p.citizen_id
        WHERE p.period_id = ?
        GROUP BY position_name
        ORDER BY total_payable DESC
      `,
      [periodId],
    );
    return rows;
  }

  static async searchPayouts(params: {
    q: string;
    periodYear?: number;
    periodMonth?: number;
  }): Promise<RowDataPacket[]> {
    const keyword = `%${params.q}%`;
    const conditions: string[] = [
      `(p.citizen_id LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ? OR e.position_name LIKE ?)`,
    ];
    const values: any[] = [keyword, keyword, keyword, keyword];

    if (params.periodYear) {
      conditions.push("pp.period_year = ?");
      values.push(params.periodYear);
    }
    if (params.periodMonth) {
      conditions.push("pp.period_month = ?");
      values.push(params.periodMonth);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        p.payout_id,
        p.citizen_id,
        p.pts_rate_snapshot,
        p.total_payable,
        p.retroactive_amount,
        pp.period_id,
        pp.period_month,
        pp.period_year,
        e.first_name,
        e.last_name,
        e.position_name
      FROM pay_results p
      LEFT JOIN pay_periods pp ON pp.period_id = p.period_id
      LEFT JOIN emp_profiles e ON e.citizen_id = p.citizen_id
      ${where}
      ORDER BY pp.period_year DESC, pp.period_month DESC, e.first_name ASC
      `,
      values,
    );
    return rows;
  }

  // ── Batch data fetching for calculation ─────────────────────────────────

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
      `,
      [year, month],
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

    const [eligibilityRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT citizen_id, effective_date, expiry_date, m.amount as rate, m.rate_id
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

    const [leaveRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT * FROM leave_records
        WHERE citizen_id IN (${ph}) AND fiscal_year = ?
        ORDER BY start_date ASC
      `,
      [...citizenIds, fiscalYear],
    );

    const [noSalaryRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT citizen_id, start_date, end_date
        FROM leave_pay_exceptions
        WHERE citizen_id IN (${ph})
          AND start_date <= ?
          AND end_date >= ?
      `,
      [...citizenIds, endOfMonth, startOfMonth],
    );

    const [quotaRows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM leave_quotas WHERE citizen_id IN (${ph}) AND fiscal_year = ?`,
      [...citizenIds, fiscalYear],
    );

    // Return reports (depends on leaveRows)
    const leaveIds = (leaveRows as any[])
      .map((row) => row.id)
      .filter(Boolean);
    let returnReportRows: RowDataPacket[] = [];
    if (leaveIds.length > 0) {
      const leavePh = leaveIds.map(() => "?").join(",");
      const [rows] = await conn.query<RowDataPacket[]>(
        `
          SELECT leave_record_id, return_date
          FROM leave_return_reports
          WHERE leave_record_id IN (${leavePh})
        `,
        leaveIds,
      );
      returnReportRows = rows;
    }

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

  // ── Leave Pay Exceptions ────────────────────────────────────────────────

  static async insertLeavePayException(
    citizenId: string,
    startDate: string,
    endDate: string,
    reason: string | null,
    createdBy: number,
  ): Promise<number> {
    const [res] = await db.execute<ResultSetHeader>(
      `
        INSERT INTO leave_pay_exceptions
        (citizen_id, start_date, end_date, reason, created_by)
        VALUES (?, ?, ?, ?, ?)
      `,
      [citizenId, startDate, endDate, reason, createdBy],
    );
    return res.insertId;
  }

  static async findLeavePayExceptions(
    citizenId?: string,
  ): Promise<RowDataPacket[]> {
    if (citizenId) {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT * FROM leave_pay_exceptions WHERE citizen_id = ? ORDER BY start_date DESC`,
        [citizenId],
      );
      return rows;
    }
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM leave_pay_exceptions ORDER BY start_date DESC",
    );
    return rows;
  }

  static async deleteLeavePayException(exceptionId: number): Promise<boolean> {
    const [res] = await db.execute<ResultSetHeader>(
      "DELETE FROM leave_pay_exceptions WHERE exception_id = ?",
      [exceptionId],
    );
    return res.affectedRows > 0;
  }

  // ── Leave Return Reports ────────────────────────────────────────────────

  static async findLeaveRecordById(
    leaveRecordId: number,
  ): Promise<RowDataPacket | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, citizen_id, leave_type FROM leave_records WHERE id = ? LIMIT 1",
      [leaveRecordId],
    );
    return (rows[0] as RowDataPacket) ?? null;
  }

  static async insertLeaveReturnReport(
    leaveRecordId: number,
    citizenId: string,
    returnDate: string,
    remark: string | null,
    createdBy: number,
  ): Promise<number> {
    const [res] = await db.execute<ResultSetHeader>(
      `
        INSERT INTO leave_return_reports
        (leave_record_id, citizen_id, return_date, remark, created_by)
        VALUES (?, ?, ?, ?, ?)
      `,
      [leaveRecordId, citizenId, returnDate, remark, createdBy],
    );
    return res.insertId;
  }

  static async findLeaveReturnReports(params: {
    citizenId?: string;
    leaveRecordId?: number;
  }): Promise<RowDataPacket[]> {
    const clauses: string[] = [];
    const sqlParams: unknown[] = [];

    if (params.citizenId) {
      clauses.push("citizen_id = ?");
      sqlParams.push(params.citizenId);
    }
    if (params.leaveRecordId) {
      clauses.push("leave_record_id = ?");
      sqlParams.push(params.leaveRecordId);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM leave_return_reports ${whereClause} ORDER BY return_date DESC`,
      sqlParams,
    );
    return rows;
  }

  static async deleteLeaveReturnReport(reportId: number): Promise<boolean> {
    const [res] = await db.execute<ResultSetHeader>(
      "DELETE FROM leave_return_reports WHERE report_id = ?",
      [reportId],
    );
    return res.affectedRows > 0;
  }

  // ── Connection helper ───────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
