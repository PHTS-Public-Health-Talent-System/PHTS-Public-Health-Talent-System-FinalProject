import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import db from '@config/database.js';
import {
  assignRoles,
  IdentityRolePolicyService,
} from '@/modules/identity/services/identity-role-policy.service.js';
import { TransformMonitorRepository } from '@/modules/sync/repositories/transform-monitor.repository.js';
import { getRoleMappingDiagnostics } from '@/modules/sync/repositories/role-mapping.repository.js';
import { refreshReviewCycleFromSync } from '@/modules/access-review/services/access-review.service.js';
import { getSyncRuntimeStatus } from '@/modules/sync/services/sync-status.service.js';
import {
  claimAutoSyncWindow,
  getDueAutoSyncWindow,
} from '@/modules/sync/services/sync-auto-schedule.service.js';
import { clearScopeCache } from '@/modules/request/scope/application/scope.service.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';
import { applyImmediateMovementEligibilityCutoff } from '@/modules/workforce-compliance/services/immediate-rules.service.js';
import type {
  SyncCoreStatus,
  SyncOverallStatus,
  SyncPostStatus,
  SyncRuntimeStatus,
  SyncStats,
} from '@/modules/sync/services/shared/sync.types.js';
import { createSyncStats } from '@/modules/sync/services/shared/sync-stats.service.js';
import {
  acquireSyncLock,
  createSyncLockValue,
  getLastSyncStatus as getSyncStatusFromCache,
  releaseSyncLock,
  setLastSyncResult,
  startSyncLockHeartbeat,
} from '@/modules/sync/services/shared/sync-lock.service.js';
import {
  hasLeaveStatusColumn,
  hasSupportProfileFingerprintColumn,
  persistEmployeeProfileSyncArtifacts,
  persistSupportProfileSyncArtifacts,
  resolveSupportStaffColumnFlags,
  upsertEmployeeProfile,
  upsertLeaveQuota,
} from '@/modules/sync/services/shared/sync-db-helpers.service.js';
import { syncUsersFromProfilesAndSupport } from '@/modules/sync/services/domain/sync-users.service.js';
import {
  syncEmployees,
  syncSupportEmployees,
  upsertSingleEmployeeProfile,
  upsertSingleSupportEmployee,
} from '@/modules/sync/services/domain/sync-hr.service.js';
import {
  syncSignatures as runDomainSignaturesSync,
  syncLicensesAndQuotas as runDomainLicensesAndQuotasSync,
  syncLeaves as runDomainLeavesSync,
  syncMovements as runDomainMovementsSync,
  syncSingleSignature as runSingleSignatureSync,
  syncSingleLicenses as runSingleLicensesSync,
  syncSingleQuotas as runSingleQuotasSync,
  syncSingleLeaves as runSingleLeavesSync,
  syncSingleMovements as runSingleMovementsSync,
} from '@/modules/sync/services/domain/sync-domain.service.js';
import {
  normalizeLeaveRowWithMeta,
} from '@/modules/sync/services/domain/leave-normalizer.service.js';
import {
  buildScopesFromSpecialPosition as buildScopesFromSpecialPositionBase,
  syncSpecialPositionScopes as runScopeSync,
  syncSpecialPositionScopesForCitizen as runScopeSyncForCitizen,
} from '@/modules/sync/services/domain/sync-scope.service.js';
import { assignRoleForSingleUser as assignRoleForSingleUserBase } from '@/modules/sync/services/domain/sync-role.service.js';
import {
  runCoreStages,
  runPostStages,
} from '@/modules/sync/services/pipeline/pipeline.runner.js';
import {
  CORE_PIPELINE_STAGES,
  POST_PIPELINE_STAGES,
} from '@/modules/sync/services/pipeline/pipeline.context.js';
import type {
  PipelineContext,
  SyncPipelineMode,
} from '@/modules/sync/services/pipeline/pipeline.types.js';
import { createSyncPipelineActions } from '@/modules/sync/services/pipeline/pipeline.actions.js';
import {
  VIEW_EMPLOYEE_COLUMNS,
  VIEW_SUPPORT_COLUMNS,
  buildEmployeeViewQuery,
  buildLeaveRecordSql,
  buildLeaveRecordValues,
  buildLeaveViewQuery,
  buildSingleLeaveViewQuery,
  buildQuotasViewQuery,
  buildSignaturesViewQuery,
  buildSupportEmployeeSql,
  buildSupportEmployeeValues,
  buildSupportViewQuery,
  citizenIdJoinBinary,
  citizenIdWhereBinary,
} from '@/modules/sync/repositories/sync-query-builders.repository.js';

