/**
 * Audit Module - Repository
 *
 * Handles all database operations for audit trail
 */

import { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import {
  AuditEvent,
  CreateAuditEventInput,
  AuditSearchFilter,
  AuditSummaryItem,
} from '@/modules/audit/entities/audit.entity.js';

export class AuditRepository {
  private static schemaReady = false;

  static async ensureSchema(conn?: PoolConnection): Promise<void> {
    if (AuditRepository.schemaReady) return;
    const executor = conn ?? db;
    try {
      const [rows] = await executor.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM audit_logs LIKE 'event_type'",
      );
      const type = String((rows[0] as any)?.Type ?? "").toLowerCase();
      if (type.startsWith("enum(")) {
        // Avoid enum drift between DB and code by using a plain string column.
        await executor.execute(
          "ALTER TABLE audit_logs MODIFY event_type VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL",
        );
      }
      AuditRepository.schemaReady = true;
    } catch (error: any) {
      // If table is missing (fresh DB), create a minimal compatible schema.
      const message = String(error?.message ?? "");
      if (message.includes("doesn't exist") || message.includes("ER_NO_SUCH_TABLE")) {
        await executor.execute(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            audit_id INT NOT NULL AUTO_INCREMENT,
            event_type VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
            entity_type VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Table or entity name (pts_requests, users, etc.)',
            entity_id INT DEFAULT NULL COMMENT 'Primary key of affected entity',
            actor_id INT DEFAULT NULL COMMENT 'User who performed the action',
            actor_role VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Role of actor at time of action',
            action_detail JSON DEFAULT NULL COMMENT 'Structured detail of what changed',
            ip_address VARCHAR(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            user_agent VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (audit_id) USING BTREE,
            KEY idx_audit_event_type (event_type) USING BTREE,
            KEY idx_audit_entity (entity_type, entity_id) USING BTREE,
            KEY idx_audit_actor (actor_id) USING BTREE,
            KEY idx_audit_created (created_at) USING BTREE,
            KEY idx_audit_actor_created (actor_id, created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC
        `);
        AuditRepository.schemaReady = true;
        return;
      }

      // Do not block application flow if schema check fails in restricted envs.
      AuditRepository.schemaReady = true;
      console.warn("AuditRepository.ensureSchema failed:", error);
    }
  }

  // ── Create audit event ──────────────────────────────────────────────────────

  static async create(
    input: CreateAuditEventInput,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    await AuditRepository.ensureSchema(conn);
    const sql = `
      INSERT INTO audit_logs
      (event_type, entity_type, entity_id, actor_id, actor_role, action_detail, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      input.eventType,
      input.entityType,
      input.entityId || null,
      input.actorId || null,
      input.actorRole || null,
      input.actionDetail ? JSON.stringify(input.actionDetail) : null,
      input.ipAddress || null,
      input.userAgent || null,
    ];

    const [result] = await executor.execute<ResultSetHeader>(sql, params);
    return result.insertId;
  }

  // ── Search audit events ─────────────────────────────────────────────────────

  static async search(
    filter: AuditSearchFilter,
    conn?: PoolConnection,
  ): Promise<{ events: AuditEvent[]; total: number }> {
    const executor = conn ?? db;
    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 50, 500);
    const offset = (page - 1) * limit;

    const { whereClause, params } = AuditRepository.buildWhereClause(filter);

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM audit_logs a WHERE ${whereClause}`;
    const [countRows] = await executor.query<RowDataPacket[]>(countSql, params);
    const total = Number((countRows[0] as any)?.total || 0);

    // Get events with actor name
    const sql = `
      SELECT a.*,
             COALESCE(a.actor_role, u.role) AS resolved_actor_role,
             COALESCE(e.first_name, s.first_name, '') AS actor_first_name,
             COALESCE(e.last_name, s.last_name, '') AS actor_last_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);

    const events: AuditEvent[] = (rows as any[]).map((row) =>
      AuditRepository.mapRowToAuditEvent(row),
    );

    return { events, total };
  }

  // ── Find by entity ──────────────────────────────────────────────────────────

  static async findByEntity(
    entityType: string,
    entityId: number,
    limit: number = 100,
    conn?: PoolConnection,
  ): Promise<AuditEvent[]> {
    const executor = conn ?? db;
    const sql = `
      SELECT a.*,
             COALESCE(a.actor_role, u.role) AS resolved_actor_role,
             COALESCE(e.first_name, s.first_name, '') AS actor_first_name,
             COALESCE(e.last_name, s.last_name, '') AS actor_last_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE a.entity_type = ? AND a.entity_id = ?
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;

    const [rows] = await executor.query<RowDataPacket[]>(sql, [
      entityType,
      entityId,
    ]);

    return (rows as any[]).map((row) =>
      AuditRepository.mapRowToAuditEvent(row),
    );
  }

  // ── Get summary ─────────────────────────────────────────────────────────────

  static async getSummary(
    startDate?: Date | string,
    endDate?: Date | string,
    conn?: PoolConnection,
  ): Promise<AuditSummaryItem[]> {
    const executor = conn ?? db;
    let sql = `
      SELECT event_type, COUNT(*) as count
      FROM audit_logs
      WHERE 1=1
    `;

    const params: any[] = [];

    if (startDate) {
      sql += " AND created_at >= ?";
      params.push(startDate);
    }

    if (endDate) {
      sql += " AND created_at <= ?";
      params.push(endDate);
    }

    sql += " GROUP BY event_type ORDER BY count DESC";

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);

    return (rows as any[]).map((row) => ({
      event_type: row.event_type,
      count: Number(row.count),
    }));
  }

  // ── Helper: Build WHERE clause ──────────────────────────────────────────────

  private static buildWhereClause(filter: AuditSearchFilter): {
    whereClause: string;
    params: any[];
  } {
    const whereClauses: string[] = ["1=1"];
    const params: any[] = [];

    // Event type filter
    if (filter.eventType) {
      if (Array.isArray(filter.eventType)) {
        whereClauses.push(
          `a.event_type IN (${filter.eventType.map(() => "?").join(",")})`,
        );
        params.push(...filter.eventType);
      } else {
        whereClauses.push("a.event_type = ?");
        params.push(filter.eventType);
      }
    }

    // Entity filters
    if (filter.entityType) {
      whereClauses.push("a.entity_type = ?");
      params.push(filter.entityType);
    }

    if (filter.entityId) {
      whereClauses.push("a.entity_id = ?");
      params.push(filter.entityId);
    }

    // Actor filter
    if (filter.actorId) {
      whereClauses.push("a.actor_id = ?");
      params.push(filter.actorId);
    }

    // Date range
    if (filter.startDate) {
      whereClauses.push("a.created_at >= ?");
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      whereClauses.push("a.created_at <= ?");
      params.push(filter.endDate);
    }

    // Text search (in action_detail JSON)
    if (filter.search) {
      whereClauses.push(`(
        a.action_detail LIKE ?
        OR a.entity_type LIKE ?
        OR a.event_type LIKE ?
        OR a.actor_role LIKE ?
        OR a.ip_address LIKE ?
        OR CAST(a.entity_id AS CHAR) LIKE ?
        OR CAST(a.actor_id AS CHAR) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM users su
          LEFT JOIN emp_profiles se ON su.citizen_id = se.citizen_id
          LEFT JOIN emp_support_staff ss ON su.citizen_id = ss.citizen_id
          WHERE su.id = a.actor_id
            AND (
              CONCAT_WS(' ', COALESCE(se.first_name, ss.first_name, ''), COALESCE(se.last_name, ss.last_name, '')) LIKE ?
              OR su.citizen_id LIKE ?
            )
        )
      )`);
      const searchPattern = `%${filter.search}%`;
      params.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    }

    return {
      whereClause: whereClauses.join(" AND "),
      params,
    };
  }

  // ── Helper: Map row to entity ───────────────────────────────────────────────

  private static mapRowToAuditEvent(row: any): AuditEvent {
    return {
      audit_id: row.audit_id,
      event_type: row.event_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      actor_id: row.actor_id,
      actor_role: row.resolved_actor_role ?? row.actor_role,
      action_detail: AuditRepository.parseActionDetail(row.action_detail),
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
      actor_name:
        `${row.actor_first_name || ""} ${row.actor_last_name || ""}`.trim() ||
        null,
    };
  }

  private static parseActionDetail(
    value: unknown,
  ): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return value as Record<string, unknown>;
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
