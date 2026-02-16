/**
 * Access Review Module - Repository
 *
 * Handles all database operations for access review
 */

import { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import db, { getConnection } from '@config/database.js';
import {
  ReviewCycle,
  ReviewCycleStatus,
  ReviewItem,
  ReviewResult,
} from '@/modules/access-review/entities/access-review.entity.js';

export class AccessReviewRepository {
  // ── Cycle queries ───────────────────────────────────────────────────────────

  static async findCycles(
    year?: number,
    conn?: PoolConnection,
  ): Promise<ReviewCycle[]> {
    const executor = conn ?? db;
    let sql = "SELECT * FROM audit_review_cycles";
    const params: any[] = [];

    if (year) {
      sql += " WHERE year = ?";
      params.push(year);
    }

    sql += " ORDER BY year DESC, quarter DESC";

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    return rows as ReviewCycle[];
  }

  static async findCycleById(
    cycleId: number,
    conn?: PoolConnection,
  ): Promise<ReviewCycle | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT * FROM audit_review_cycles WHERE cycle_id = ?",
      [cycleId],
    );
    return (rows[0] as ReviewCycle) ?? null;
  }

  static async findCycleByQuarterYear(
    quarter: number,
    year: number,
    conn: PoolConnection,
  ): Promise<ReviewCycle | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM audit_review_cycles WHERE quarter = ? AND year = ?",
      [quarter, year],
    );
    return (rows[0] as ReviewCycle) ?? null;
  }

  static async createCycle(
    quarter: number,
    year: number,
    startDate: Date,
    dueDate: Date,
    totalUsers: number,
    conn: PoolConnection,
  ): Promise<number> {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO audit_review_cycles
       (quarter, year, status, start_date, due_date, total_users)
       VALUES (?, ?, 'PENDING', ?, ?, ?)`,
      [quarter, year, startDate, dueDate, totalUsers],
    );
    return result.insertId;
  }

  static async updateCycleStatus(
    cycleId: number,
    status: ReviewCycleStatus,
    completedBy?: number,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    if (status === ReviewCycleStatus.COMPLETED && completedBy) {
      await executor.execute(
        `UPDATE audit_review_cycles
         SET status = 'COMPLETED', completed_at = NOW(), completed_by = ?
         WHERE cycle_id = ?`,
        [completedBy, cycleId],
      );
    } else {
      await executor.execute(
        "UPDATE audit_review_cycles SET status = ? WHERE cycle_id = ?",
        [status, cycleId],
      );
    }
  }

  static async updateCycleStats(
    cycleId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE audit_review_cycles c
       SET reviewed_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result != 'PENDING'),
           disabled_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result = 'DISABLE')
       WHERE c.cycle_id = ?`,
      [cycleId],
    );
  }

  // ── Review item queries ─────────────────────────────────────────────────────

  static async findItems(
    cycleId: number,
    result?: ReviewResult,
    conn?: PoolConnection,
  ): Promise<ReviewItem[]> {
    const executor = conn ?? db;
    let sql = `
      SELECT i.*, u.citizen_id,
             COALESCE(e.first_name, s.first_name, '') AS first_name,
             COALESCE(e.last_name, s.last_name, '') AS last_name
      FROM audit_review_items i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE i.cycle_id = ?
    `;

    const params: any[] = [cycleId];

    if (result) {
      sql += " AND i.review_result = ?";
      params.push(result);
    }

    sql += " ORDER BY i.review_result, last_name, first_name";

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);

    return (rows as any[]).map((row) => ({
      item_id: row.item_id,
      cycle_id: row.cycle_id,
      user_id: row.user_id,
      citizen_id: row.citizen_id,
      user_name: `${row.first_name} ${row.last_name}`.trim(),
      current_role: row.current_role,
      employee_status: row.employee_status,
      last_login_at: row.last_login_at,
      review_result: row.review_result,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      review_note: row.review_note,
      auto_disabled: row.auto_disabled === 1,
    }));
  }

  static async findItemById(
    itemId: number,
    conn: PoolConnection,
  ): Promise<any | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT i.*, c.cycle_id
       FROM audit_review_items i
       JOIN audit_review_cycles c ON i.cycle_id = c.cycle_id
       WHERE i.item_id = ? FOR UPDATE`,
      [itemId],
    );
    return (rows[0] as any) ?? null;
  }

  static async createItem(
    cycleId: number,
    userId: number,
    currentRole: string,
    employeeStatus: string | null,
    lastLoginAt: Date | null,
    conn: PoolConnection,
  ): Promise<number> {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO audit_review_items
       (cycle_id, user_id, current_role, employee_status, last_login_at)
       VALUES (?, ?, ?, ?, ?)`,
      [cycleId, userId, currentRole, employeeStatus, lastLoginAt],
    );
    return result.insertId;
  }

  static async updateItemResult(
    itemId: number,
    result: ReviewResult,
    reviewedBy: number,
    note: string | null,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE audit_review_items
       SET review_result = ?, reviewed_at = NOW(), reviewed_by = ?, review_note = ?
       WHERE item_id = ?`,
      [result, reviewedBy, note, itemId],
    );
  }

  static async updateItemAutoDisabled(
    itemId: number,
    employeeStatus: string,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE audit_review_items
       SET review_result = 'DISABLE', reviewed_at = NOW(), auto_disabled = 1,
           review_note = ?
       WHERE item_id = ?`,
      [`Auto-disabled: ${employeeStatus}`, itemId],
    );
  }

  static async countPendingItems(
    cycleId: number,
    conn: PoolConnection,
  ): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM audit_review_items
       WHERE cycle_id = ? AND review_result = 'PENDING'`,
      [cycleId],
    );
    return Number((rows[0] as any)?.count || 0);
  }

  static async findTerminatedPendingItems(
    cycleId: number,
    conn: PoolConnection,
  ): Promise<any[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT item_id, user_id, employee_status
       FROM audit_review_items
       WHERE cycle_id = ? AND review_result = 'PENDING'
         AND employee_status IN ('resigned', 'terminated', 'retired', 'deceased')`,
      [cycleId],
    );
    return rows as any[];
  }

  // ── User queries ────────────────────────────────────────────────────────────

  static async findActiveNonAdminUsers(conn: PoolConnection): Promise<any[]> {
    const [rows] = await conn.query<RowDataPacket[]>(`
      SELECT u.id, u.citizen_id, u.role, u.last_login_at,
             COALESCE(
               NULLIF(e.original_status, ''),
               CASE
                 WHEN s.is_currently_active = 0 THEN 'inactive'
                 WHEN s.is_currently_active = 1 THEN 'active'
                 ELSE NULL
               END,
               'unknown'
             ) AS employee_status
      FROM users u
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE u.role != 'ADMIN' AND u.is_active = 1
    `);
    return rows as any[];
  }

  static async disableUser(
    userId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", [userId]);
  }

  static async findAdminUsers(conn?: PoolConnection): Promise<number[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1",
    );
    return (rows as any[]).map((r) => r.id);
  }

  // ── Due date queries ────────────────────────────────────────────────────────

  static async findCyclesDueSoon(conn?: PoolConnection): Promise<any[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(`
      SELECT * FROM audit_review_cycles
      WHERE status IN ('PENDING', 'IN_PROGRESS')
        AND DATEDIFF(due_date, CURDATE()) <= 7
        AND DATEDIFF(due_date, CURDATE()) >= 0
    `);
    return rows as any[];
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return getConnection();
  }
}
