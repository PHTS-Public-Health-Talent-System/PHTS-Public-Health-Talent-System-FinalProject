/**
 * Access Review Module - Repository
 *
 * Handles all database operations for access review
 */

import { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import db, { getConnection } from '@config/database.js';
import {
  AccessReviewQueueStatus,
  ReviewCycle,
  ReviewCycleStatus,
  ReviewItem,
  ReviewResult,
} from '@/modules/access-review/entities/access-review.entity.js';

export class AccessReviewRepository {
  private static hasSupportSubDepartmentColumnCache: boolean | null = null;

  private static async hasSupportSubDepartmentColumn(
    conn: PoolConnection,
  ): Promise<boolean> {
    if (this.hasSupportSubDepartmentColumnCache !== null) {
      return this.hasSupportSubDepartmentColumnCache;
    }
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'emp_support_staff'
         AND COLUMN_NAME = 'sub_department'
       LIMIT 1`,
    );
    this.hasSupportSubDepartmentColumnCache = rows.length > 0;
    return this.hasSupportSubDepartmentColumnCache;
  }

  private static parseJsonCell(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === "object") return value as Record<string, unknown>;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }

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
    const cycleId = result.insertId;

    // Phase A compatibility:
    // If new columns exist, populate them for post-sync contract.
    // If schema has not migrated yet, ignore unknown-column errors.
    try {
      await conn.execute(
        `UPDATE audit_review_cycles
         SET opened_at = COALESCE(opened_at, ?),
             expires_at = COALESCE(expires_at, ?),
             sync_source = COALESCE(sync_source, 'SYNC'),
             cycle_code = COALESCE(cycle_code, CONCAT('SYNC-', cycle_id))
         WHERE cycle_id = ?`,
        [startDate, dueDate, cycleId],
      );
    } catch {
      // old schema - keep backward compatibility
    }

    return cycleId;
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

  static async createItemIfNotExists(
    cycleId: number,
    userId: number,
    currentRole: string,
    employeeStatus: string | null,
    lastLoginAt: Date | null,
    reviewNote: string | null,
    conn: PoolConnection,
  ): Promise<boolean> {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT IGNORE INTO audit_review_items
       (cycle_id, user_id, current_role, employee_status, last_login_at, review_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cycleId, userId, currentRole, employeeStatus, lastLoginAt, reviewNote],
    );
    return result.affectedRows > 0;
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

  // ── User queries ────────────────────────────────────────────────────────────

  static async findUserIdByCitizenId(
    citizenId: string,
    conn: PoolConnection,
  ): Promise<number | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id
       FROM users
       WHERE citizen_id = ?
       LIMIT 1`,
      [citizenId],
    );
    return Number((rows[0] as { id?: number } | undefined)?.id ?? 0) || null;
  }

  static async findNonAdminUsers(conn: PoolConnection): Promise<any[]> {
    const hasSupportSubDepartment = await this.hasSupportSubDepartmentColumn(conn);
    const supportSubDepartmentExpr = hasSupportSubDepartment
      ? "s.sub_department"
      : "NULL";
    const [rows] = await conn.query<RowDataPacket[]>(`
      SELECT u.id, u.citizen_id, u.role, u.is_active, u.last_login_at, u.created_at,
             COALESCE(
               NULLIF(e.original_status, ''),
               CASE
                 WHEN s.is_currently_active = 0 THEN 'inactive'
                 WHEN s.is_currently_active = 1 THEN 'active'
                 ELSE NULL
               END,
               'unknown'
             ) AS employee_status,
             COALESCE(e.position_name, s.position_name) AS position_name,
             e.special_position AS special_position,
             COALESCE(e.department, s.department) AS department,
             COALESCE(e.sub_department, ${supportSubDepartmentExpr}) AS sub_department,
             GREATEST(
               COALESCE(e.last_synced_at, '1970-01-01'),
               COALESCE(s.last_synced_at, '1970-01-01')
             ) AS profile_synced_at
      FROM users u
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE u.role != 'ADMIN'
    `);
    return rows as any[];
  }

  static async countItemsByCycle(
    cycleId: number,
    conn: PoolConnection,
  ): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM audit_review_items
       WHERE cycle_id = ?`,
      [cycleId],
    );
    return Number((rows[0] as any)?.count || 0);
  }

  static async updateCycleTotalUsers(
    cycleId: number,
    totalUsers: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE audit_review_cycles
       SET total_users = ?
       WHERE cycle_id = ?`,
      [totalUsers, cycleId],
    );
  }

  static async updatePendingItemsToKeep(params: {
    cycleId: number;
    completedBy: number;
    note: string;
    conn: PoolConnection;
  }): Promise<void> {
    const { cycleId, completedBy, note, conn } = params;
    await conn.execute(
      `UPDATE audit_review_items
       SET review_result = 'KEEP',
           reviewed_at = NOW(),
           reviewed_by = ?,
           review_note = COALESCE(?, review_note)
       WHERE cycle_id = ? AND review_result = 'PENDING'`,
      [completedBy, note, cycleId],
    );
  }

  static async findActiveCycleByQuarterYear(params: {
    quarter: number;
    year: number;
    conn: PoolConnection;
  }): Promise<ReviewCycle | null> {
    const { quarter, year, conn } = params;
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM audit_review_cycles WHERE quarter = ? AND year = ? AND status != ?",
      [quarter, year, "COMPLETED"],
    );
    return (rows[0] as ReviewCycle) ?? null;
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

  static async findSyncBatchStartedAt(
    batchId: number,
    conn: PoolConnection,
  ): Promise<Date | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT started_at
       FROM hrms_sync_batches
       WHERE batch_id = ?
       LIMIT 1`,
      [batchId],
    );
    const startedAt = (rows[0] as { started_at?: Date | string | null } | undefined)?.started_at;
    if (!startedAt) return null;
    const value = startedAt instanceof Date ? startedAt : new Date(startedAt);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  static async appendQueueEvent(input: {
    queueId: number;
    eventType: string;
    batchId?: number | null;
    actorId?: number | null;
    payload?: Record<string, unknown> | null;
    conn: PoolConnection;
  }): Promise<void> {
    const payload = input.payload ? JSON.stringify(input.payload) : null;
    await input.conn.execute(
      `INSERT INTO access_review_queue_events
       (queue_id, event_type, batch_id, actor_id, event_payload)
       VALUES (?, ?, ?, ?, CAST(? AS JSON))`,
      [input.queueId, input.eventType, input.batchId ?? null, input.actorId ?? null, payload],
    );
  }

  static async upsertQueueDetection(input: {
    userId: number;
    reasonCode: string;
    batchId?: number | null;
    detectedAt: Date;
    payload?: Record<string, unknown> | null;
    conn: PoolConnection;
  }): Promise<{ queueId: number; eventType: "OPENED" | "REOPENED_FROM_SYNC" | "RESEEN_IN_BATCH" }> {
    const payload = input.payload ? JSON.stringify(input.payload) : null;
    const [rows] = await input.conn.query<RowDataPacket[]>(
      `SELECT queue_id, status
       FROM access_review_queue
       WHERE user_id = ? AND reason_code = ?
       LIMIT 1
       FOR UPDATE`,
      [input.userId, input.reasonCode],
    );

    if (!rows.length) {
      const [result] = await input.conn.execute<ResultSetHeader>(
        `INSERT INTO access_review_queue
         (user_id, reason_code, status, source_batch_id, last_seen_batch_id,
          first_detected_at, last_detected_at, opened_at, resolved_at, resolved_by, payload_json, note)
         VALUES (?, ?, 'OPEN', ?, ?, ?, ?, ?, NULL, NULL, CAST(? AS JSON), NULL)`,
        [
          input.userId,
          input.reasonCode,
          input.batchId ?? null,
          input.batchId ?? null,
          input.detectedAt,
          input.detectedAt,
          input.detectedAt,
          payload,
        ],
      );
      const queueId = Number(result.insertId);
      await this.appendQueueEvent({
        queueId,
        eventType: "OPENED",
        batchId: input.batchId ?? null,
        payload: input.payload ?? null,
        conn: input.conn,
      });
      return { queueId, eventType: "OPENED" };
    }

    const row = rows[0] as { queue_id: number; status: AccessReviewQueueStatus };
    const queueId = Number(row.queue_id);
    const isReopen =
      row.status === AccessReviewQueueStatus.RESOLVED ||
      row.status === AccessReviewQueueStatus.DISMISSED;

    await input.conn.execute(
      `UPDATE access_review_queue
       SET status = IF(status IN ('RESOLVED', 'DISMISSED'), 'OPEN', status),
           source_batch_id = IF(status IN ('RESOLVED', 'DISMISSED'), ?, source_batch_id),
           last_seen_batch_id = ?,
           last_detected_at = ?,
           opened_at = IF(status IN ('RESOLVED', 'DISMISSED'), ?, opened_at),
           resolved_at = NULL,
           resolved_by = NULL,
           payload_json = CAST(? AS JSON),
           note = NULL
       WHERE queue_id = ?`,
      [
        input.batchId ?? null,
        input.batchId ?? null,
        input.detectedAt,
        input.detectedAt,
        payload,
        queueId,
      ],
    );

    const eventType: "REOPENED_FROM_SYNC" | "RESEEN_IN_BATCH" = isReopen
      ? "REOPENED_FROM_SYNC"
      : "RESEEN_IN_BATCH";
    await this.appendQueueEvent({
      queueId,
      eventType,
      batchId: input.batchId ?? null,
      payload: input.payload ?? null,
      conn: input.conn,
    });
    return { queueId, eventType };
  }

  static async autoResolveUnseenQueueByBatch(input: {
    batchId: number;
    userId?: number | null;
    conn: PoolConnection;
  }): Promise<number> {
    const params: Array<number | string> = [input.batchId];
    let sql = `SELECT queue_id
               FROM access_review_queue
               WHERE status IN ('OPEN', 'IN_REVIEW')
                 AND reason_code IN ('NEW_USER', 'ROLE_MISMATCH', 'PROFILE_CHANGED', 'INACTIVE_BUT_ACTIVE')
                 AND (last_seen_batch_id IS NULL OR last_seen_batch_id <> ?)`;
    if (input.userId) {
      sql += " AND user_id = ?";
      params.push(input.userId);
    }

    const [rows] = await input.conn.query<RowDataPacket[]>(sql, params);
    if (!rows.length) return 0;
    const queueIds = rows.map((row) => Number((row as { queue_id: number }).queue_id));
    const placeholders = queueIds.map(() => "?").join(",");
    await input.conn.execute(
      `UPDATE access_review_queue
       SET status = 'RESOLVED',
           resolved_at = NOW(),
           resolved_by = NULL,
           note = 'RESOLVED_BY_SYNC'
       WHERE queue_id IN (${placeholders})`,
      queueIds,
    );

    for (const queueId of queueIds) {
      await this.appendQueueEvent({
        queueId,
        eventType: "AUTO_RESOLVED",
        batchId: input.batchId,
        payload: { reason: "not_detected_in_latest_sync_batch" },
        conn: input.conn,
      });
    }
    return queueIds.length;
  }

  static async getReviewQueue(input?: {
    page?: number;
    limit?: number;
    status?: AccessReviewQueueStatus;
    reasonCode?: string;
    currentRole?: string;
    isActive?: number;
    detectedFrom?: string;
    detectedTo?: string;
    batchId?: number;
    search?: string;
  }): Promise<{
    rows: Array<Record<string, unknown>>;
    total: number;
    page: number;
    limit: number;
    summary: {
      open_count: number;
      in_review_count: number;
      resolved_count: number;
      dismissed_count: number;
    };
    reason_options: string[];
  }> {
    const page = Math.max(1, Number(input?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(input?.limit ?? 20)));
    const offset = (page - 1) * limit;
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (input?.status) {
      where.push("q.status = ?");
      params.push(input.status);
    }
    if (input?.reasonCode) {
      where.push("q.reason_code = ?");
      params.push(input.reasonCode);
    }
    if (input?.currentRole?.trim()) {
      where.push("u.role = ?");
      params.push(input.currentRole.trim());
    }
    if (input?.isActive === 0 || input?.isActive === 1) {
      where.push("u.is_active = ?");
      params.push(input.isActive);
    }
    if (input?.detectedFrom?.trim()) {
      where.push("q.last_detected_at >= ?");
      params.push(`${input.detectedFrom.trim()} 00:00:00`);
    }
    if (input?.detectedTo?.trim()) {
      where.push("q.last_detected_at < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(`${input.detectedTo.trim()} 00:00:00`);
    }
    if (input?.batchId) {
      where.push("(q.source_batch_id = ? OR q.last_seen_batch_id = ?)");
      params.push(input.batchId, input.batchId);
    }
    if (input?.search?.trim()) {
      const keyword = `%${input.search.trim()}%`;
      where.push(
        "(u.citizen_id LIKE ? OR COALESCE(e.first_name, s.first_name, '') LIKE ? OR COALESCE(e.last_name, s.last_name, '') LIKE ?)",
      );
      params.push(keyword, keyword, keyword);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM access_review_queue q
       JOIN users u ON q.user_id = u.id
       LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
       LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
       ${whereSql}`,
      params,
    );
    const total = Number((countRows[0] as { total?: number } | undefined)?.total ?? 0);

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         q.*,
         u.citizen_id,
         u.role AS current_role,
         u.is_active,
         COALESCE(e.first_name, s.first_name, '') AS first_name,
         COALESCE(e.last_name, s.last_name, '') AS last_name
       FROM access_review_queue q
       JOIN users u ON q.user_id = u.id
       LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
       LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
       ${whereSql}
       ORDER BY
         CASE q.status
           WHEN 'OPEN' THEN 1
           WHEN 'IN_REVIEW' THEN 2
           WHEN 'RESOLVED' THEN 3
           WHEN 'DISMISSED' THEN 4
           ELSE 5
         END,
         q.last_detected_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const mappedRows = rows.map((row) => ({
      ...row,
      payload_json: this.parseJsonCell((row as { payload_json?: unknown }).payload_json),
      user_name: `${String((row as { first_name?: string }).first_name ?? "")} ${String((row as { last_name?: string }).last_name ?? "")}`.trim(),
    }));

    const [summaryRows] = await db.query<RowDataPacket[]>(
      `SELECT
         SUM(status = 'OPEN') AS open_count,
         SUM(status = 'IN_REVIEW') AS in_review_count,
         SUM(status = 'RESOLVED') AS resolved_count,
         SUM(status = 'DISMISSED') AS dismissed_count
       FROM access_review_queue q
       JOIN users u ON q.user_id = u.id
       LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
       LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
       ${whereSql}`,
      params,
    );
    const summaryRow = (summaryRows[0] as {
      open_count?: number;
      in_review_count?: number;
      resolved_count?: number;
      dismissed_count?: number;
    }) ?? {
      open_count: 0,
      in_review_count: 0,
      resolved_count: 0,
      dismissed_count: 0,
    };

    const [reasonRows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT reason_code
       FROM access_review_queue
       ORDER BY reason_code`,
    );
    const reasonOptions = reasonRows
      .map((row) => String((row as { reason_code?: string }).reason_code ?? ""))
      .filter(Boolean);

    return {
      rows: mappedRows as Array<Record<string, unknown>>,
      total,
      page,
      limit,
      summary: {
        open_count: Number(summaryRow.open_count ?? 0),
        in_review_count: Number(summaryRow.in_review_count ?? 0),
        resolved_count: Number(summaryRow.resolved_count ?? 0),
        dismissed_count: Number(summaryRow.dismissed_count ?? 0),
      },
      reason_options: reasonOptions,
    };
  }

  static async getReviewQueueEvents(queueId: number, limit: number = 100): Promise<Array<Record<string, unknown>>> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT event_id, queue_id, event_type, batch_id, actor_id, event_payload, created_at
       FROM access_review_queue_events
       WHERE queue_id = ?
       ORDER BY event_id DESC
       LIMIT ?`,
      [queueId, Math.min(200, Math.max(1, limit))],
    );
    return rows.map((row) => ({
      ...row,
      event_payload: this.parseJsonCell((row as { event_payload?: unknown }).event_payload),
    })) as Array<Record<string, unknown>>;
  }

  static async resolveQueueItem(input: {
    queueId: number;
    status: AccessReviewQueueStatus.RESOLVED | AccessReviewQueueStatus.DISMISSED;
    actorId: number;
    note?: string | null;
    conn: PoolConnection;
  }): Promise<void> {
    const [rows] = await input.conn.query<RowDataPacket[]>(
      `SELECT queue_id, status
       FROM access_review_queue
       WHERE queue_id = ?
       LIMIT 1
       FOR UPDATE`,
      [input.queueId],
    );
    if (!rows.length) {
      throw new Error("Queue item not found");
    }

    await input.conn.execute(
      `UPDATE access_review_queue
       SET status = ?,
           resolved_at = NOW(),
           resolved_by = ?,
           note = ?
       WHERE queue_id = ?`,
      [input.status, input.actorId, input.note ?? null, input.queueId],
    );
    await this.appendQueueEvent({
      queueId: input.queueId,
      eventType:
        input.status === AccessReviewQueueStatus.RESOLVED
          ? "MANUAL_RESOLVED"
          : "MANUAL_DISMISSED",
      actorId: input.actorId,
      payload: { note: input.note ?? null },
      conn: input.conn,
    });
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return getConnection();
  }
}