const toDateOnly = (value: any): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isActiveStatusCode = (statusCode: string | null): boolean => {
  const normalized = String(statusCode ?? '').trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'STUDY_LEAVE';
};

// Used by scope sync flow where source still provides status text.
const isActiveOriginalStatus = (status: string | null): boolean => {
  if (!status) return false;
  const normalized = status.trim();
  return normalized.startsWith('ปฏิบัติงาน') || normalized.includes('ลาศึกษา');
};

const parsePositiveIntEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const getMonitorRetentionPolicy = () => ({
  dataIssuesDays: parsePositiveIntEnv(process.env.SYNC_RETENTION_DATA_ISSUES_DAYS, 180),
  userAuditsDays: parsePositiveIntEnv(process.env.SYNC_RETENTION_USER_AUDITS_DAYS, 180),
  stageRunsDays: parsePositiveIntEnv(process.env.SYNC_RETENTION_STAGE_RUNS_DAYS, 120),
});

export const deriveUserIsActive = (
  profileStatusCode: string | null,
  supportStatusCode: string | null,
): boolean => {
  if (profileStatusCode && profileStatusCode.trim().length > 0) {
    return isActiveStatusCode(profileStatusCode);
  }
  if (supportStatusCode && supportStatusCode.trim().length > 0) {
    return isActiveStatusCode(supportStatusCode);
  }
  return false;
};

// Detect value change with support for dates and nullish values.
const isChanged = (oldVal: any, newVal: any) => {
  const oldDate = toDateOnly(oldVal);
  const newDate = toDateOnly(newVal);
  if (oldDate || newDate) {
    return oldDate !== newDate;
  }
  if (typeof oldVal === 'number' && typeof newVal === 'string') {
    return oldVal !== Number.parseFloat(newVal);
  }
  return String(oldVal ?? '') !== String(newVal ?? '');
};

const getUserIdMap = async (conn: PoolConnection) => {
  const [existingUsers] = await conn.query<RowDataPacket[]>('SELECT id, citizen_id FROM users');
  return new Map(existingUsers.map((u) => [u.citizen_id, u.id]));
};

