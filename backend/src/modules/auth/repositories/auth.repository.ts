/**
 * Auth Module - Repository
 *
 * Handles all database operations for authentication
 */

import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import { User, EmployeeProfile } from '@/modules/auth/entities/auth.entity.js';

export class AuthRepository {
  // ── User queries ────────────────────────────────────────────────────────────

  static async findByCitizenId(
    citizenId: string,
    conn?: PoolConnection,
  ): Promise<User | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT
        id AS user_id,
        citizen_id,
        password_hash,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at
      FROM users
      WHERE citizen_id = ?
      LIMIT 1`,
      [citizenId],
    );
    return (rows[0] as User) ?? null;
  }

  static async findById(
    userId: number,
    conn?: PoolConnection,
  ): Promise<User | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT
        id AS user_id,
        citizen_id,
        password_hash,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
      LIMIT 1`,
      [userId],
    );
    return (rows[0] as User) ?? null;
  }

  static async updateLastLogin(
    userId: number,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
      userId,
    ]);
  }

  // ── Employee profile queries ────────────────────────────────────────────────

  static async findEmployeeProfileByCitizenId(
    citizenId: string,
    conn?: PoolConnection,
  ): Promise<EmployeeProfile | null> {
    const executor = conn ?? db;

    // Try emp_profiles first
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT
        first_name,
        last_name,
        position_name AS position,
        department,
        position_number,
        emp_type AS employee_type,
        mission_group,
        start_work_date AS start_current_position
      FROM emp_profiles
      WHERE citizen_id = ?
      LIMIT 1`,
      [citizenId],
    );

    if (rows.length > 0) {
      return rows[0] as EmployeeProfile;
    }

    // Fallback to emp_support_staff
    const [supportRows] = await executor.query<RowDataPacket[]>(
      `SELECT
        first_name,
        last_name,
        position_name AS position,
        department,
        NULL AS position_number,
        emp_type AS employee_type,
        NULL AS mission_group,
        NULL AS start_current_position
      FROM emp_support_staff
      WHERE citizen_id = ?
      LIMIT 1`,
      [citizenId],
    );

    return (supportRows[0] as EmployeeProfile) ?? null;
  }

  // ── Password operations ─────────────────────────────────────────────────────

  static async updatePassword(
    userId: number,
    passwordHash: string,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
      [passwordHash, userId],
    );
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
