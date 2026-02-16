/**
 * Report Module - Repository
 *
 * Handles all database operations for report generation
 */

import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db, { getConnection, query } from '@config/database.js';
import { MasterRateRow, PayPeriod } from '@/modules/report/entities/report.entity.js';

export class ReportRepository {
  // ── Period queries ─────────────────────────────────────────────────────────

  static async findPeriodByYearMonth(
    year: number,
    month: number,
    conn?: PoolConnection,
  ): Promise<PayPeriod | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT period_id, period_year, period_month FROM pay_periods WHERE period_year = ? AND period_month = ? LIMIT 1",
      [year, month],
    );
    return (rows[0] as PayPeriod) ?? null;
  }

  static async getPeriodId(year: number, month: number): Promise<number> {
    const rows = await query<RowDataPacket[]>(
      "SELECT period_id FROM pay_periods WHERE period_year = ? AND period_month = ? LIMIT 1",
      [year, month],
    );

    if (!rows.length) {
      throw new Error("Period not found");
    }

    return (rows[0] as any).period_id as number;
  }

  // ── Master rate queries ────────────────────────────────────────────────────

  static async findMasterRatesByIds(
    rateIds: number[],
    conn?: PoolConnection,
  ): Promise<Map<number, MasterRateRow>> {
    if (!rateIds.length) return new Map();

    const executor = conn ?? db;
    const placeholders = rateIds.map(() => "?").join(", ");
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT rate_id, amount, group_no, item_no, profession_code
       FROM cfg_payment_rates
       WHERE rate_id IN (${placeholders})`,
      rateIds,
    );

    const map = new Map<number, MasterRateRow>();
    for (const row of rows as any[]) {
      map.set(row.rate_id, {
        rate_id: row.rate_id,
        amount: Number(row.amount),
        group_no: row.group_no ?? null,
        item_no: row.item_no ?? null,
        profession_code: row.profession_code ?? null,
      });
    }
    return map;
  }

  /**
   * Legacy function using query helper for backward compatibility
   */
  static async getMasterRateMap(
    rateIds: number[],
  ): Promise<Map<number, MasterRateRow>> {
    if (!rateIds.length) return new Map();

    const placeholders = rateIds.map(() => "?").join(", ");
    const rows = await query<RowDataPacket[]>(
      `SELECT rate_id, amount, group_no, item_no, profession_code
       FROM cfg_payment_rates
       WHERE rate_id IN (${placeholders})`,
      rateIds,
    );

    const map = new Map<number, MasterRateRow>();
    for (const row of rows as any[]) {
      map.set(row.rate_id, {
        rate_id: row.rate_id,
        amount: Number(row.amount),
        group_no: row.group_no ?? null,
        item_no: row.item_no ?? null,
        profession_code: row.profession_code ?? null,
      });
    }
    return map;
  }

  // ── Connection helper ──────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return getConnection();
  }
}
