/**
 * Master Data Module - Repository
 *
 * Handles all database operations for holidays and payment rates
 */

import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import { Holiday, PaymentRate } from '@/modules/master-data/entities/master-data.entity.js';

export class MasterDataRepository {
  // ── Holiday queries ─────────────────────────────────────────────────────────

  static async findHolidays(
    year?: string | number,
    conn?: PoolConnection,
  ): Promise<Holiday[]> {
    const executor = conn ?? db;
    let sql = "SELECT * FROM cfg_holidays WHERE is_active = 1";
    const params: any[] = [];

    if (year) {
      sql += " AND YEAR(holiday_date) = ?";
      params.push(year);
    }
    sql += " ORDER BY holiday_date DESC";

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    return rows as Holiday[];
  }

  static async upsertHoliday(
    date: string,
    name: string,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      `INSERT INTO cfg_holidays (holiday_date, holiday_name, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name)`,
      [date, name],
    );
  }

  static async deactivateHoliday(
    date: string,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      "UPDATE cfg_holidays SET is_active = 0 WHERE holiday_date = ?",
      [date],
    );
  }

  // ── Payment rate queries ────────────────────────────────────────────────────

  static async findAllRates(conn?: PoolConnection): Promise<PaymentRate[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT * FROM cfg_payment_rates ORDER BY profession_code, group_no, item_no",
    );
    return rows as PaymentRate[];
  }

  static async findRateById(
    rateId: number,
    conn?: PoolConnection,
  ): Promise<PaymentRate | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT * FROM cfg_payment_rates WHERE rate_id = ?",
      [rateId],
    );
    return (rows[0] as PaymentRate) ?? null;
  }

  static async updateRate(
    rateId: number,
    amount: number,
    conditionDesc: string,
    isActive: number,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      `UPDATE cfg_payment_rates
       SET amount = ?, condition_desc = ?, is_active = ?
       WHERE rate_id = ?`,
      [amount, conditionDesc, isActive, rateId],
    );
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