const buildSyncReconciliation = async (conn: PoolConnection) => {
  const [supportRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        (SELECT COUNT(*) FROM (${buildSupportViewQuery()}) v) AS support_view_count,
        (SELECT COUNT(*) FROM emp_support_staff) AS support_table_count
    `,
  );
  const [userRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        COUNT(*) AS users_total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS users_active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS users_inactive
      FROM users
    `,
  );
  const [statusRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        (SELECT SUM(CASE WHEN status_code IS NULL OR TRIM(status_code) = '' THEN 1 ELSE 0 END) FROM emp_profiles) AS profile_status_code_null,
        (SELECT SUM(CASE WHEN status_code IS NULL OR TRIM(status_code) = '' THEN 1 ELSE 0 END) FROM emp_support_staff) AS support_status_code_null
    `,
  );
  return {
    support: supportRows[0] ?? {},
    users: userRows[0] ?? {},
    quality: statusRows[0] ?? {},
  };
};

const syncSignatures = async (conn: PoolConnection, stats: SyncStats) => {
  return runDomainSignaturesSync(conn, stats, {
    buildSignaturesViewQuery,
  });
};

const syncLicensesAndQuotas = async (conn: PoolConnection, stats: SyncStats) => {
  return runDomainLicensesAndQuotasSync(conn, stats, {
    buildQuotasViewQuery,
    upsertLeaveQuota,
  });
};

const syncLeaves = async (
  conn: PoolConnection,
  stats: SyncStats,
  batchId?: number,
) => {
  return runDomainLeavesSync(conn, stats, {
    hasLeaveStatusColumn,
    buildLeaveRecordSql,
    buildLeaveRecordValues,
    buildLeaveViewQuery,
    isChanged,
    normalizeLeaveRowWithMeta,
    onLeaveReclassified: async ({ sourceKey, citizenId, remark, meta }) => {
      await TransformMonitorRepository.createDataIssue({
        batchId: batchId ?? null,
        targetTable: 'leave_records',
        sourceKey,
        issueCode: 'LEAVE_TYPE_RECLASSIFIED',
        issueDetail: JSON.stringify({
          citizen_id: citizenId,
          original_type: meta.original_type,
          normalized_type: meta.normalized_type,
          reason_code: meta.reason_code,
          remark,
        }),
        severity: 'MEDIUM',
      });
    },
    onLeaveReviewFlagged: async ({ sourceKey, citizenId, remark, meta }) => {
      await TransformMonitorRepository.createDataIssue({
        batchId: batchId ?? null,
        targetTable: 'leave_records',
        sourceKey,
        issueCode: meta.reason_code,
        issueDetail: JSON.stringify({
          citizen_id: citizenId,
          source_type: meta.source_type,
          suspected_type: meta.suspected_type,
          reason_text: meta.reason_text,
          remark,
        }),
        severity: 'LOW',
      });
    },
    onLeaveNormalizationIssue: async ({ sourceKey, citizenId, meta }) => {
      await TransformMonitorRepository.createDataIssue({
        batchId: batchId ?? null,
        targetTable: 'leave_records',
        sourceKey,
        issueCode: meta.issue_code,
        issueDetail: JSON.stringify({
          citizen_id: citizenId,
          reason_text: meta.reason_text,
          ...meta.detail,
        }),
        severity: meta.issue_code === 'LEAVE_DATE_INVALID' ? 'HIGH' : 'LOW',
      });
    },
  });
};

const syncMovements = async (conn: PoolConnection, _stats: SyncStats) => {
  return runDomainMovementsSync(conn, {
    applyImmediateMovementEligibilityCutoff,
  });
};

const buildScopesFromSpecialPosition = (specialPosition: string | null) => {
  return buildScopesFromSpecialPositionBase(specialPosition);
};

const syncSpecialPositionScopes = async (conn: PoolConnection) => {
  return runScopeSync(conn, {
    citizenIdJoinBinary,
    isActiveOriginalStatus,
    parseScopes: buildScopesFromSpecialPosition,
    disableScopeMappings: requestRepository.disableScopeMappings.bind(requestRepository),
    disableScopeMappingsByCitizenId: requestRepository.disableScopeMappingsByCitizenId.bind(
      requestRepository,
    ),
    insertScopeMappings: requestRepository.insertScopeMappings.bind(requestRepository),
    clearScopeCache,
  });
};

const syncSpecialPositionScopesForCitizen = async (conn: PoolConnection, citizenId: string) => {
  return runScopeSyncForCitizen(conn, citizenId, {
    citizenIdJoinBinary,
    isActiveOriginalStatus,
    parseScopes: buildScopesFromSpecialPosition,
    disableScopeMappings: requestRepository.disableScopeMappings.bind(requestRepository),
    disableScopeMappingsByCitizenId: requestRepository.disableScopeMappingsByCitizenId.bind(
      requestRepository,
    ),
    insertScopeMappings: requestRepository.insertScopeMappings.bind(requestRepository),
    clearScopeCache,
  });
};

const syncSingleSignature = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return runSingleSignatureSync(conn, citizenId, stats, {
    citizenIdWhereBinary,
  });
};

const syncSingleLicenses = async (conn: PoolConnection, citizenId: string): Promise<void> => {
  return runSingleLicensesSync(conn, citizenId);
};

const syncSingleQuotas = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return runSingleQuotasSync(conn, citizenId, stats, {
    upsertLeaveQuota,
  });
};

const syncSingleLeaves = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
  batchId?: number,
): Promise<void> => {
  return runSingleLeavesSync(conn, citizenId, stats, {
    hasLeaveStatusColumn,
    buildLeaveRecordSql,
    buildLeaveRecordValues,
    buildLeaveViewQuery,
    buildSingleLeaveViewQuery,
    citizenIdWhereBinary,
    normalizeLeaveRowWithMeta,
    onLeaveReclassified: async ({ sourceKey, citizenId: leaveCitizenId, remark, meta }) => {
      await TransformMonitorRepository.createDataIssue({
        batchId: batchId ?? null,
        targetTable: 'leave_records',
        sourceKey,
        issueCode: 'LEAVE_TYPE_RECLASSIFIED',
        issueDetail: JSON.stringify({
          citizen_id: leaveCitizenId,
          original_type: meta.original_type,
          normalized_type: meta.normalized_type,
          reason_code: meta.reason_code,
          remark,
        }),
        severity: 'MEDIUM',
      });
    },
    onLeaveReviewFlagged: async ({ sourceKey, citizenId: leaveCitizenId, remark, meta }) => {
      await TransformMonitorRepository.createDataIssue({
        batchId: batchId ?? null,
        targetTable: 'leave_records',
        sourceKey,
        issueCode: meta.reason_code,
        issueDetail: JSON.stringify({
          citizen_id: leaveCitizenId,
          source_type: meta.source_type,
          suspected_type: meta.suspected_type,
          reason_text: meta.reason_text,
          remark,
        }),
        severity: 'LOW',
      });
    },
    onLeaveNormalizationIssue: async ({ sourceKey, citizenId: leaveCitizenId, meta }) => {
      await TransformMonitorRepository.createDataIssue({
        batchId: batchId ?? null,
        targetTable: 'leave_records',
        sourceKey,
        issueCode: meta.issue_code,
        issueDetail: JSON.stringify({
          citizen_id: leaveCitizenId,
          reason_text: meta.reason_text,
          ...meta.detail,
        }),
        severity: meta.issue_code === 'LEAVE_DATE_INVALID' ? 'HIGH' : 'LOW',
      });
    },
  });
};

const syncSingleMovements = async (conn: PoolConnection, citizenId: string): Promise<void> => {
  return runSingleMovementsSync(conn, citizenId, {
    applyImmediateMovementEligibilityCutoff,
  });
};

const assignRoleForSingleUser = async (
  conn: PoolConnection,
  dbUser: RowDataPacket,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return assignRoleForSingleUserBase(conn, dbUser, citizenId, stats, {
    citizenIdWhereBinary,
    roleAssignmentService: {
      PROTECTED_ROLES: IdentityRolePolicyService.PROTECTED_ROLES,
      AUTO_ASSIGNABLE_ROLES: IdentityRolePolicyService.AUTO_ASSIGNABLE_ROLES,
      deriveRole: (hrRow: unknown) => IdentityRolePolicyService.deriveRole(hrRow as any),
    },
    clearScopeCache,
  });
};

type PipelineExecOptions = {
  mode: SyncPipelineMode;
  triggeredBy: number | null;
  citizenId?: string;
};

type SyncExecutionResult = {
  success: true;
  batch_id: number;
  duration: string;
  stats: SyncStats;
  reconciliation: Awaited<ReturnType<typeof buildSyncReconciliation>> | null;
  timestamp: string;
  core_status: SyncCoreStatus;
  post_status: SyncPostStatus;
  overall_status: SyncOverallStatus;
  warnings_count: number;
  warnings?: string[];
  automation: {
    auto_cleared_issues: number;
    auto_resolved_issues: number;
    monitor_retention:
      | Awaited<ReturnType<typeof TransformMonitorRepository.cleanupOldMonitorData>>
      | null;
  };
  stages: Awaited<ReturnType<typeof runPostStages>>['stages'];
};

export class SyncService {
  static async getRoleMappingDiagnostics() {
    const conn = await db.getConnection();
    try {
      return await getRoleMappingDiagnostics(conn);
    } finally {
      conn.release();
    }
  }

  static async getReconciliationSummary() {
    const conn = await db.getConnection();
    try {
      return await buildSyncReconciliation(conn);
    } finally {
      conn.release();
    }
  }

  /**
   * Return cached status (fast path for dashboards).
   */
  static async getLastSyncStatus(): Promise<SyncRuntimeStatus> {
    return getSyncStatusFromCache();
  }

  private static async executeWithSyncLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockValue = createSyncLockValue();
    const locked = await acquireSyncLock(lockValue);
    if (!locked) {
      console.warn('[SyncService] Synchronization aborted: already in progress.');
      throw new Error('Synchronization is already in progress. Please wait.');
    }

    const lockHeartbeat = startSyncLockHeartbeat(lockValue);
    try {
      return await operation();
    } finally {
      clearInterval(lockHeartbeat);
      await releaseSyncLock(lockValue);
    }
  }

  private static async finalizeCommittedSync(input: {
    pipelineContext: PipelineContext;
    batchId: number;
    startTotal: number;
    coreStages: Awaited<ReturnType<typeof runCoreStages>>;
  }): Promise<SyncExecutionResult> {
    const { pipelineContext, batchId, startTotal, coreStages } = input;
    const { conn, stats, mode } = pipelineContext;
    const summary = await runPostStages({
      context: pipelineContext,
      postStages: POST_PIPELINE_STAGES,
      previousStages: coreStages,
    });

    const warnings: string[] = [];
    let autoClearedIssues = 0;
    let monitorRetention: Awaited<
      ReturnType<typeof TransformMonitorRepository.cleanupOldMonitorData>
    > | null = null;
    let reconciliation: Awaited<ReturnType<typeof buildSyncReconciliation>> | null = null;

    if (mode === 'FULL') {
      try {
        autoClearedIssues = await TransformMonitorRepository.deleteStaleIssuesForBatch({
          batchId,
          issueCode: 'LEAVE_TYPE_RECLASSIFIED',
          targetTable: 'leave_records',
        });
        autoClearedIssues += await TransformMonitorRepository.deleteStaleIssuesForBatch({
          batchId,
          issueCode: 'SICK_LEAVE_FAMILY_CARE_REVIEW',
          targetTable: 'leave_records',
        });
        autoClearedIssues += await TransformMonitorRepository.deleteStaleIssuesForBatch({
          batchId,
          issueCode: 'LEAVE_DATE_INVALID',
          targetTable: 'leave_records',
        });
        autoClearedIssues += await TransformMonitorRepository.deleteStaleIssuesForBatch({
          batchId,
          issueCode: 'LEAVE_DATE_NORMALIZED',
          targetTable: 'leave_records',
        });
      } catch (error) {
        warnings.push(
          `deleteStaleIssuesForBatch failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        monitorRetention = await TransformMonitorRepository.cleanupOldMonitorData(
          getMonitorRetentionPolicy(),
        );
      } catch (error) {
        warnings.push(
          `cleanupOldMonitorData failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    try {
      reconciliation = await buildSyncReconciliation(conn);
    } catch (error) {
      warnings.push(
        `buildSyncReconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const durationMs = Date.now() - startTotal;
    let warningsCount = summary.warnings_count + warnings.length;
    let overallStatus = summary.overall_status;
    if (warnings.length > 0 && overallStatus === 'SUCCESS') {
      overallStatus = 'SUCCESS_WITH_WARNINGS';
    }

    const resultData: SyncExecutionResult = {
      success: true,
      batch_id: batchId,
      duration: (durationMs / 1000).toFixed(2),
      stats,
      reconciliation,
      timestamp: new Date().toISOString(),
      core_status: summary.core_status,
      post_status: summary.post_status,
      overall_status: overallStatus,
      warnings_count: warningsCount,
      ...(warnings.length > 0 ? { warnings } : {}),
      automation: {
        auto_cleared_issues: autoClearedIssues,
        auto_resolved_issues: autoClearedIssues,
        monitor_retention: monitorRetention,
      },
      stages: summary.stages,
    };

    try {
      await setLastSyncResult(resultData);
    } catch (error) {
      warnings.push(`setLastSyncResult failed: ${error instanceof Error ? error.message : String(error)}`);
      warningsCount = summary.warnings_count + warnings.length;
      overallStatus = 'SUCCESS_WITH_WARNINGS';
      resultData.overall_status = overallStatus;
      resultData.warnings_count = warningsCount;
      resultData.warnings = warnings;
    }

    await TransformMonitorRepository.finishSyncBatchSuccess(batchId, stats, durationMs, {
      status: 'SUCCESS',
      coreStatus: resultData.core_status,
      postStatus: resultData.post_status,
      overallStatus: resultData.overall_status,
      warningsCount: resultData.warnings_count,
    });

    return resultData;
  }

  /**
   * Execute one pipeline run for FULL or USER mode.
   */
  private static async executePipelineSync(
    options: PipelineExecOptions,
  ): Promise<SyncExecutionResult> {
    const startTotal = Date.now();
    const stats = createSyncStats();
    const conn = await db.getConnection();
    const batchId = await TransformMonitorRepository.createSyncBatch({
      syncType: options.mode,
      triggeredBy: options.triggeredBy,
      targetCitizenId: options.citizenId ?? null,
    });
    let committed = false;

    try {
      await conn.beginTransaction();
      const dbUser =
        options.mode === 'USER' && options.citizenId
          ? (
              await conn.query<RowDataPacket[]>(
                'SELECT id, citizen_id, role FROM users WHERE citizen_id = ? LIMIT 1',
                [options.citizenId],
              )
            )[0][0]
          : undefined;

      const pipelineActions = createSyncPipelineActions(
        options.mode,
        {
          getUserIdMap,
          syncEmployees: (cx, stageStats, userIdMap, deps) =>
            syncEmployees(cx, stageStats, userIdMap, deps as Parameters<typeof syncEmployees>[3]),
          syncSupportEmployees: (cx, stageStats, userIdMap, deps) =>
            syncSupportEmployees(
              cx,
              stageStats,
              userIdMap,
              deps as Parameters<typeof syncSupportEmployees>[3],
            ),
          upsertSingleEmployeeProfile: (cx, citizenId, userIdMap, stageStats, deps) =>
            upsertSingleEmployeeProfile(
              cx,
              citizenId,
              userIdMap,
              stageStats,
              deps as Parameters<typeof upsertSingleEmployeeProfile>[4],
            ),
          upsertSingleSupportEmployee: (cx, citizenId, stageStats, deps) =>
            upsertSingleSupportEmployee(
              cx,
              citizenId,
              stageStats,
              deps as Parameters<typeof upsertSingleSupportEmployee>[3],
            ),
          syncUsersFromProfilesAndSupport,
          syncSingleSignature,
          syncSignatures,
          syncSingleLicenses,
          syncSingleQuotas,
          syncLicensesAndQuotas,
          syncSingleLeaves,
          syncLeaves,
          syncSingleMovements,
          syncMovements,
          syncSpecialPositionScopesForCitizen,
          syncSpecialPositionScopes,
          assignRoleForSingleUser,
          assignRoles,
          refreshReviewCycleFromSync,
          deriveUserIsActive,
          protectedRoles: IdentityRolePolicyService.PROTECTED_ROLES,
          VIEW_EMPLOYEE_COLUMNS,
          buildEmployeeViewQuery,
          citizenIdWhereBinary,
          isChanged,
          upsertEmployeeProfile,
          persistEmployeeProfileSyncArtifacts,
          clearScopeCache,
          VIEW_SUPPORT_COLUMNS,
          buildSupportViewQuery,
          resolveSupportStaffColumnFlags,
          hasSupportProfileFingerprintColumn,
          buildSupportEmployeeSql,
          buildSupportEmployeeValues,
          persistSupportProfileSyncArtifacts,
        },
        {
          userId: dbUser?.id ? Number(dbUser.id) : undefined,
          dbUser,
        },
      );

      const pipelineContext: PipelineContext = {
        mode: options.mode,
        batchId,
        triggeredBy: options.triggeredBy,
        citizenId: options.citizenId,
        conn,
        stats,
        actions: pipelineActions,
      };

      const coreStages = await runCoreStages({
        context: pipelineContext,
        coreStages: CORE_PIPELINE_STAGES,
      });
      await conn.commit();
      committed = true;
      return await this.finalizeCommittedSync({
        batchId,
        startTotal,
        pipelineContext,
        coreStages,
      });
    } catch (error) {
      if (!committed) {
        await conn.rollback();
        await TransformMonitorRepository.finishSyncBatchFailed(
          batchId,
          error instanceof Error ? error.message : String(error),
          Date.now() - startTotal,
          { coreStatus: 'FAILED', postStatus: 'PENDING', overallStatus: 'FAILED' },
        );
        throw error;
      }

      console.error(
        '[SyncService] Post-commit sync finalization failed:',
        error instanceof Error ? error.message : error,
      );

      const durationMs = Date.now() - startTotal;
      const fallbackResult: SyncExecutionResult = {
        success: true,
        batch_id: batchId,
        duration: (durationMs / 1000).toFixed(2),
        stats,
        reconciliation: null,
        timestamp: new Date().toISOString(),
        core_status: 'SUCCESS',
        post_status: 'FAILED',
        overall_status: 'SUCCESS_WITH_WARNINGS',
        warnings_count: 1,
        warnings: [
          `post_commit_finalization_failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
        automation: {
          auto_cleared_issues: 0,
          auto_resolved_issues: 0,
          monitor_retention: null,
        },
        stages: [],
      };

      try {
        await TransformMonitorRepository.finishSyncBatchSuccess(batchId, stats, durationMs, {
          status: 'SUCCESS',
          coreStatus: fallbackResult.core_status,
          postStatus: fallbackResult.post_status,
          overallStatus: fallbackResult.overall_status,
          warningsCount: fallbackResult.warnings_count,
        });
      } catch (finishError) {
        console.error(
          '[SyncService] Failed to persist fallback sync status:',
          finishError instanceof Error ? finishError.message : finishError,
        );
      }

      return fallbackResult;
    } finally {
      conn.release();
    }
  }

  /**
   * Run the full smart sync workflow with distributed lock + status caching.
   */
  static async performFullSync(options?: { triggeredBy?: number | null }) {
    console.log('[SyncService] Requesting synchronization...');
    return this.executeWithSyncLock(async () =>
      this.executePipelineSync({
        mode: 'FULL',
        triggeredBy: options?.triggeredBy ?? null,
      }),
    );
  }

  static async performScheduledFullSync(options?: {
    triggeredBy?: number | null;
    at?: Date;
  }): Promise<SyncExecutionResult | null> {
    const dueWindow = await getDueAutoSyncWindow(options?.at);
    if (!dueWindow) return null;

    return this.executeWithSyncLock(async () => {
      const claimed = await claimAutoSyncWindow(dueWindow);
      if (!claimed) return null;
      return this.executePipelineSync({
        mode: 'FULL',
        triggeredBy: options?.triggeredBy ?? null,
      });
    });
  }

  /**
   * Sync a single user by userId (granular sync).
   */
  static async performUserSync(userId: number, options?: { triggeredBy?: number | null }) {
    const conn = await db.getConnection();
    try {
      const [userRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, citizen_id, role FROM users WHERE id = ? LIMIT 1',
        [userId],
      );
      const dbUser = userRows[0];
      if (!dbUser?.citizen_id) {
        throw new Error('User not found for sync');
      }
      const citizenId = String(dbUser.citizen_id);
      const result = await this.executeWithSyncLock(async () =>
        this.executePipelineSync({
          mode: 'USER',
          triggeredBy: options?.triggeredBy ?? null,
          citizenId,
        }),
      );
      return {
        ...result,
        citizenId,
      };
    } finally {
      conn.release();
    }
  }

  static async refreshAccessReviewOnly(options?: {
    triggeredBy?: number | null;
    citizenId?: string | null;
  }): Promise<{
    refreshed_at: string;
    sync_timestamp: string | null;
    access_review: { cycleId: number; createdCycle: boolean; insertedItems: number };
  }> {
    const runtimeStatus = await getSyncRuntimeStatus();
    const lastResult = runtimeStatus.lastResult as { timestamp?: string } | null;
    const syncTimestamp =
      lastResult?.timestamp && !Number.isNaN(Date.parse(lastResult.timestamp))
        ? new Date(lastResult.timestamp)
        : new Date();

    const accessReview = await refreshReviewCycleFromSync({
      actorId: options?.triggeredBy ?? null,
      syncTimestamp,
      citizenId: options?.citizenId ?? null,
    });

    return {
      refreshed_at: new Date().toISOString(),
      sync_timestamp: syncTimestamp.toISOString(),
      access_review: accessReview,
    };
  }
}
