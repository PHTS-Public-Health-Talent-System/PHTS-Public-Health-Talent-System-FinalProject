import { query } from '@config/database.js';
import type { RowDataPacket } from 'mysql2';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';

type SyncType = 'FULL' | 'USER';

export type TransformRuleRow = RowDataPacket & {
  rule_id: number;
  target_view: string;
  target_field: string;
  rule_type: 'REGEX_REPLACE' | 'MAP_VALUE' | 'DATE_NORMALIZE' | 'CLASSIFY_LEAVE_TYPE';
  match_pattern: string | null;
  replace_value: string | null;
  priority: number;
  is_active: number;
  notes: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
};

type TransformLogInsert = {
  batchId: number;
  targetView: string;
  sourceKey: string;
  fieldName: string;
  beforeValue: string | null;
  afterValue: string | null;
  ruleId: number | null;
};

const toSyncSummary = (stats: SyncStats) => {
  const totalRecords =
    stats.users.added +
    stats.users.updated +
    stats.users.skipped +
    stats.employees.upserted +
    stats.employees.skipped +
    stats.support_employees.upserted +
    stats.support_employees.skipped +
    stats.signatures.added +
    stats.signatures.skipped +
    stats.licenses.upserted +
    stats.quotas.upserted +
    stats.leaves.upserted +
    stats.leaves.skipped +
    stats.movements.added +
    stats.roles.updated +
    stats.roles.skipped +
    stats.roles.missing;

  const changedRecords =
    stats.users.added +
    stats.users.updated +
    stats.employees.upserted +
    stats.support_employees.upserted +
    stats.signatures.added +
    stats.licenses.upserted +
    stats.quotas.upserted +
    stats.leaves.upserted +
    stats.movements.added +
    stats.roles.updated;

  return { totalRecords, changedRecords };
};

export class TransformMonitorRepository {
  static async createSyncBatch(input: {
    syncType: SyncType;
    triggeredBy?: number | null;
    targetCitizenId?: string | null;
  }): Promise<number> {
    const result = await query<{ insertId: number } & RowDataPacket[]>(
      `
      INSERT INTO hrms_sync_batches (sync_type, status, triggered_by, target_citizen_id)
      VALUES (?, 'RUNNING', ?, ?)
      `,
      [input.syncType, input.triggeredBy ?? null, input.targetCitizenId ?? null],
    );
    return Number((result as any).insertId);
  }

  static async finishSyncBatchSuccess(
    batchId: number,
    stats: SyncStats,
    durationMs: number,
  ): Promise<void> {
    const summary = toSyncSummary(stats);
    await query(
      `
      UPDATE hrms_sync_batches
      SET status = 'SUCCESS',
          finished_at = NOW(),
          duration_ms = ?,
          total_records = ?,
          changed_records = ?,
          error_records = 0,
          stats_json = ?
      WHERE batch_id = ?
      `,
      [durationMs, summary.totalRecords, summary.changedRecords, JSON.stringify(stats), batchId],
    );
  }

  static async finishSyncBatchFailed(
    batchId: number,
    errorMessage: string,
    durationMs: number,
  ): Promise<void> {
    await query(
      `
      UPDATE hrms_sync_batches
      SET status = 'FAILED',
          finished_at = NOW(),
          duration_ms = ?,
          error_records = 1,
          error_message = ?
      WHERE batch_id = ?
      `,
      [durationMs, errorMessage.slice(0, 1000), batchId],
    );
  }

  static async getSyncBatches(limit: number): Promise<RowDataPacket[]> {
    const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
    return query<RowDataPacket[]>(
      `
      SELECT batch_id, sync_type, status, triggered_by, target_citizen_id,
             started_at, finished_at, duration_ms, total_records,
             changed_records, error_records, error_message, created_at
      FROM hrms_sync_batches
      ORDER BY batch_id DESC
      LIMIT ${safeLimit}
      `,
    );
  }

  static async getTransformRules(): Promise<TransformRuleRow[]> {
    return query<TransformRuleRow[]>(
      `
      SELECT rule_id, target_view, target_field, rule_type, match_pattern, replace_value,
             priority, is_active, notes, created_by, updated_by, created_at, updated_at
      FROM hrms_transform_rules
      ORDER BY target_view ASC, target_field ASC, priority ASC, rule_id ASC
      `,
    );
  }

  static async getActiveTransformRules(targetView?: string): Promise<TransformRuleRow[]> {
    if (targetView) {
      return query<TransformRuleRow[]>(
        `
        SELECT rule_id, target_view, target_field, rule_type, match_pattern, replace_value,
               priority, is_active, notes, created_by, updated_by, created_at, updated_at
        FROM hrms_transform_rules
        WHERE is_active = 1 AND target_view = ?
        ORDER BY target_view ASC, target_field ASC, priority ASC, rule_id ASC
        `,
        [targetView],
      );
    }

    return query<TransformRuleRow[]>(
      `
      SELECT rule_id, target_view, target_field, rule_type, match_pattern, replace_value,
             priority, is_active, notes, created_by, updated_by, created_at, updated_at
      FROM hrms_transform_rules
      WHERE is_active = 1
      ORDER BY target_view ASC, target_field ASC, priority ASC, rule_id ASC
      `,
    );
  }

