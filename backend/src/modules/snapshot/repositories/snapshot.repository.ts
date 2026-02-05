/**
 * Snapshot Module - Repository
 *
 * Handles all database operations for period snapshots
 */

import { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import db, { getConnection } from '@config/database.js';
import { Snapshot, SnapshotType, PeriodWithSnapshot } from '@/modules/snapshot/entities/snapshot.entity.js';

export class SnapshotRepository {
  // ── Period queries ──────────────────────────────────────────────────────────

  static async findPeriodWithSnapshot(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<PeriodWithSnapshot | null> {
    const executor = conn ?? db;
    const sql = `
      SELECT p.*,
             (SELECT COUNT(*) FROM pay_snapshots WHERE period_id = p.period_id) AS snapshot_count
      FROM pay_periods p
      WHERE p.period_id = ?
    `;

    const [rows] = await executor.query<RowDataPacket[]>(sql, [periodId]);

    if (rows.length === 0) return null;

    const row = rows[0] as any;
    return {
      period_id: row.period_id,
      period_month: row.period_month,
      period_year: row.period_year,
      status: row.status,
      is_frozen: row.is_frozen === 1,
      frozen_at: row.frozen_at,
      frozen_by: row.frozen_by,
      snapshot_count: row.snapshot_count,
    };
  }

  static async findPeriodById(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<any | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_id = ?",
      [periodId],
    );
    return (rows[0] as any) ?? null;
  }

  static async findPeriodByIdForUpdate(
    periodId: number,
    conn: PoolConnection,
  ): Promise<any | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE",
      [periodId],
    );
    return (rows[0] as any) ?? null;
  }

  static async isPeriodFrozen(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<boolean> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT is_frozen FROM pay_periods WHERE period_id = ?",
      [periodId],
    );

    if (rows.length === 0) return false;
    return (rows[0] as any).is_frozen === 1;
  }

  static async updatePeriodFrozen(
    periodId: number,
    isFrozen: boolean,
    frozenBy: number | null,
    conn: PoolConnection,
  ): Promise<void> {
    if (isFrozen) {
      await conn.execute(
        `UPDATE pay_periods
         SET is_frozen = 1, frozen_at = NOW(), frozen_by = ?
         WHERE period_id = ?`,
        [frozenBy, periodId],
      );
    } else {
      await conn.execute(
        `UPDATE pay_periods
         SET is_frozen = 0, frozen_at = NULL, frozen_by = NULL
         WHERE period_id = ?`,
        [periodId],
      );
    }
  }

  // ── Payout queries for snapshot ─────────────────────────────────────────────

  static async findPayoutsForSnapshot(
    periodId: number,
    conn: PoolConnection,
  ): Promise<any[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT po.*,
             COALESCE(e.first_name, s.first_name, '') AS first_name,
             COALESCE(e.last_name, s.last_name, '') AS last_name,
             COALESCE(e.department, s.department, '') AS department,
             COALESCE(e.position_name, s.position_name, '') AS position_name,
             mr.amount AS base_rate,
             mr.group_no,
             mr.item_no,
             mr.profession_code
      FROM pay_results po
      LEFT JOIN emp_profiles e ON po.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON po.citizen_id = s.citizen_id
      LEFT JOIN cfg_payment_rates mr ON po.master_rate_id = mr.rate_id
      WHERE po.period_id = ?
      ORDER BY last_name, first_name
    `,
      [periodId],
    );
    return rows as any[];
  }

  // ── Snapshot queries ────────────────────────────────────────────────────────

  static async createSnapshot(
    periodId: number,
    snapshotType: SnapshotType,
    snapshotData: any,
    recordCount: number,
    totalAmount: number,
    conn: PoolConnection,
  ): Promise<number> {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO pay_snapshots
       (period_id, snapshot_type, snapshot_data, record_count, total_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [periodId, snapshotType, JSON.stringify(snapshotData), recordCount, totalAmount],
    );
    return result.insertId;
  }

  static async findSnapshot(
    periodId: number,
    snapshotType: SnapshotType,
    conn?: PoolConnection,
  ): Promise<Snapshot | null> {
    const executor = conn ?? db;
    const sql = `
      SELECT * FROM pay_snapshots
      WHERE period_id = ? AND snapshot_type = ?
      ORDER BY created_at DESC LIMIT 1
    `;

    const [rows] = await executor.query<RowDataPacket[]>(sql, [periodId, snapshotType]);

    if (rows.length === 0) return null;

    const row = rows[0] as any;
    return {
      snapshot_id: row.snapshot_id,
      period_id: row.period_id,
      snapshot_type: row.snapshot_type,
      snapshot_data: JSON.parse(row.snapshot_data),
      record_count: row.record_count,
      total_amount: Number(row.total_amount),
      created_at: row.created_at,
    };
  }

  static async findSnapshotsForPeriod(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<Snapshot[]> {
    const executor = conn ?? db;
    const sql = `
      SELECT * FROM pay_snapshots
      WHERE period_id = ?
      ORDER BY created_at DESC
    `;

    const [rows] = await executor.query<RowDataPacket[]>(sql, [periodId]);

    return (rows as any[]).map((row) => ({
      snapshot_id: row.snapshot_id,
      period_id: row.period_id,
      snapshot_type: row.snapshot_type,
      snapshot_data: JSON.parse(row.snapshot_data),
      record_count: row.record_count,
      total_amount: Number(row.total_amount),
      created_at: row.created_at,
    }));
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return getConnection();
  }
}
