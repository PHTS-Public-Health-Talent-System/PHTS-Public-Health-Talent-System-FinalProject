/**
 * PHTS System - Access Review Service
 *
 * Handles quarterly access review cycles and auto-disable.
 * FR-08-01: Quarterly access review reports
 * FR-08-02: 7-day advance warning and post-disable notification
 * FR-08-03: Auto-disable for terminated employees
 */

import { RowDataPacket } from "mysql2/promise";
import { query, getConnection } from '@config/database.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';

/**
 * Review cycle status
 */
export enum ReviewCycleStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  OVERDUE = "OVERDUE",
}

/**
 * Review result for a user
 */
export enum ReviewResult {
  KEEP = "KEEP",
  DISABLE = "DISABLE",
  PENDING = "PENDING",
}

/**
 * Access review cycle
 */
export interface ReviewCycle {
  cycle_id: number;
  quarter: number;
  year: number;
  status: ReviewCycleStatus;
  start_date: Date;
  due_date: Date;
  completed_at: Date | null;
  completed_by: number | null;
  total_users: number;
  reviewed_users: number;
  disabled_users: number;
}

/**
 * Access review item (per user)
 */
export interface ReviewItem {
  item_id: number;
  cycle_id: number;
  user_id: number;
  citizen_id: string;
  user_name: string;
  current_role: string;
  employee_status: string | null;
  last_login_at: Date | null;
  review_result: ReviewResult;
  reviewed_at: Date | null;
  reviewed_by: number | null;
  review_note: string | null;
  auto_disabled: boolean;
}

/**
 * Get current quarter
 */
function getCurrentQuarter(): { quarter: number; year: number } {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return { quarter, year: now.getFullYear() };
}

/**
 * Get quarter start and due dates
 */
function getQuarterDates(
  quarter: number,
  year: number,
): { startDate: Date; dueDate: Date } {
  // Review starts at beginning of quarter
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);

  // Due date is 14 days after quarter start (2 weeks to complete review)
  const dueDate = new Date(year, startMonth, 14);

  return { startDate, dueDate };
}

/**
 * Get all review cycles
 */
export async function getReviewCycles(year?: number): Promise<ReviewCycle[]> {
  let sql = "SELECT * FROM audit_review_cycles";
  const params: any[] = [];

  if (year) {
    sql += " WHERE year = ?";
    params.push(year);
  }

  sql += " ORDER BY year DESC, quarter DESC";

  const rows = await query<RowDataPacket[]>(sql, params);
  return rows as ReviewCycle[];
}

/**
 * Get a specific review cycle
 */
export async function getReviewCycle(
  cycleId: number,
): Promise<ReviewCycle | null> {
  const sql = "SELECT * FROM audit_review_cycles WHERE cycle_id = ?";
  const rows = await query<RowDataPacket[]>(sql, [cycleId]);
  return rows.length > 0 ? (rows[0] as ReviewCycle) : null;
}

/**
 * Create a new review cycle for the current quarter
 */
