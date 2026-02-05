/**
 * System Module - Repository
 *
 * Handles all database operations for system administration
 */

import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db, { getConnection } from '@config/database.js';
import {
  UserRow,
  HrUserRow,
  ViewUserSync,
  ViewEmployee,
  ViewSupportEmployee,
  ViewSignature,
  ViewLeaveQuota,
  ViewLeaveRequest,
  ExistingLeaveRecord,
} from '@/modules/system/entities/system.entity.js';

export class SystemRepository {
  // ── User queries ───────────────────────────────────────────────────────────

  static async findAllUsers(conn?: PoolConnection): Promise<UserRow[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT id, citizen_id, role, is_active, password_hash FROM users",
    );
    return rows as UserRow[];
  }

  static async updateUserRole(
    citizenId: string,
    role: string,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      "UPDATE users SET role = ?, updated_at = NOW() WHERE citizen_id = ?",
      [role, citizenId],
    );
  }

  // ── HR data queries ────────────────────────────────────────────────────────

  static async findAllHrUsers(conn?: PoolConnection): Promise<HrUserRow[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(`
      SELECT citizen_id, position_name, special_position, department, sub_department
      FROM emp_profiles
      UNION ALL
      SELECT citizen_id, position_name, special_position, department, NULL AS sub_department
      FROM emp_support_staff
    `);
    return rows as HrUserRow[];
  }

  // ── Sync view queries ──────────────────────────────────────────────────────

  static async findViewUsersSync(
    conn: PoolConnection,
  ): Promise<ViewUserSync[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM vw_hrms_users_sync",
    );
    return rows as ViewUserSync[];
  }

  static async findViewEmployees(
    conn: PoolConnection,
  ): Promise<ViewEmployee[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM vw_hrms_employees",
    );
    return rows as ViewEmployee[];
  }

  static async findViewSupportEmployees(
    conn: PoolConnection,
  ): Promise<ViewSupportEmployee[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM vw_hrms_support_staff",
    );
    return rows as ViewSupportEmployee[];
  }

  static async findViewSignatures(
    conn: PoolConnection,
  ): Promise<ViewSignature[]> {
    const [rows] = await conn.query<RowDataPacket[]>(`
      SELECT u.id as user_id, s.signature_blob
      FROM vw_hrms_signatures s
      JOIN users u ON CONVERT(s.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
    `);
    return rows as ViewSignature[];
  }

  static async findViewLeaveQuotas(
    conn: PoolConnection,
  ): Promise<ViewLeaveQuota[]> {
    const [rows] = await conn.query<RowDataPacket[]>(`
      SELECT q.citizen_id, q.fiscal_year, q.total_quota
      FROM vw_hrms_leave_quotas q
      JOIN users u ON CONVERT(q.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
    `);
    return rows as ViewLeaveQuota[];
  }

  static async findViewLeaveRequests(
    conn: PoolConnection,
  ): Promise<ViewLeaveRequest[]> {
    const [rows] = await conn.query<RowDataPacket[]>(`
      SELECT lr.* FROM vw_hrms_leave_requests lr
      JOIN users u ON CONVERT(lr.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
    `);
    return rows as ViewLeaveRequest[];
  }

  // ── Existing record queries (for skip comparison) ──────────────────────────

  static async findExistingEmployees(
    conn: PoolConnection,
  ): Promise<
    Map<string, { position_name: string; level: string; department: string; special_position: string }>
  > {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT citizen_id, position_name, level, department, special_position FROM emp_profiles",
    );
    const map = new Map();
    for (const row of rows as any[]) {
      map.set(row.citizen_id, row);
    }
    return map;
  }

  static async findExistingSupportEmployees(
    conn: PoolConnection,
  ): Promise<Map<string, any>> {
    const [rows] = await conn.query<RowDataPacket[]>(`
      SELECT citizen_id, title, first_name, last_name, position_name,
             level, special_position, emp_type, department, is_currently_active
      FROM emp_support_staff
    `);
    const map = new Map();
    for (const row of rows as any[]) {
      map.set(row.citizen_id, row);
    }
    return map;
  }

  static async findExistingSignatureUserIds(
    conn: PoolConnection,
  ): Promise<Set<number>> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT user_id FROM sig_images",
    );
    return new Set((rows as any[]).map((s) => s.user_id));
  }

  static async findExistingLeaveRecords(
    conn: PoolConnection,
  ): Promise<Map<string, ExistingLeaveRecord>> {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT ref_id, status, start_date, end_date, is_no_pay FROM leave_records WHERE ref_id IS NOT NULL",
    );
    const map = new Map();
    for (const row of rows as any[]) {
      map.set(row.ref_id, row);
    }
    return map;
  }

  // ── Upsert operations ──────────────────────────────────────────────────────

  static async upsertUser(
    citizenId: string,
    passwordHash: string | null,
    role: string,
    isActive: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `INSERT INTO users (citizen_id, password_hash, role, is_active)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         is_active = VALUES(is_active),
         updated_at = NOW()`,
      [citizenId, passwordHash, role, isActive],
    );
  }

  static async upsertEmployee(
    emp: ViewEmployee,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `INSERT INTO emp_profiles (
        citizen_id, title, first_name, last_name, sex, birth_date,
        position_name, position_number, level, special_position, emp_type,
        department, sub_department, mission_group, specialist, expert,
        start_work_date, first_entry_date, original_status, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        position_name = VALUES(position_name),
        level = VALUES(level),
        special_position = VALUES(special_position),
        department = VALUES(department),
        sub_department = VALUES(sub_department),
        specialist = VALUES(specialist),
        expert = VALUES(expert),
        last_synced_at = NOW()`,
      [
        emp.citizen_id,
        emp.title,
        emp.first_name,
        emp.last_name,
        emp.sex,
        emp.birth_date,
        emp.position_name,
        emp.position_number,
        emp.level,
        ((emp.special_position || "") as string).substring(0, 65535),
        emp.employee_type,
        emp.department,
        emp.sub_department,
        emp.mission_group,
        emp.specialist,
        emp.expert,
        emp.start_current_position,
        emp.first_entry_date,
        emp.original_status,
      ],
    );
  }

  static async upsertSupportEmployee(
    emp: ViewSupportEmployee,
    conn: PoolConnection,
  ): Promise<void> {
    const toNull = (val: any) => (val === undefined ? null : val);
    await conn.execute(
      `INSERT INTO emp_support_staff (
        citizen_id, title, first_name, last_name,
        position_name, level, special_position, emp_type,
        department, is_currently_active, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        position_name = VALUES(position_name),
        level = VALUES(level),
        special_position = VALUES(special_position),
        emp_type = VALUES(emp_type),
        department = VALUES(department),
        is_currently_active = VALUES(is_currently_active),
        last_synced_at = NOW()`,
      [
        toNull(emp.citizen_id),
        toNull(emp.title),
        toNull(emp.first_name),
        toNull(emp.last_name),
        toNull(emp.position_name),
        toNull(emp.level),
        toNull(emp.special_position),
        toNull(emp.employee_type),
        toNull(emp.department),
        toNull(emp.is_currently_active),
      ],
    );
  }

  static async insertSignature(
    userId: number,
    signatureBlob: Buffer,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      "INSERT INTO sig_images (user_id, signature_image, updated_at) VALUES (?, ?, NOW())",
      [userId, signatureBlob],
    );
  }

  static async upsertLeaveQuota(
    citizenId: string,
    fiscalYear: number,
    totalQuota: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_vacation, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE quota_vacation = VALUES(quota_vacation), updated_at = NOW()`,
      [citizenId, fiscalYear, totalQuota],
    );
  }

  static async upsertLeaveRecord(
    leave: ViewLeaveRequest,
    conn: PoolConnection,
  ): Promise<void> {
    const toNull = (val: any) => (val === undefined ? null : val);
    await conn.execute(
      `INSERT INTO leave_records (
        ref_id, citizen_id, leave_type, start_date, end_date,
        duration_days, fiscal_year, remark, status, is_no_pay, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        duration_days = VALUES(duration_days),
        is_no_pay = VALUES(is_no_pay),
        synced_at = NOW()`,
      [
        toNull(leave.ref_id),
        toNull(leave.citizen_id),
        toNull(leave.leave_type),
        toNull(leave.start_date),
        toNull(leave.end_date),
        toNull(leave.duration_days),
        toNull(leave.fiscal_year),
        toNull(leave.remark),
        toNull(leave.status),
        toNull(leave.is_no_pay ?? 0),
      ],
    );
  }

  static async syncLicenses(conn: PoolConnection): Promise<void> {
    await conn.query(`
      INSERT INTO emp_licenses (citizen_id, license_no, valid_from, valid_until, status, synced_at)
      SELECT l.citizen_id, l.license_no, l.valid_from, l.valid_until, l.status, NOW()
      FROM vw_hrms_licenses l
      JOIN users u ON CONVERT(l.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      ON DUPLICATE KEY UPDATE valid_from=VALUES(valid_from), valid_until=VALUES(valid_until), status=VALUES(status), synced_at=NOW()
    `);
  }

  static async syncMovements(conn: PoolConnection): Promise<void> {
    await conn.query(`
      INSERT INTO emp_movements (citizen_id, movement_type, effective_date, remark, synced_at)
      SELECT m.citizen_id, m.movement_type, m.effective_date, m.remark, NOW()
      FROM vw_hrms_movements m
      JOIN users u ON CONVERT(m.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      ON DUPLICATE KEY UPDATE
        movement_type = VALUES(movement_type),
        effective_date = VALUES(effective_date),
        remark = VALUES(remark),
        synced_at = NOW()
    `);
  }

  // ── Connection helper ──────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return getConnection();
  }
}
