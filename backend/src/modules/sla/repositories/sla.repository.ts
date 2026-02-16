/**
 * SLA Module - Repository
 *
 * Handles all database operations for SLA tracking
 */

import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import { SLAConfig, ReminderType } from '@/modules/sla/entities/sla.entity.js';

export class SLARepository {
  // ── SLA Config queries ──────────────────────────────────────────────────────

  static async findAllConfigs(conn?: PoolConnection): Promise<SLAConfig[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT * FROM cfg_sla_rules WHERE is_active = 1 ORDER BY step_no",
    );
    return rows as SLAConfig[];
  }

  static async findConfigByStep(
    stepNo: number,
    conn?: PoolConnection,
  ): Promise<SLAConfig | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT * FROM cfg_sla_rules WHERE step_no = ? AND is_active = 1",
      [stepNo],
    );
    return (rows[0] as SLAConfig) ?? null;
  }

  static async updateConfig(
    stepNo: number,
    slaDays: number,
    reminderBeforeDays?: number,
    reminderAfterDays?: number,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    let sql = "UPDATE cfg_sla_rules SET sla_days = ?";
    const params: any[] = [slaDays];

    if (reminderBeforeDays !== undefined) {
      sql += ", reminder_before_days = ?";
      params.push(reminderBeforeDays);
    }

    if (reminderAfterDays !== undefined) {
      sql += ", reminder_after_days = ?";
      params.push(reminderAfterDays);
    }

    sql += " WHERE step_no = ?";
    params.push(stepNo);

    await executor.execute(sql, params);
  }

  // ── Holiday queries ─────────────────────────────────────────────────────────

  static async findHolidaysInRange(
    startDate: Date,
    endDate: Date,
    conn?: PoolConnection,
  ): Promise<Set<string>> {
    const executor = conn ?? db;
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holiday_date FROM cfg_holidays WHERE holiday_date BETWEEN ? AND ?",
      [startStr, endStr],
    );

    const holidays = new Set<string>();
    for (const row of rows as any[]) {
      holidays.add(String(row.holiday_date));
    }
    return holidays;
  }

  static async isHoliday(
    date: Date,
    conn?: PoolConnection,
  ): Promise<boolean> {
    const executor = conn ?? db;
    const dateStr = date.toISOString().split("T")[0];
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT 1 FROM cfg_holidays WHERE holiday_date = ?",
      [dateStr],
    );
    return rows.length > 0;
  }

  // ── Pending request queries ─────────────────────────────────────────────────

  static async findPendingRequestsWithSLA(
    params?: { startDate?: Date | null; endDate?: Date | null; conn?: PoolConnection },
  ): Promise<any[]> {
    const executor = params?.conn ?? db;
    let sql = `
      SELECT
        r.request_id,
        r.request_no,
        r.citizen_id,
        r.current_step,
        COALESCE(r.step_started_at, r.updated_at) as step_started_at,
        r.status,
        sla.sla_days,
        e.first_name,
        e.last_name
      FROM req_submissions r
      JOIN cfg_sla_rules sla ON r.current_step = sla.step_no
      LEFT JOIN emp_profiles e ON e.citizen_id = r.citizen_id
      WHERE r.status = 'PENDING'
      AND sla.is_active = 1
    `;
    const values: any[] = [];
    if (params?.startDate) {
      sql += " AND COALESCE(r.step_started_at, r.updated_at) >= ?";
      values.push(params.startDate.toISOString().slice(0, 10));
    }
    if (params?.endDate) {
      sql += " AND COALESCE(r.step_started_at, r.updated_at) <= ?";
      values.push(`${params.endDate.toISOString().slice(0, 10)} 23:59:59`);
    }

    const [rows] = await executor.query<RowDataPacket[]>(sql, values);
    return rows as any[];
  }

  static async findClosedRequestsForKPI(
    from: Date,
    to: Date,
    conn?: PoolConnection,
  ): Promise<any[]> {
    const executor = conn ?? db;
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = `${to.toISOString().slice(0, 10)} 23:59:59`;
    const [rows] = await executor.query<RowDataPacket[]>(
      `
      SELECT
        r.request_id,
        r.request_no,
        r.status,
        r.updated_at AS completed_at,
        (
          SELECT MIN(a.created_at)
          FROM req_approvals a
          WHERE a.request_id = r.request_id
            AND a.action = 'SUBMIT'
        ) AS submitted_at
      FROM req_submissions r
      WHERE r.status IN ('APPROVED', 'REJECTED', 'CANCELLED')
        AND r.updated_at BETWEEN ? AND ?
      `,
      [fromDate, toDate],
    );
    return rows as any[];
  }

  static async findApprovalsInRangeForKPI(
    from: Date,
    to: Date,
    conn?: PoolConnection,
  ): Promise<any[]> {
    const executor = conn ?? db;
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = `${to.toISOString().slice(0, 10)} 23:59:59`;
    const [rows] = await executor.query<RowDataPacket[]>(
      `
      SELECT
        a.request_id,
        a.step_no,
        a.action,
        a.comment,
        a.created_at
      FROM req_approvals a
      WHERE a.created_at BETWEEN ? AND ?
      ORDER BY a.request_id ASC, a.created_at ASC, a.action_id ASC
      `,
      [fromDate, toDate],
    );
    return rows as any[];
  }

  // ── User queries for approvers ──────────────────────────────────────────────

  static async findUsersByRole(
    role: string,
    conn?: PoolConnection,
  ): Promise<number[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = ? AND is_active = 1",
      [role],
    );
    return (rows as any[]).map((r) => r.id);
  }

  // ── Reminder log queries ────────────────────────────────────────────────────

  static async wasReminderSentToday(
    requestId: number,
    stepNo: number,
    reminderType: ReminderType,
    conn?: PoolConnection,
  ): Promise<boolean> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT 1 FROM wf_sla_reminders
       WHERE request_id = ? AND step_no = ? AND reminder_type = ?
       AND DATE(sent_at) = CURDATE()`,
      [requestId, stepNo, reminderType],
    );
    return rows.length > 0;
  }

  static async logReminderSent(
    requestId: number,
    stepNo: number,
    targetUserId: number,
    reminderType: ReminderType,
    sentVia: "IN_APP" | "EMAIL" | "BOTH" = "IN_APP",
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      `INSERT INTO wf_sla_reminders (request_id, step_no, target_user_id, reminder_type, sent_via)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, stepNo, targetUserId, reminderType, sentVia],
    );
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