export async function createReviewCycle(): Promise<ReviewCycle> {
  const { quarter, year } = getCurrentQuarter();
  const { startDate, dueDate } = getQuarterDates(quarter, year);

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Check if cycle already exists
    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM audit_review_cycles WHERE quarter = ? AND year = ?",
      [quarter, year],
    );

    if (existing.length > 0) {
      await connection.rollback();
      return existing[0] as ReviewCycle;
    }

    // Get all active users with non-ADMIN roles
    const [users] = await connection.query<RowDataPacket[]>(`
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

    // Create cycle
    const [cycleResult] = await connection.execute(
      `INSERT INTO audit_review_cycles
       (quarter, year, status, start_date, due_date, total_users)
       VALUES (?, ?, 'PENDING', ?, ?, ?)`,
      [quarter, year, startDate, dueDate, users.length],
    );

    const cycleId = (cycleResult as any).insertId;

    // Create review items for each user
    for (const user of users as any[]) {
      await connection.execute(
        `INSERT INTO audit_review_items
         (cycle_id, user_id, current_role, employee_status, last_login_at)
         VALUES (?, ?, ?, ?, ?)`,
        [cycleId, user.id, user.role, user.employee_status, user.last_login_at],
      );
    }

    await connection.commit();

    // Log audit event
    await emitAuditEvent(
      {
        eventType: AuditEventType.ACCESS_REVIEW_CREATE,
        entityType: "access_review_cycle",
        entityId: cycleId,
        actionDetail: {
          quarter,
          year,
          total_users: users.length,
        },
      },
      connection,
    );

    // Notify ADMIN users
    const [admins] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1",
    );

    for (const admin of admins as any[]) {
      await NotificationService.notifyUser(
        admin.id,
        "รอบตรวจทานสิทธิ์ใหม่",
        `สร้างรอบตรวจทานสิทธิ์ไตรมาส ${quarter}/${year} แล้ว มีผู้ใช้ทั้งหมด ${users.length} คนรอตรวจทาน`,
        `/dashboard/admin/access-review/${cycleId}`,
        "SYSTEM",
      );
    }

    return {
      cycle_id: cycleId,
      quarter,
      year,
      status: ReviewCycleStatus.PENDING,
      start_date: startDate,
      due_date: dueDate,
      completed_at: null,
      completed_by: null,
      total_users: users.length,
      reviewed_users: 0,
      disabled_users: 0,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get review items for a cycle
 */
export async function getReviewItems(
  cycleId: number,
  result?: ReviewResult,
): Promise<ReviewItem[]> {
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

  const rows = await query<RowDataPacket[]>(sql, params);

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

/**
 * Update review result for a user
 */
export async function updateReviewItem(
  itemId: number,
  result: ReviewResult,
  reviewerId: number,
  note?: string,
): Promise<void> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get item and cycle info
    const [items] = await connection.query<RowDataPacket[]>(
      `SELECT i.*, c.cycle_id
       FROM audit_review_items i
       JOIN audit_review_cycles c ON i.cycle_id = c.cycle_id
       WHERE i.item_id = ? FOR UPDATE`,
      [itemId],
    );

    if (items.length === 0) {
      throw new Error("Review item not found");
    }

    const item = items[0] as any;

    // Update review item
    await connection.execute(
      `UPDATE audit_review_items
       SET review_result = ?, reviewed_at = NOW(), reviewed_by = ?, review_note = ?
       WHERE item_id = ?`,
      [result, reviewerId, note || null, itemId],
    );

    // If marking as DISABLE, actually disable the user
    if (result === ReviewResult.DISABLE) {
      await connection.execute("UPDATE users SET is_active = 0 WHERE id = ?", [
        item.user_id,
      ]);

      // Notify the user
      await NotificationService.notifyUser(
        item.user_id,
        "บัญชีถูกปิดใช้งาน",
        "บัญชีของท่านถูกปิดใช้งานจากการตรวจทานสิทธิ์ประจำไตรมาส กรุณาติดต่อผู้ดูแลระบบ",
        "/login",
        "OTHER",
      );

      // Log audit
      await emitAuditEvent(
        {
          eventType: AuditEventType.USER_DISABLE,
          entityType: "users",
          entityId: item.user_id,
          actorId: reviewerId,
          actionDetail: {
            reason: "access_review",
            cycle_id: item.cycle_id,
            note: note,
          },
        },
        connection,
      );
    }

    // Update cycle statistics
    await connection.execute(
      `UPDATE audit_review_cycles c
       SET reviewed_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result != 'PENDING'),
           disabled_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result = 'DISABLE')
       WHERE c.cycle_id = ?`,
      [item.cycle_id],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Complete a review cycle
 */
export async function completeReviewCycle(
  cycleId: number,
  completedBy: number,
  options?: { autoKeepPending?: boolean; note?: string },
): Promise<void> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Check if all items are reviewed
    const [pending] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM audit_review_items
       WHERE cycle_id = ? AND review_result = 'PENDING'`,
      [cycleId],
    );

    const pendingCount = Number((pending[0] as any).count || 0);

    if (pendingCount > 0 && !options?.autoKeepPending) {
      throw new Error(
        `ยังมี ${pendingCount} รายการที่ยังไม่ได้ตรวจทาน`,
      );
    }

    if (pendingCount > 0 && options?.autoKeepPending) {
      await connection.execute(
        `UPDATE audit_review_items
         SET review_result = 'KEEP',
             reviewed_at = NOW(),
             reviewed_by = ?,
             review_note = COALESCE(?, review_note)
         WHERE cycle_id = ? AND review_result = 'PENDING'`,
        [
          completedBy,
          options.note ?? "อนุมัติคงค้างอัตโนมัติขณะปิดรอบ",
          cycleId,
        ],
      );
    }

    await connection.execute(
      `UPDATE audit_review_cycles c
       SET reviewed_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result != 'PENDING'),
           disabled_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result = 'DISABLE')
       WHERE c.cycle_id = ?`,
      [cycleId],
    );

    // Update cycle status
    await connection.execute(
      `UPDATE audit_review_cycles
       SET status = 'COMPLETED', completed_at = NOW(), completed_by = ?
       WHERE cycle_id = ?`,
      [completedBy, cycleId],
    );

    await connection.commit();

    // Log audit
    await emitAuditEvent(
      {
        eventType: AuditEventType.ACCESS_REVIEW_COMPLETE,
        entityType: "access_review_cycle",
        entityId: cycleId,
        actorId: completedBy,
        actionDetail: {
          autoKeepPending: Boolean(options?.autoKeepPending),
          autoKeptCount: pendingCount,
          note: options?.note ?? null,
        },
      },
      connection,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Auto-disable users who are no longer employed
 * This should be run as a scheduled job
 */
export async function autoDisableTerminatedUsers(): Promise<{
  disabled: number;
  errors: string[];
}> {
  const result = { disabled: 0, errors: [] as string[] };

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get current cycle
    const { quarter, year } = getCurrentQuarter();
    const [cycles] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM audit_review_cycles WHERE quarter = ? AND year = ? AND status != ?",
      [quarter, year, "COMPLETED"],
    );

    if (cycles.length === 0) {
      // No active cycle, skip
      await connection.rollback();
      return result;
    }

    const cycle = cycles[0] as any;

    // Find users with terminated status in review items
    const [items] = await connection.query<RowDataPacket[]>(
      `
      SELECT i.item_id, i.user_id, i.employee_status
      FROM audit_review_items i
      WHERE i.cycle_id = ? AND i.review_result = 'PENDING'
        AND i.employee_status IN ('resigned', 'terminated', 'retired', 'deceased')
    `,
      [cycle.cycle_id],
    );

    for (const item of items as any[]) {
      try {
        // Auto-disable
        await connection.execute(
          `UPDATE audit_review_items
           SET review_result = 'DISABLE', reviewed_at = NOW(), auto_disabled = 1,
               review_note = ?
           WHERE item_id = ?`,
          [`Auto-disabled: ${item.employee_status}`, item.item_id],
        );

        await connection.execute(
          "UPDATE users SET is_active = 0 WHERE id = ?",
          [item.user_id],
        );

        // Log audit
        await emitAuditEvent(
          {
            eventType: AuditEventType.USER_DISABLE,
            entityType: "users",
            entityId: item.user_id,
            actionDetail: {
              reason: "auto_disable",
              employee_status: item.employee_status,
              cycle_id: cycle.cycle_id,
            },
          },
          connection,
        );

        result.disabled++;
      } catch (error: any) {
        result.errors.push(`User ${item.user_id}: ${error.message}`);
      }
    }

    // Update cycle statistics
    await connection.execute(
      `UPDATE audit_review_cycles c
       SET reviewed_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result != 'PENDING'),
           disabled_users = (SELECT COUNT(*) FROM audit_review_items WHERE cycle_id = c.cycle_id AND review_result = 'DISABLE')
       WHERE c.cycle_id = ?`,
      [cycle.cycle_id],
    );

    await connection.commit();
  } catch (error: any) {
    await connection.rollback();
    result.errors.push(`Job error: ${error.message}`);
  } finally {
    connection.release();
  }

  return result;
}

/**
 * Send reminders for upcoming review due dates
 */
export async function sendReviewReminders(): Promise<number> {
  let remindersSent = 0;

  // Find cycles due in 7 days
  const sql = `
    SELECT * FROM audit_review_cycles
    WHERE status IN ('PENDING', 'IN_PROGRESS')
      AND DATEDIFF(due_date, CURDATE()) <= 7
      AND DATEDIFF(due_date, CURDATE()) >= 0
  `;

  const cycles = await query<RowDataPacket[]>(sql);

  for (const cycle of cycles as any[]) {
    const daysRemaining = Math.ceil(
      (new Date(cycle.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    // Notify ADMIN users
    const admins = await query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1",
    );

    for (const admin of admins as any[]) {
      await NotificationService.notifyUser(
        admin.id,
        "เตือน: ครบกำหนดตรวจทานสิทธิ์",
        `รอบตรวจทานสิทธิ์ไตรมาส ${cycle.quarter}/${cycle.year} จะครบกำหนดใน ${daysRemaining} วัน`,
        `/dashboard/admin/access-review/${cycle.cycle_id}`,
        "REMINDER",
      );
      remindersSent++;
    }
  }

  return remindersSent;
}
