import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db from "@config/database.js";

export class PayrollPayoutRepository {
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
        pp.is_locked,
        pp.snapshot_status
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

  static async findPaymentRatesByIds(rateIds: number[]): Promise<RowDataPacket[]> {
    if (!rateIds.length) return [];
    const placeholders = rateIds.map(() => "?").join(",");
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT rate_id, group_no, item_no, sub_item_no
      FROM cfg_payment_rates
      WHERE rate_id IN (${placeholders})
      `,
      rateIds,
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
        pp.status AS period_status,
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
          COALESCE(r.profession_code, 'UNKNOWN') AS profession_code,
          COALESCE(MAX(e.position_name), 'UNKNOWN') AS position_name,
          COUNT(*) AS headcount,
          SUM(p.total_payable) AS total_payable,
          SUM(CASE WHEN p.deducted_days > 0 THEN 1 ELSE 0 END) AS deducted_count,
          SUM(CASE WHEN p.deducted_days > 0 THEN p.total_payable ELSE 0 END) AS deducted_total
        FROM pay_results p
        LEFT JOIN emp_profiles e ON e.citizen_id = p.citizen_id
        LEFT JOIN cfg_payment_rates r ON r.rate_id = p.master_rate_id
        WHERE p.period_id = ?
        GROUP BY profession_code
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
        pp.status AS period_status,
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
}
