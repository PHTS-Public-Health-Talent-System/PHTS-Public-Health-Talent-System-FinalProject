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
        e.department_code as department,
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
      sql += ` AND (p.citizen_id LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)`;
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
    conn?: PoolConnection,
  ): Promise<FinanceSummary[]> {
    const executor = conn ?? db;
    let sql = `SELECT * FROM vw_finance_period_summary`;
    const params: any[] = [];

    if (year) {
      sql += ` WHERE period_year = ?`;
      params.push(year);
      if (month) {
        sql += ` AND period_month = ?`;
        params.push(month);
      }
    }

    sql += ` ORDER BY period_year DESC, period_month DESC`;

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    return rows as FinanceSummary[];
  }

  static async findYearlySummary(
    year?: number,
    conn?: PoolConnection,
  ): Promise<YearlySummary[]> {
    const executor = conn ?? db;
    let sql = `
      SELECT
        period_year,
        MAX(total_employees) as total_employees,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as paid_amount,
        SUM(pending_amount) as pending_amount
      FROM vw_finance_period_summary
    `;
    const params: any[] = [];

    if (year) {
      sql += ` WHERE period_year = ?`;
      params.push(year);
    }

    sql += ` GROUP BY period_year ORDER BY period_year DESC`;

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    return rows as YearlySummary[];
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return getConnection();
  }
}
