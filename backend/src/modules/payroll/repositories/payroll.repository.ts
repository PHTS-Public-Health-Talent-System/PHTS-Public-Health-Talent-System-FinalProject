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
  static buildListPeriodsQuery(): string {
    return `
      SELECT
        p.*,
        p.created_by,
        TRIM(CONCAT(IFNULL(e.first_name, ''), ' ', IFNULL(e.last_name, ''))) AS created_by_name
      FROM pay_periods p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      ORDER BY p.period_year DESC, p.period_month DESC
    `;
  }

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
    createdBy?: number | null,
  ): Promise<number> {
    const [res] = await db.execute<ResultSetHeader>(
      "INSERT INTO pay_periods (period_month, period_year, status, created_by) VALUES (?, ?, ?, ?)",
      [month, year, status, createdBy ?? null],
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
      PayrollRepository.buildListPeriodsQuery(),
    );
    return rows as PayPeriod[];
  }

  static async findPeriodsByStatus(
    status: PeriodStatus,
    limit: number = 10,
  ): Promise<PayPeriod[]> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM pay_periods
       WHERE status = ?
       ORDER BY period_year DESC, period_month DESC
       LIMIT ${safeLimit}`,
      [status],
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
        pi.user_id,
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
      LEFT JOIN users u ON u.id = pi.user_id
      LEFT JOIN emp_profiles e ON e.citizen_id = COALESCE(u.citizen_id, pi.citizen_id)
      WHERE pi.period_id = ?
      ORDER BY e.first_name ASC, e.last_name ASC, COALESCE(u.citizen_id, pi.citizen_id) ASC
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
      `
        SELECT COALESCE(u.citizen_id, pi.citizen_id) AS citizen_id
        FROM pay_period_items pi
        LEFT JOIN users u ON u.id = pi.user_id
        WHERE pi.period_id = ?
      `,
      [periodId],
    );
    return rows.map((r: any) => r.citizen_id);
  }

  static async insertPeriodItem(
    periodId: number,
    requestId: number,
    userId: number | null,
    citizenId: string,
    snapshotId: number | null,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `
      INSERT INTO pay_period_items (period_id, request_id, user_id, citizen_id, snapshot_id)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE snapshot_id = VALUES(snapshot_id)
      `,
      [periodId, requestId, userId, citizenId, snapshotId],
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

  static async findRequestUserId(
    requestId: number,
    conn: PoolConnection,
  ): Promise<number | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT user_id FROM req_submissions WHERE request_id = ?`,
      [requestId],
    );
    return (rows[0] as any)?.user_id ?? null;
  }

  static async findUserIdMapByCitizenIds(
    citizenIds: string[],
    conn: PoolConnection,
  ): Promise<Map<string, number>> {
    if (!citizenIds.length) return new Map();
    const placeholders = citizenIds.map(() => "?").join(",");
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, citizen_id FROM users WHERE citizen_id IN (${placeholders})`,
      citizenIds,
    );
    const map = new Map<string, number>();
    rows.forEach((row: any) => {
      if (row.citizen_id && row.id) {
        map.set(String(row.citizen_id), Number(row.id));
      }
    });
    return map;
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
        p.profession_code,
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
    const { start: fiscalStart, end: fiscalEnd } =
      PayrollRepository.getFiscalYearRange(fiscalYear);

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
      PayrollRepository.buildLeaveRowsQuery(ph),
      [...citizenIds, fiscalEnd, fiscalStart],
    );

    const [noSalaryRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT lr.citizen_id,
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

    const [returnReportRows] = await conn.query<RowDataPacket[]>(
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
               ext.pay_exception,
               COALESCE(ext.is_no_pay, ext.pay_exception, 0) AS is_no_pay
        FROM leave_records lr
        LEFT JOIN leave_record_extensions ext ON ext.leave_record_id = lr.id
        WHERE lr.citizen_id IN (${ph})
          AND COALESCE(ext.document_start_date, lr.start_date) <= ?
          AND COALESCE(ext.document_end_date, lr.end_date) >= ?
        ORDER BY lr.start_date ASC
      `;
  }

  static getFiscalYearRange(fiscalYear: number): { start: string; end: string } {
    const startYear = fiscalYear - 544;
    const endYear = fiscalYear - 543;
    return {
      start: `${startYear}-10-01`,
      end: `${endYear}-09-30`,
    };
  }

  // ── Connection helper ───────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
