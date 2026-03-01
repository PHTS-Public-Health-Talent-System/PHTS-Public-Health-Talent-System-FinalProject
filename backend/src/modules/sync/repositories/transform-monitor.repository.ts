import { query } from '@config/database.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type {
  SyncCoreStatus,
  SyncOverallStatus,
  SyncPostStatus,
  SyncStageGroup,
  SyncStageKey,
  SyncStageRun,
  SyncStageStatus,
  SyncStats,
} from '@/modules/sync/services/shared/sync.types.js';

type SyncType = 'FULL' | 'USER';

type SyncBatchStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

type SyncRecordTableConfig = {
  timestampColumn: string;
  selectColumns: string[];
  searchColumns: string[];
};

const SYNC_RECORD_TABLE_CONFIG: Record<string, SyncRecordTableConfig> = {
  users: {
    timestampColumn: 'updated_at',
    selectColumns: ['id', 'citizen_id', 'role', 'is_active', 'updated_at'],
    searchColumns: ['citizen_id', 'role'],
  },
  emp_profiles: {
    timestampColumn: 'last_synced_at',
    selectColumns: [
      'citizen_id',
      'first_name',
      'last_name',
      'position_name',
      'department',
      'status_code',
      'last_synced_at',
    ],
    searchColumns: ['citizen_id', 'first_name', 'last_name', 'position_name', 'department'],
  },
  emp_support_staff: {
    timestampColumn: 'last_synced_at',
    selectColumns: [
      'citizen_id',
      'first_name',
      'last_name',
      'position_name',
      'department',
      'status_code',
      'last_synced_at',
    ],
    searchColumns: ['citizen_id', 'first_name', 'last_name', 'position_name', 'department'],
  },
  leave_records: {
    timestampColumn: 'synced_at',
    selectColumns: [
      'id',
      'ref_id',
      'citizen_id',
      'leave_type',
      'start_date',
      'end_date',
      'duration_days',
      'synced_at',
    ],
    searchColumns: ['citizen_id', 'ref_id', 'leave_type', 'remark'],
  },
  emp_licenses: {
    timestampColumn: 'synced_at',
    selectColumns: [
      'license_id',
      'citizen_id',
      'license_name',
      'license_no',
      'valid_from',
      'valid_until',
      'status',
      'synced_at',
    ],
    searchColumns: ['citizen_id', 'license_name', 'license_no'],
  },
  leave_quotas: {
    timestampColumn: 'updated_at',
    selectColumns: [
      'quota_id',
      'citizen_id',
      'fiscal_year',
      'quota_vacation',
      'quota_personal',
      'quota_sick',
      'updated_at',
    ],
    searchColumns: ['citizen_id', 'fiscal_year'],
  },
  emp_movements: {
    timestampColumn: 'synced_at',
    selectColumns: [
      'movement_id',
      'citizen_id',
      'movement_type',
      'effective_date',
      'synced_at',
    ],
    searchColumns: ['citizen_id', 'movement_type', 'remark'],
  },
  sig_images: {
    timestampColumn: 'updated_at',
    selectColumns: ['signature_id', 'user_id', 'citizen_id', 'updated_at'],
    searchColumns: ['citizen_id', 'user_id'],
  },
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
  static async cleanupOldMonitorData(input: {
    dataIssuesDays?: number;
    userAuditsDays?: number;
    stageRunsDays?: number;
    batchesDays?: number;
  }): Promise<{
    data_issues_deleted: number;
    user_audits_deleted: number;
    stage_runs_deleted: number;
    sync_batches_deleted: number;
  }> {
    const result = {
      data_issues_deleted: 0,
      user_audits_deleted: 0,
      stage_runs_deleted: 0,
      sync_batches_deleted: 0,
    };

    const dataIssuesDays = Number(input.dataIssuesDays ?? 0);
    if (dataIssuesDays > 0) {
      const deleted = await query<ResultSetHeader>(
        `
        DELETE FROM hrms_data_issues
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `,
        [dataIssuesDays],
      );
      result.data_issues_deleted = Number(deleted?.affectedRows ?? 0);
    }

    const userAuditsDays = Number(input.userAuditsDays ?? 0);
    if (userAuditsDays > 0) {
      const deleted = await query<ResultSetHeader>(
        `
        DELETE FROM user_sync_state_audits
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `,
        [userAuditsDays],
      );
      result.user_audits_deleted = Number(deleted?.affectedRows ?? 0);
    }

    const stageRunsDays = Number(input.stageRunsDays ?? 0);
    if (stageRunsDays > 0) {
      const deleted = await query<ResultSetHeader>(
        `
        DELETE FROM hrms_sync_stage_runs
        WHERE started_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `,
        [stageRunsDays],
      );
      result.stage_runs_deleted = Number(deleted?.affectedRows ?? 0);
    }

    const batchesDays = Number(input.batchesDays ?? 0);
    if (batchesDays > 0) {
      const deleted = await query<ResultSetHeader>(
        `
        DELETE b
        FROM hrms_sync_batches b
        LEFT JOIN hrms_sync_stage_runs sr ON sr.batch_id = b.batch_id
        LEFT JOIN hrms_data_issues di ON di.batch_id = b.batch_id
        LEFT JOIN user_sync_state_audits ua ON ua.sync_batch_id = b.batch_id
        WHERE b.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
          AND b.status <> 'RUNNING'
          AND sr.batch_id IS NULL
          AND di.batch_id IS NULL
          AND ua.sync_batch_id IS NULL
        `,
        [batchesDays],
      );
      result.sync_batches_deleted = Number(deleted?.affectedRows ?? 0);
    }

    return result;
  }

  static async createSyncBatch(input: {
    syncType: SyncType;
    triggeredBy?: number | null;
    targetCitizenId?: string | null;
  }): Promise<number> {
    const result = await query<{ insertId: number } & RowDataPacket[]>(
      `
      INSERT INTO hrms_sync_batches (
        sync_type,
        status,
        core_status,
        post_status,
        overall_status,
        warnings_count,
        triggered_by,
        target_citizen_id
      )
      VALUES (?, 'RUNNING', 'RUNNING', 'PENDING', 'RUNNING', 0, ?, ?)
      `,
      [input.syncType, input.triggeredBy ?? null, input.targetCitizenId ?? null],
    );
    return Number((result as any).insertId);
  }

  static async finishSyncBatchSuccess(
    batchId: number,
    stats: SyncStats,
    durationMs: number,
    options?: {
      status?: SyncBatchStatus;
      coreStatus?: SyncCoreStatus;
      postStatus?: SyncPostStatus;
      overallStatus?: SyncOverallStatus;
      warningsCount?: number;
    },
  ): Promise<void> {
    const summary = toSyncSummary(stats);
    await query(
      `
      UPDATE hrms_sync_batches
      SET status = ?,
          core_status = ?,
          post_status = ?,
          overall_status = ?,
          warnings_count = ?,
          finished_at = NOW(),
          duration_ms = ?,
          total_records = ?,
          changed_records = ?,
          error_records = 0,
          stats_json = ?
      WHERE batch_id = ?
      `,
      [
        options?.status ?? 'SUCCESS',
        options?.coreStatus ?? 'SUCCESS',
        options?.postStatus ?? 'SUCCESS',
        options?.overallStatus ?? 'SUCCESS',
        options?.warningsCount ?? 0,
        durationMs,
        summary.totalRecords,
        summary.changedRecords,
        JSON.stringify(stats),
        batchId,
      ],
    );
  }

  static async finishSyncBatchFailed(
    batchId: number,
    errorMessage: string,
    durationMs: number,
    options?: {
      coreStatus?: SyncCoreStatus;
      postStatus?: SyncPostStatus;
      overallStatus?: SyncOverallStatus;
    },
  ): Promise<void> {
    await query(
      `
      UPDATE hrms_sync_batches
      SET status = 'FAILED',
          core_status = ?,
          post_status = ?,
          overall_status = ?,
          warnings_count = 0,
          finished_at = NOW(),
          duration_ms = ?,
          error_records = 1,
          error_message = ?
      WHERE batch_id = ?
      `,
      [
        options?.coreStatus ?? 'FAILED',
        options?.postStatus ?? 'PENDING',
        options?.overallStatus ?? 'FAILED',
        durationMs,
        errorMessage.slice(0, 1000),
        batchId,
      ],
    );
  }

  static async updateBatchPipelineStatus(input: {
    batchId: number;
    coreStatus?: SyncCoreStatus;
    postStatus?: SyncPostStatus;
    overallStatus?: SyncOverallStatus;
    warningsCount?: number;
  }): Promise<void> {
    const updates: string[] = [];
    const params: unknown[] = [];
    if (input.coreStatus) {
      updates.push('core_status = ?');
      params.push(input.coreStatus);
    }
    if (input.postStatus) {
      updates.push('post_status = ?');
      params.push(input.postStatus);
    }
    if (input.overallStatus) {
      updates.push('overall_status = ?');
      params.push(input.overallStatus);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'warningsCount')) {
      updates.push('warnings_count = ?');
      params.push(input.warningsCount ?? 0);
    }
    if (!updates.length) return;
    params.push(input.batchId);
    await query(
      `
      UPDATE hrms_sync_batches
      SET ${updates.join(', ')}
      WHERE batch_id = ?
      `,
      params,
    );
  }

  static async startStageRun(input: {
    batchId: number;
    stageKey: SyncStageKey;
    stageGroup: SyncStageGroup;
  }): Promise<number> {
    const result = await query<{ insertId: number } & RowDataPacket[]>(
      `
      INSERT INTO hrms_sync_stage_runs (batch_id, stage_key, stage_group, status, started_at)
      VALUES (?, ?, ?, 'RUNNING', NOW())
      `,
      [input.batchId, input.stageKey, input.stageGroup],
    );
    return Number((result as any).insertId);
  }

  static async finishStageRun(input: {
    stageRunId: number;
    status: SyncStageStatus;
    errorMessage?: string | null;
    durationMs?: number;
  }): Promise<void> {
    await query(
      `
      UPDATE hrms_sync_stage_runs
      SET status = ?,
          error_message = ?,
          duration_ms = ?,
          finished_at = NOW()
      WHERE stage_run_id = ?
      `,
      [
        input.status,
        input.errorMessage ? input.errorMessage.slice(0, 2000) : null,
        input.durationMs ?? null,
        input.stageRunId,
      ],
    );
  }

  static async getStageRunsByBatchIds(batchIds: number[]): Promise<SyncStageRun[]> {
    if (!batchIds.length) return [];
    const marks = batchIds.map(() => '?').join(', ');
    return query<SyncStageRun[]>(
      `
      SELECT stage_run_id,
             batch_id,
             stage_key,
             stage_group,
             status,
             error_message,
             started_at,
             finished_at,
             duration_ms
      FROM hrms_sync_stage_runs
      WHERE batch_id IN (${marks})
      ORDER BY stage_run_id ASC
      `,
      batchIds,
    );
  }

  static async getSyncBatches(input: {
    page: number;
    limit: number;
  }): Promise<{
    rows: RowDataPacket[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
  }> {
    const safePage = Math.max(1, Math.min(Number(input.page || 1), 10_000));
    const safeLimit = Math.max(1, Math.min(Number(input.limit || 20), 100));
    const offset = (safePage - 1) * safeLimit;
    const [countRow] = await query<RowDataPacket[]>(
      `
      SELECT COUNT(*) AS total
      FROM hrms_sync_batches
      `,
    );
    const total = Number(countRow?.total ?? 0);
    const batches = await query<RowDataPacket[]>(
      `
      SELECT batch_id, sync_type, status, core_status, post_status, overall_status, warnings_count,
             triggered_by, target_citizen_id,
             started_at, finished_at, duration_ms, total_records,
             changed_records, error_records, stats_json, error_message, created_at
      FROM hrms_sync_batches
      ORDER BY batch_id DESC
      LIMIT ${safeLimit}
      OFFSET ${offset}
      `,
    );
    const stageRows = await this.getStageRunsByBatchIds(
      batches.map((row) => Number(row.batch_id)).filter((v) => Number.isFinite(v)),
    );
    const stageMap = new Map<number, SyncStageRun[]>();
    for (const stage of stageRows) {
      const key = Number(stage.batch_id);
      const list = stageMap.get(key) ?? [];
      list.push(stage);
      stageMap.set(key, list);
    }
    return {
      rows: batches.map((row) => ({
        ...row,
        stages: stageMap.get(Number(row.batch_id)) ?? [],
      })),
      total,
      page: safePage,
      limit: safeLimit,
      has_more: offset + batches.length < total,
    };
  }

  static async createDataIssue(input: {
    batchId?: number | null;
    targetTable: string;
    sourceKey: string;
    issueCode: string;
    issueDetail?: string | null;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<void> {
    // Active-only issue registry (requires unique key on target_table/source_key/issue_code).
    await query<ResultSetHeader>(
      `
      INSERT INTO hrms_data_issues (
        batch_id, target_table, source_key, issue_code, issue_detail, severity
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        batch_id = VALUES(batch_id),
        issue_detail = VALUES(issue_detail),
        severity = VALUES(severity)
      `,
      [
        input.batchId ?? null,
        input.targetTable,
        input.sourceKey,
        input.issueCode,
        input.issueDetail ?? null,
        input.severity ?? 'MEDIUM',
      ],
    );
  }

  static async deleteStaleIssuesForBatch(input: {
    batchId: number;
    issueCode: string;
    targetTable?: string;
  }): Promise<number> {
    const targetTableWhere = input.targetTable ? 'AND target_table = ?' : '';
    const params: unknown[] = [input.issueCode, input.batchId];
    if (input.targetTable) params.push(input.targetTable);

    const result = await query<ResultSetHeader>(
      `
      DELETE FROM hrms_data_issues
      WHERE issue_code = ?
        AND batch_id <> ?
        ${targetTableWhere}
      `,
      params,
    );

    return Number(result?.affectedRows ?? 0);
  }

  static async getDataIssues(input: {
    page: number;
    limit: number;
    batchId?: number;
    targetTable?: string;
    issueCode?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<{
    rows: RowDataPacket[];
    total: number;
    page: number;
    limit: number;
    target_table_options: string[];
    issue_code_options: string[];
    severity_counts: {
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
  }> {
    const safePage = Math.max(1, Number(input.page || 1));
    const safeLimit = Math.max(1, Math.min(Number(input.limit || 20), 200));
    const offset = (safePage - 1) * safeLimit;

    const where: string[] = [];
    const params: unknown[] = [];
    if (input.batchId) {
      where.push('batch_id = ?');
      params.push(input.batchId);
    }
    if (input.targetTable) {
      where.push('target_table = ?');
      params.push(input.targetTable);
    }
    if (input.issueCode) {
      where.push('issue_code = ?');
      params.push(input.issueCode);
    }
    if (input.severity) {
      where.push('severity = ?');
      params.push(input.severity);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query<RowDataPacket[]>(
      `
      SELECT issue_id, batch_id, target_table, source_key, issue_code, issue_detail,
             severity, created_at
      FROM hrms_data_issues
      ${whereSql}
      ORDER BY issue_id DESC
      LIMIT ${safeLimit} OFFSET ${offset}
      `,
      params,
    );

    const countRows = await query<RowDataPacket[]>(
      `
      SELECT COUNT(*) AS total
      FROM hrms_data_issues
      ${whereSql}
      `,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const severityRows = await query<RowDataPacket[]>(
      `
      SELECT severity, COUNT(*) AS total
      FROM hrms_data_issues
      ${whereSql}
      GROUP BY severity
      `,
      params,
    );
    const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const row of severityRows) {
      const severity = String(row.severity ?? '');
      if (severity === 'HIGH' || severity === 'MEDIUM' || severity === 'LOW') {
        severityCounts[severity] = Number(row.total ?? 0);
      }
    }

    const facetWhere: string[] = [];
    const facetParams: unknown[] = [];
    if (input.batchId) {
      facetWhere.push('batch_id = ?');
      facetParams.push(input.batchId);
    }
    const facetWhereSql = facetWhere.length ? `WHERE ${facetWhere.join(' AND ')}` : '';

    const tableRows = await query<RowDataPacket[]>(
      `
      SELECT DISTINCT target_table
      FROM hrms_data_issues
      ${facetWhereSql}
      ORDER BY target_table ASC
      LIMIT 200
      `,
      facetParams,
    );

    const issueCodeRows = await query<RowDataPacket[]>(
      `
      SELECT DISTINCT issue_code
      FROM hrms_data_issues
      ${facetWhereSql}
      ORDER BY issue_code ASC
      LIMIT 200
      `,
      facetParams,
    );

    return {
      rows,
      total,
      page: safePage,
      limit: safeLimit,
      target_table_options: tableRows.map((row) => String(row.target_table)),
      issue_code_options: issueCodeRows.map((row) => String(row.issue_code)),
      severity_counts: severityCounts,
    };
  }

  static async getSyncRecords(input: {
    page: number;
    limit: number;
    batchId?: number;
    targetTable?: string;
    search?: string;
  }): Promise<{
    rows: RowDataPacket[];
    total: number;
    page: number;
    limit: number;
    batch_id: number | null;
    target_table: string;
    table_options: string[];
    table_counts: Record<string, number>;
  }> {
    const safePage = Math.max(1, Number(input.page || 1));
    const safeLimit = Math.max(1, Math.min(Number(input.limit || 20), 200));
    const offset = (safePage - 1) * safeLimit;

    const batchRows = input.batchId
      ? await query<RowDataPacket[]>(
          `
          SELECT batch_id, started_at, COALESCE(finished_at, NOW()) AS finished_at
          FROM hrms_sync_batches
          WHERE batch_id = ?
          LIMIT 1
          `,
          [input.batchId],
        )
      : await query<RowDataPacket[]>(
          `
          SELECT batch_id, started_at, COALESCE(finished_at, NOW()) AS finished_at
          FROM hrms_sync_batches
          ORDER BY
            CASE WHEN COALESCE(changed_records, 0) > 0 THEN 0 ELSE 1 END,
            batch_id DESC
          LIMIT 1
          `,
        );

    const batch = batchRows[0];
    if (!batch) {
      return {
        rows: [],
        total: 0,
        page: safePage,
        limit: safeLimit,
        batch_id: null,
        target_table: 'users',
        table_options: Object.keys(SYNC_RECORD_TABLE_CONFIG),
        table_counts: Object.fromEntries(
          Object.keys(SYNC_RECORD_TABLE_CONFIG).map((table) => [table, 0]),
        ),
      };
    }

    const tableCounts: Record<string, number> = {};
    for (const [tableName, tableConfig] of Object.entries(SYNC_RECORD_TABLE_CONFIG)) {
      const tableCountRows = await query<RowDataPacket[]>(
        `
        SELECT COUNT(*) AS total
        FROM \`${tableName}\`
        WHERE \`${tableConfig.timestampColumn}\` BETWEEN ? AND ?
        `,
        [batch.started_at, batch.finished_at],
      );
      tableCounts[tableName] = Number(tableCountRows[0]?.total ?? 0);
    }

    const targetTable = input.targetTable && SYNC_RECORD_TABLE_CONFIG[input.targetTable]
      ? input.targetTable
      : Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'users';
    const config = SYNC_RECORD_TABLE_CONFIG[targetTable];

    const where: string[] = [`\`${config.timestampColumn}\` BETWEEN ? AND ?`];
    const params: unknown[] = [batch.started_at, batch.finished_at];

    if (input.search && input.search.trim().length > 0) {
      const keyword = `%${input.search.trim()}%`;
      const searchSql = config.searchColumns
        .map((column) => `CAST(\`${column}\` AS CHAR) LIKE ?`)
        .join(' OR ');
      where.push(`(${searchSql})`);
      for (let i = 0; i < config.searchColumns.length; i += 1) {
        params.push(keyword);
      }
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const selectColumnsSql = config.selectColumns.map((column) => `\`${column}\``).join(', ');

    const rows = await query<RowDataPacket[]>(
      `
      SELECT ${selectColumnsSql}
      FROM \`${targetTable}\`
      ${whereSql}
      ORDER BY \`${config.timestampColumn}\` DESC
      LIMIT ${safeLimit} OFFSET ${offset}
      `,
      params,
    );

    const countRows = await query<RowDataPacket[]>(
      `
      SELECT COUNT(*) AS total
      FROM \`${targetTable}\`
      ${whereSql}
      `,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    return {
      rows,
      total,
      page: safePage,
      limit: safeLimit,
      batch_id: Number(batch.batch_id),
      target_table: targetTable,
      table_options: Object.keys(SYNC_RECORD_TABLE_CONFIG),
      table_counts: tableCounts,
    };
  }

  static async getUserSyncStateAudits(input: {
    limit: number;
    batchId?: number;
    citizenId?: string;
    action?: string;
  }): Promise<RowDataPacket[]> {
    const safeLimit = Math.max(1, Math.min(Number(input.limit || 100), 500));
    const where: string[] = [];
    const params: unknown[] = [];

    if (input.batchId) {
      where.push('sync_batch_id = ?');
      params.push(input.batchId);
    }
    if (input.citizenId) {
      where.push('citizen_id = ?');
      params.push(input.citizenId);
    }
    if (input.action) {
      where.push('action = ?');
      params.push(input.action);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return query<RowDataPacket[]>(
      `
      SELECT audit_id, sync_batch_id, user_id, citizen_id, action,
             before_is_active, after_is_active, reason, created_at
      FROM user_sync_state_audits
      ${whereClause}
      ORDER BY audit_id DESC
      LIMIT ${safeLimit}
      `,
      params,
    );
  }
}