  static async createTransformRule(input: {
    targetView: string;
    targetField: string;
    ruleType: 'REGEX_REPLACE' | 'MAP_VALUE' | 'DATE_NORMALIZE' | 'CLASSIFY_LEAVE_TYPE';
    matchPattern?: string | null;
    replaceValue?: string | null;
    priority?: number;
    isActive?: boolean;
    notes?: string | null;
    actorId?: number | null;
  }): Promise<number> {
    const result = await query<{ insertId: number } & RowDataPacket[]>(
      `
      INSERT INTO hrms_transform_rules (
        target_view, target_field, rule_type, match_pattern, replace_value,
        priority, is_active, notes, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.targetView,
        input.targetField,
        input.ruleType,
        input.matchPattern ?? null,
        input.replaceValue ?? null,
        input.priority ?? 100,
        input.isActive === false ? 0 : 1,
        input.notes ?? null,
        input.actorId ?? null,
        input.actorId ?? null,
      ],
    );
    return Number((result as any).insertId);
  }

  static async updateTransformRule(
    ruleId: number,
    input: {
      matchPattern?: string | null;
      replaceValue?: string | null;
      priority?: number;
      isActive?: boolean;
      notes?: string | null;
      actorId?: number | null;
    },
  ): Promise<void> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (Object.prototype.hasOwnProperty.call(input, 'matchPattern')) {
      updates.push('match_pattern = ?');
      params.push(input.matchPattern ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'replaceValue')) {
      updates.push('replace_value = ?');
      params.push(input.replaceValue ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'priority')) {
      updates.push('priority = ?');
      params.push(input.priority ?? 100);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'isActive')) {
      updates.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'notes')) {
      updates.push('notes = ?');
      params.push(input.notes ?? null);
    }

    updates.push('updated_by = ?');
    updates.push('updated_at = NOW()');
    params.push(input.actorId ?? null);
    params.push(ruleId);

    await query(
      `
      UPDATE hrms_transform_rules
      SET ${updates.join(', ')}
      WHERE rule_id = ?
      `,
      params,
    );
  }

  static async getTransformRuleById(ruleId: number): Promise<TransformRuleRow | null> {
    const rows = await query<TransformRuleRow[]>(
      `
      SELECT rule_id, target_view, target_field, rule_type, match_pattern, replace_value,
             priority, is_active, notes, created_by, updated_by, created_at, updated_at
      FROM hrms_transform_rules
      WHERE rule_id = ?
      LIMIT 1
      `,
      [ruleId],
    );
    return rows[0] ?? null;
  }

  static async insertTransformLogs(entries: TransformLogInsert[]): Promise<void> {
    if (!entries.length) return;
    for (const entry of entries) {
      await query(
        `
        INSERT INTO hrms_transform_logs (
          batch_id, target_view, source_key, field_name, before_value, after_value, rule_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          entry.batchId,
          entry.targetView,
          entry.sourceKey,
          entry.fieldName,
          entry.beforeValue,
          entry.afterValue,
          entry.ruleId,
        ],
      );
    }
  }

  static async createDataIssue(input: {
    batchId?: number | null;
    targetView: string;
    sourceKey: string;
    issueCode: string;
    issueDetail?: string | null;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<void> {
    await query(
      `
      INSERT INTO hrms_data_issues (
        batch_id, target_view, source_key, issue_code, issue_detail, severity, status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'OPEN')
      `,
      [
        input.batchId ?? null,
        input.targetView,
        input.sourceKey,
        input.issueCode,
        input.issueDetail ?? null,
        input.severity ?? 'MEDIUM',
      ],
    );
  }

  static async getTransformLogs(input: {
    limit: number;
    batchId?: number;
  }): Promise<RowDataPacket[]> {
    const safeLimit = Math.max(1, Math.min(Number(input.limit || 50), 200));
    if (input.batchId) {
      return query<RowDataPacket[]>(
        `
        SELECT log_id, batch_id, target_view, source_key, field_name,
               before_value, after_value, rule_id, applied_at
        FROM hrms_transform_logs
        WHERE batch_id = ?
        ORDER BY log_id DESC
        LIMIT ${safeLimit}
        `,
        [input.batchId],
      );
    }

    return query<RowDataPacket[]>(
      `
      SELECT log_id, batch_id, target_view, source_key, field_name,
             before_value, after_value, rule_id, applied_at
      FROM hrms_transform_logs
      ORDER BY log_id DESC
      LIMIT ${safeLimit}
      `,
    );
  }

  static async getDataIssues(input: { limit: number; status?: 'OPEN' | 'RESOLVED' | 'IGNORED' }): Promise<RowDataPacket[]> {
    const safeLimit = Math.max(1, Math.min(Number(input.limit || 50), 200));
    if (input.status) {
      return query<RowDataPacket[]>(
        `
        SELECT issue_id, batch_id, target_view, source_key, issue_code, issue_detail,
               severity, status, resolved_by, resolved_at, created_at
        FROM hrms_data_issues
        WHERE status = ?
        ORDER BY issue_id DESC
        LIMIT ${safeLimit}
        `,
        [input.status],
      );
    }
    return query<RowDataPacket[]>(
      `
      SELECT issue_id, batch_id, target_view, source_key, issue_code, issue_detail,
             severity, status, resolved_by, resolved_at, created_at
      FROM hrms_data_issues
      ORDER BY issue_id DESC
      LIMIT ${safeLimit}
      `,
    );
  }
}
