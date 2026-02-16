/**
 * Finance Module - Repository
 *
 * Handles all database operations for finance
 */

import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db, { getConnection } from '@config/database.js';
import {
  PaymentStatus,
  PayoutWithDetails,
  FinanceSummary,
  YearlySummary,
} from '@/modules/finance/entities/finance.entity.js';

export class FinanceRepository {
  // ── Payout queries ──────────────────────────────────────────────────────────

  static async findPeriodWorkflowContextById(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<{ period_id: number; status: string; is_frozen: number } | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT period_id, status, is_frozen FROM pay_periods WHERE period_id = ?",
      [periodId],
    );
    return (rows[0] as any) ?? null;
  }

  static async findPayoutById(
    payoutId: number,
    conn?: PoolConnection,
  ): Promise<{ payment_status: PaymentStatus; total_payable: number } | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT payment_status, total_payable FROM pay_results WHERE payout_id = ?",
      [payoutId],
    );
    return (rows[0] as any) ?? null;
  }

  static async findPayoutWorkflowContextByIdForUpdate(
    payoutId: number,
    conn: PoolConnection,
  ): Promise<{
    payout_id: number;
    period_id: number;
    payment_status: PaymentStatus;
    total_payable: number;
    period_status: string;
    is_frozen: number;
  } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT
        p.payout_id,
        p.period_id,
        p.payment_status,
        p.total_payable,
        pp.status AS period_status,
        pp.is_frozen
      FROM pay_results p
      INNER JOIN pay_periods pp ON pp.period_id = p.period_id
      WHERE p.payout_id = ?
      FOR UPDATE
      `,
      [payoutId],
    );
    return (rows[0] as any) ?? null;
  }

  static async findPayoutByIdForUpdate(
    payoutId: number,
    conn: PoolConnection,
  ): Promise<{ payment_status: PaymentStatus; total_payable: number } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT payment_status, total_payable FROM pay_results WHERE payout_id = ? FOR UPDATE",
      [payoutId],
    );
    return (rows[0] as any) ?? null;
  }

  static async updatePayoutStatus(
    payoutId: number,
    status: PaymentStatus,
    paidBy: number | null,
    conn: PoolConnection,
  ): Promise<void> {
    if (status === PaymentStatus.PAID) {
      await conn.execute(
        `UPDATE pay_results
         SET payment_status = ?, paid_at = NOW(), paid_by = ?
         WHERE payout_id = ?`,
        [status, paidBy, payoutId],
      );
    } else {
      await conn.execute(
        `UPDATE pay_results
         SET payment_status = ?, updated_at = NOW()
         WHERE payout_id = ?`,
        [status, payoutId],
      );
    }
  }

  static async findPayoutsByPeriod(
    periodId: number,
    status?: PaymentStatus,
    search?: string,
    conn?: PoolConnection,
  ): Promise<PayoutWithDetails[]> {
    const executor = conn ?? db;
    let sql = `
      SELECT
        p.payout_id,
        p.period_id,
        pd.period_month,
        pd.period_year,
        p.citizen_id,
        COALESCE(e.first_name, s.first_name, '') as first_name,
        COALESCE(e.last_name, s.last_name, '') as last_name,
        COALESCE(e.department, s.department, '') as department,
        p.pts_rate_snapshot,
        p.calculated_amount,
        p.retroactive_amount,
        p.total_payable,
        p.payment_status,
        p.paid_at,
        p.paid_by
      FROM pay_results p
      JOIN pay_periods pd ON p.period_id = pd.period_id
      LEFT JOIN emp_profiles e ON p.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON p.citizen_id = s.citizen_id
      WHERE p.period_id = ?
    `;
    const params: any[] = [periodId];

    if (status) {
      sql += ` AND p.payment_status = ?`;
      params.push(status);
    }

    if (search) {
      sql += `
        AND (
          p.citizen_id LIKE ?
          OR COALESCE(e.first_name, s.first_name, '') LIKE ?
          OR COALESCE(e.last_name, s.last_name, '') LIKE ?
        )
      `;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.citizen_id ASC`;

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);

    return (rows as any[]).map((row) => ({
      payout_id: row.payout_id,
      period_id: row.period_id,
      period_month: row.period_month,
      period_year: row.period_year,
      citizen_id: row.citizen_id,
      employee_name: `${row.first_name} ${row.last_name}`.trim(),
      department: row.department,
      pts_rate_snapshot: Number(row.pts_rate_snapshot),
      calculated_amount: Number(row.calculated_amount),
      retroactive_amount: Number(row.retroactive_amount),
      total_payable: Number(row.total_payable),
      payment_status: row.payment_status as PaymentStatus,
      paid_at: row.paid_at,
      paid_by: row.paid_by,
    }));
  }

  // ── Dashboard queries ───────────────────────────────────────────────────────

  static async findFinanceSummary(
    year?: number,
    month?: number,
    reportableOnly = false,
    conn?: PoolConnection,
  ): Promise<FinanceSummary[]> {
    const executor = conn ?? db;
    let sql = `
      SELECT
        pp.period_id,
        pp.period_month,
        pp.period_year,
        pp.status AS period_status,
        pp.is_frozen,
        COUNT(pr.payout_id) AS total_employees,
        COALESCE(SUM(pr.total_payable), 0) AS total_amount,
        COALESCE(
          SUM(CASE WHEN pr.payment_status = 'PAID' THEN pr.total_payable ELSE 0 END),
          0
        ) AS paid_amount,
        COALESCE(
          SUM(CASE WHEN pr.payment_status = 'PENDING' THEN pr.total_payable ELSE 0 END),
          0
        ) AS pending_amount,
        COALESCE(
          SUM(CASE WHEN pr.payment_status = 'PAID' THEN 1 ELSE 0 END),
          0
        ) AS paid_count,
        COALESCE(
          SUM(CASE WHEN pr.payment_status = 'PENDING' THEN 1 ELSE 0 END),
          0
        ) AS pending_count
      FROM pay_periods pp
      LEFT JOIN pay_results pr ON pr.period_id = pp.period_id
    `;
    const params: any[] = [];

    if (year) {
      sql += ` WHERE pp.period_year = ?`;
      params.push(year);
      if (month) {
        sql += ` AND pp.period_month = ?`;
        params.push(month);
      }
      if (reportableOnly) {
        sql += ` AND pp.status = 'CLOSED' AND pp.is_frozen = 1`;
      }
    } else if (reportableOnly) {
      sql += ` WHERE pp.status = 'CLOSED' AND pp.is_frozen = 1`;
    }

    sql += `
      GROUP BY pp.period_id, pp.period_month, pp.period_year, pp.status, pp.is_frozen
      ORDER BY pp.period_year DESC, pp.period_month DESC
    `;

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    return rows as FinanceSummary[];
  }

  static async findYearlySummary(
    year?: number,
    reportableOnly = false,
    conn?: PoolConnection,
  ): Promise<YearlySummary[]> {
    const executor = conn ?? db;
    let sql = `
      SELECT
        pp.period_year,
        COUNT(pr.payout_id) as total_employees,
        COALESCE(SUM(pr.total_payable), 0) as total_amount,
        COALESCE(
          SUM(CASE WHEN pr.payment_status = 'PAID' THEN pr.total_payable ELSE 0 END),
          0
        ) as paid_amount,
        COALESCE(
          SUM(CASE WHEN pr.payment_status = 'PENDING' THEN pr.total_payable ELSE 0 END),
          0
        ) as pending_amount
      FROM pay_periods pp
      LEFT JOIN pay_results pr ON pr.period_id = pp.period_id
    `;
    const params: any[] = [];

    if (year) {
      sql += ` WHERE pp.period_year = ?`;
      params.push(year);
      if (reportableOnly) {
        sql += ` AND pp.status = 'CLOSED' AND pp.is_frozen = 1`;
      }
    } else if (reportableOnly) {
      sql += ` WHERE pp.status = 'CLOSED' AND pp.is_frozen = 1`;
    }

    sql += ` GROUP BY pp.period_year ORDER BY pp.period_year DESC`;

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    return rows as YearlySummary[];
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return getConnection();
  }
}
