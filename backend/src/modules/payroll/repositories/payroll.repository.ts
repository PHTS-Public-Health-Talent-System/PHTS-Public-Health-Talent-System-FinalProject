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
  private static professionReviewTableReady = false;
  private static payResultChecksTableReady = false;

  static async ensureProfessionReviewTable(): Promise<void> {
    if (PayrollRepository.professionReviewTableReady) return;
    await db.execute(
      `
      CREATE TABLE IF NOT EXISTS pay_period_profession_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        period_id INT NOT NULL,
        profession_code VARCHAR(64) NOT NULL,
        reviewed_by INT NOT NULL,
        reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_period_profession (period_id, profession_code),
        INDEX idx_period (period_id)
      )
      `,
    );
    PayrollRepository.professionReviewTableReady = true;
  }

  static async ensurePayResultChecksTable(): Promise<void> {
    if (PayrollRepository.payResultChecksTableReady) return;
    await db.execute(
      `
      CREATE TABLE IF NOT EXISTS pay_result_checks (
        check_id INT AUTO_INCREMENT PRIMARY KEY,
        payout_id INT NOT NULL,
        code VARCHAR(64) NOT NULL,
        severity VARCHAR(16) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary VARCHAR(512) NULL,
        impact_days DECIMAL(6,2) NULL,
        impact_amount DECIMAL(12,2) NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        evidence_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payout (payout_id),
        INDEX idx_code (code),
        INDEX idx_severity (severity)
      )
      `,
    );
    PayrollRepository.payResultChecksTableReady = true;
  }

  // ── Period CRUD ──────────────────────────────────────────────────────────
  static buildListPeriodsQuery(): string {
    return `
      SELECT
        p.*,
        p.created_by,
        COALESCE(
          NULLIF(
            TRIM(
              CONCAT(
                IFNULL(COALESCE(e.first_name, s.first_name), ''),
                ' ',
                IFNULL(COALESCE(e.last_name, s.last_name), '')
              )
            ),
            ''
          ),
          u.citizen_id,
          'ระบบ'
        ) AS created_by_name
      FROM pay_periods p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
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
      `
      SELECT
        p.*,
        p.created_by,
        COALESCE(
          NULLIF(
            TRIM(
              CONCAT(
                IFNULL(COALESCE(e.first_name, s.first_name), ''),
                ' ',
                IFNULL(COALESCE(e.last_name, s.last_name), '')
              )
            ),
            ''
          ),
          u.citizen_id,
          'ระบบ'
        ) AS created_by_name
      FROM pay_periods p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE p.period_id = ?
      LIMIT 1
      `,
      [periodId],
    );
    return (rows[0] as PayPeriod) ?? null;
  }

  static async findPeriodByIdForUpdate(
    periodId: number,
    conn: PoolConnection,
  ): Promise<PayPeriod | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT
        p.*,
        p.created_by,
        COALESCE(
          NULLIF(
            TRIM(
              CONCAT(
                IFNULL(COALESCE(e.first_name, s.first_name), ''),
                ' ',
                IFNULL(COALESCE(e.last_name, s.last_name), '')
              )
            ),
            ''
          ),
          u.citizen_id,
          'ระบบ'
        ) AS created_by_name
      FROM pay_periods p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE p.period_id = ?
      FOR UPDATE
      `,
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

  static async findRequiredProfessionCodesByPeriod(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `
      SELECT DISTINCT
        UPPER(
          COALESCE(
            NULLIF(p.profession_code, ''),
            NULLIF(r.profession_code, '')
          )
        ) AS profession_code
      FROM pay_results p
      LEFT JOIN cfg_payment_rates r ON r.rate_id = p.master_rate_id
      WHERE p.period_id = ?
      `,
      [periodId],
    );
    return rows
      .map((row: any) => String(row.profession_code ?? "").trim())
      .filter((code) => code.length > 0);
  }

  static async findReviewedProfessionCodesByPeriod(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    await PayrollRepository.ensureProfessionReviewTable();
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `
      SELECT UPPER(profession_code) AS profession_code
      FROM pay_period_profession_reviews
      WHERE period_id = ?
      `,
      [periodId],
    );
    return rows
      .map((row: any) => String(row.profession_code ?? "").trim())
      .filter((code) => code.length > 0);
  }

  static async setProfessionReview(
    periodId: number,
    professionCode: string,
    reviewed: boolean,
    actorId: number,
    conn?: PoolConnection,
  ): Promise<void> {
    await PayrollRepository.ensureProfessionReviewTable();
    const executor = conn ?? db;
    if (reviewed) {
      await executor.execute(
        `
        INSERT INTO pay_period_profession_reviews
          (period_id, profession_code, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          reviewed_by = VALUES(reviewed_by),
          reviewed_at = VALUES(reviewed_at),
          updated_at = NOW()
        `,
        [periodId, professionCode, actorId],
      );
      return;
    }

    await executor.execute(
      `
      DELETE FROM pay_period_profession_reviews
      WHERE period_id = ? AND profession_code = ?
      `,
      [periodId, professionCode],
    );
  }

  static async clearProfessionReviewsByPeriod(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<void> {
    await PayrollRepository.ensureProfessionReviewTable();
    const executor = conn ?? db;
    await executor.execute(
      `DELETE FROM pay_period_profession_reviews WHERE period_id = ?`,
      [periodId],
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

  static async deletePayResultChecksByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `
      DELETE c
      FROM pay_result_checks c
      INNER JOIN pay_results p ON p.payout_id = c.payout_id
      WHERE p.period_id = ?
      `,
      [periodId],
    );
  }

  static async deletePayResultItemsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `
      DELETE i
      FROM pay_result_items i
      INNER JOIN pay_results p ON p.payout_id = i.payout_id
      WHERE p.period_id = ?
      `,
      [periodId],
    );
  }

  static async deletePeriodItemsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute("DELETE FROM pay_period_items WHERE period_id = ?", [
      periodId,
    ]);
  }

  static async deletePeriodById(
    periodId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute("DELETE FROM pay_periods WHERE period_id = ?", [periodId]);
  }

  static async findPayoutEditContextByIdForUpdate(
    payoutId: number,
    conn: PoolConnection,
  ): Promise<RowDataPacket | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT
        p.payout_id,
        p.period_id,
        p.citizen_id,
        p.pts_rate_snapshot,
        p.calculated_amount,
        p.retroactive_amount,
        p.total_payable,
        p.deducted_days,
        p.eligible_days,
        p.remark,
        pp.period_month,
        pp.period_year,
        pp.status AS period_status,
        pp.is_frozen
      FROM pay_results p
      INNER JOIN pay_periods pp ON pp.period_id = p.period_id
      WHERE p.payout_id = ?
      FOR UPDATE
      `,
      [payoutId],
    );
    return (rows[0] as RowDataPacket) ?? null;
  }

  static async sumPayResultsByPeriod(
    periodId: number,
    conn: PoolConnection,
  ): Promise<{ totalAmount: number; headCount: number }> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT
        COALESCE(SUM(total_payable), 0) AS total_amount,
        COUNT(*) AS headcount
      FROM pay_results
      WHERE period_id = ?
      `,
      [periodId],
    );
    const row = (rows[0] as any) ?? {};
    return {
      totalAmount: Number(row.total_amount ?? 0),
      headCount: Number(row.headcount ?? 0),
    };
  }

  static async findPayoutsByPeriod(periodId: number): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        p.payout_id,
        p.citizen_id,
        (
          SELECT re.eligibility_id
          FROM req_eligibility re
          WHERE re.citizen_id = p.citizen_id
            AND re.master_rate_id = p.master_rate_id
          ORDER BY re.is_active DESC, re.effective_date DESC, re.eligibility_id DESC
          LIMIT 1
        ) AS eligibility_id,
        COALESCE(
          (
            SELECT ppi.request_id
            FROM pay_period_items ppi
            WHERE ppi.period_id = p.period_id
              AND ppi.citizen_id = p.citizen_id
            ORDER BY ppi.period_item_id DESC
            LIMIT 1
          ),
          (
            SELECT ppi.request_id
            FROM pay_period_items ppi
            INNER JOIN users uu ON uu.id = ppi.user_id
            WHERE ppi.period_id = p.period_id
              AND uu.citizen_id = p.citizen_id
            ORDER BY ppi.period_item_id DESC
            LIMIT 1
          )
        ) AS request_id,
        r.profession_code,
        p.retroactive_amount,
        e.first_name,
        e.last_name,
        e.title,
        e.position_name,
        e.department,
        r.group_no,
        r.item_no,
        r.sub_item_no,
        p.eligible_days,
        p.deducted_days,
        p.pts_rate_snapshot as rate,
        p.total_payable,
        p.remark,
        (
          SELECT COUNT(*)
          FROM pay_result_checks c
          WHERE c.payout_id = p.payout_id
        ) AS check_count,
        (
          SELECT COUNT(*)
          FROM pay_result_checks c
          WHERE c.payout_id = p.payout_id AND c.severity = 'BLOCKER'
        ) AS blocker_count,
        (
          SELECT COUNT(*)
          FROM pay_result_checks c
          WHERE c.payout_id = p.payout_id AND c.severity = 'WARNING'
        ) AS warning_count
      FROM pay_results p
      LEFT JOIN emp_profiles e ON e.citizen_id = p.citizen_id
      LEFT JOIN cfg_payment_rates r ON r.rate_id = p.master_rate_id
      WHERE p.period_id = ?
      ORDER BY e.first_name ASC, e.last_name ASC, p.citizen_id ASC
      `,
      [periodId],
    );
    return rows;
  }

  static async findPayoutChecksByPayoutId(payoutId: number): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT *
      FROM pay_result_checks
      WHERE payout_id = ?
      ORDER BY
        CASE severity WHEN 'BLOCKER' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
        impact_amount DESC,
        impact_days DESC,
        check_id ASC
      `,
      [payoutId],
    );
    return rows;
  }

  static async findPayoutItemsByPayoutId(payoutId: number): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT *
      FROM pay_result_items
      WHERE payout_id = ?
      ORDER BY item_id ASC
      `,
      [payoutId],
    );
    return rows;
  }

  static async findPayoutDetailById(payoutId: number): Promise<RowDataPacket | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        p.*,
        pp.period_month,
        pp.period_year,
        TRIM(CONCAT(IFNULL(e.first_name, ''), ' ', IFNULL(e.last_name, ''))) AS full_name,
        e.first_name,
        e.last_name,
        e.title,
        e.position_name,
        e.department,
        r.profession_code,
        r.group_no,
        r.item_no,
        r.sub_item_no
      FROM pay_results p
      LEFT JOIN pay_periods pp ON pp.period_id = p.period_id
      LEFT JOIN emp_profiles e ON e.citizen_id = p.citizen_id
      LEFT JOIN cfg_payment_rates r ON r.rate_id = p.master_rate_id
      WHERE p.payout_id = ?
      LIMIT 1
      `,
      [payoutId],
    );
    return (rows[0] as RowDataPacket) ?? null;
  }

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
      WHERE is_active = 1
        AND effective_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
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
      PayrollRepository.getFiscalYearRange(fiscalYear);

    const [eligibilityRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT citizen_id, effective_date, expiry_date, m.amount as rate, m.rate_id
        FROM req_eligibility e
        JOIN cfg_payment_rates m ON e.master_rate_id = m.rate_id
        WHERE e.citizen_id IN (${ph})
        AND e.is_active = 1
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
