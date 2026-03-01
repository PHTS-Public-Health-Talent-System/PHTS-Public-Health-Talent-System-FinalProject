import type { RowDataPacket } from 'mysql2/promise';
import type {
  PipelineContext,
  SyncPipelineActions,
  SyncPipelineMode,
} from '@/modules/sync/services/pipeline/pipeline.types.js';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';

type PipelineUserContext = {
  userId?: number;
  dbUser?: RowDataPacket;
};

type PipelineActionDeps = {
  getUserIdMap: (conn: PipelineContext['conn']) => Promise<Map<string, number>>;
  syncEmployees: (
    conn: PipelineContext['conn'],
    stats: SyncStats,
    userIdMap: Map<string, number>,
    deps: unknown,
  ) => Promise<void>;
  syncSupportEmployees: (
    conn: PipelineContext['conn'],
    stats: SyncStats,
    userIdMap: Map<string, number>,
    deps: unknown,
  ) => Promise<void>;
  upsertSingleEmployeeProfile: (
    conn: PipelineContext['conn'],
    citizenId: string,
    userIdMap: Map<string, number>,
    stats: SyncStats,
    deps: unknown,
  ) => Promise<void>;
  upsertSingleSupportEmployee: (
    conn: PipelineContext['conn'],
    citizenId: string,
    stats: SyncStats,
    deps: unknown,
  ) => Promise<void>;
  syncUsersFromProfilesAndSupport: (
    conn: PipelineContext['conn'],
    stats: SyncStats,
    deps: {
      deriveUserIsActive: (profileStatusCode: string | null, supportStatusCode: string | null) => boolean;
      protectedRoles: Set<string>;
      syncBatchId?: number | null;
    },
    options?: { citizenId?: string },
  ) => Promise<void>;
  syncSingleSignature: (conn: PipelineContext['conn'], citizenId: string, stats: SyncStats) => Promise<void>;
  syncSignatures: (conn: PipelineContext['conn'], stats: SyncStats) => Promise<void>;
  syncSingleLicenses: (conn: PipelineContext['conn'], citizenId: string) => Promise<void>;
  syncSingleQuotas: (conn: PipelineContext['conn'], citizenId: string, stats: SyncStats) => Promise<void>;
  syncLicensesAndQuotas: (conn: PipelineContext['conn'], stats: SyncStats) => Promise<void>;
  syncSingleLeaves: (
    conn: PipelineContext['conn'],
    citizenId: string,
    stats: SyncStats,
    batchId?: number,
  ) => Promise<void>;
  syncLeaves: (
    conn: PipelineContext['conn'],
    stats: SyncStats,
    batchId?: number,
  ) => Promise<void>;
  syncSingleMovements: (conn: PipelineContext['conn'], citizenId: string) => Promise<void>;
  syncMovements: (conn: PipelineContext['conn'], stats: SyncStats) => Promise<void>;
  syncSpecialPositionScopesForCitizen: (conn: PipelineContext['conn'], citizenId: string) => Promise<void>;
  syncSpecialPositionScopes: (conn: PipelineContext['conn']) => Promise<void>;
  assignRoleForSingleUser: (
    conn: PipelineContext['conn'],
    dbUser: RowDataPacket,
    citizenId: string,
    stats: SyncStats,
  ) => Promise<void>;
  assignRoles: () => Promise<{ updated: number; skipped: number; missing: number }>;
  refreshReviewCycleFromSync: (options: {
    actorId?: number | null;
    syncTimestamp?: Date | null;
    citizenId?: string | null;
    batchId?: number | null;
  }) => Promise<{ cycleId: number; createdCycle: boolean; insertedItems: number }>;
  deriveUserIsActive: (profileStatusCode: string | null, supportStatusCode: string | null) => boolean;
  protectedRoles: Set<string>;
  VIEW_EMPLOYEE_COLUMNS: readonly string[];
  buildEmployeeViewQuery: () => string;
  citizenIdWhereBinary: (alias: string, placeholder: string) => string;
  isChanged: (oldVal: unknown, newVal: unknown) => boolean;
  upsertEmployeeProfile: unknown;
  persistEmployeeProfileSyncArtifacts: (
    conn: PipelineContext['conn'],
    row: RowDataPacket,
    batchId: number,
  ) => Promise<void>;
  clearScopeCache: (userId?: number) => void;
  VIEW_SUPPORT_COLUMNS: readonly string[];
  buildSupportViewQuery: () => string;
  resolveSupportStaffColumnFlags: (conn: PipelineContext['conn']) => Promise<{ hasLevelColumn: boolean }>;
  hasSupportProfileFingerprintColumn: (conn: PipelineContext['conn']) => Promise<boolean>;
  buildSupportEmployeeSql: unknown;
  buildSupportEmployeeValues: unknown;
  persistSupportProfileSyncArtifacts: (
    conn: PipelineContext['conn'],
    row: RowDataPacket,
    batchId: number,
  ) => Promise<void>;
};

export const createSyncPipelineActions = (
  mode: SyncPipelineMode,
  deps: PipelineActionDeps,
  userContext: PipelineUserContext = {},
): SyncPipelineActions => ({
  syncEmployeeProfiles: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId) return { skipped: true };
      const userId = userContext.userId ?? Number(userContext.dbUser?.id ?? 0);
      const userIdMap = new Map<string, number>([[ctx.citizenId, userId]]);
      await deps.upsertSingleEmployeeProfile(ctx.conn, ctx.citizenId, userIdMap, ctx.stats, {
        viewEmployeeColumns: deps.VIEW_EMPLOYEE_COLUMNS,
        buildEmployeeViewQuery: deps.buildEmployeeViewQuery,
        citizenIdWhereBinary: deps.citizenIdWhereBinary,
        isChanged: deps.isChanged,
        upsertEmployeeProfile: deps.upsertEmployeeProfile,
        persistEmployeeProfileSyncArtifacts: (cx: PipelineContext['conn'], vEmp: RowDataPacket) =>
          deps.persistEmployeeProfileSyncArtifacts(cx, vEmp, ctx.batchId),
        clearScopeCache: deps.clearScopeCache,
      });
      return undefined;
    }

    const userIdMap = await deps.getUserIdMap(ctx.conn);
    await deps.syncEmployees(ctx.conn, ctx.stats, userIdMap, {
      viewEmployeeColumns: deps.VIEW_EMPLOYEE_COLUMNS,
      buildEmployeeViewQuery: deps.buildEmployeeViewQuery,
      isChanged: deps.isChanged,
      upsertEmployeeProfile: deps.upsertEmployeeProfile,
      persistEmployeeProfileSyncArtifacts: (cx: PipelineContext['conn'], vEmp: RowDataPacket) =>
        deps.persistEmployeeProfileSyncArtifacts(cx, vEmp, ctx.batchId),
      clearScopeCache: deps.clearScopeCache,
    });
    return undefined;
  },
  syncSupportStaff: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId) return { skipped: true };
      await deps.upsertSingleSupportEmployee(ctx.conn, ctx.citizenId, ctx.stats, {
        viewSupportColumns: deps.VIEW_SUPPORT_COLUMNS,
        buildSupportViewQuery: deps.buildSupportViewQuery,
        citizenIdWhereBinary: deps.citizenIdWhereBinary,
        hasSupportLevelColumn: async (cx: PipelineContext['conn']) =>
          (await deps.resolveSupportStaffColumnFlags(cx)).hasLevelColumn,
        hasSupportProfileFingerprintColumn: deps.hasSupportProfileFingerprintColumn,
        resolveSupportStaffColumnFlags: deps.resolveSupportStaffColumnFlags,
        buildSupportEmployeeSql: deps.buildSupportEmployeeSql,
        buildSupportEmployeeValues: deps.buildSupportEmployeeValues,
        isChanged: deps.isChanged,
        persistSupportProfileSyncArtifacts: (cx: PipelineContext['conn'], vSup: RowDataPacket) =>
          deps.persistSupportProfileSyncArtifacts(cx, vSup, ctx.batchId),
      });
      return undefined;
    }

    const userIdMap = await deps.getUserIdMap(ctx.conn);
    await deps.syncSupportEmployees(ctx.conn, ctx.stats, userIdMap, {
      viewSupportColumns: deps.VIEW_SUPPORT_COLUMNS,
      buildSupportViewQuery: deps.buildSupportViewQuery,
      isChanged: deps.isChanged,
      hasSupportLevelColumn: async (cx: PipelineContext['conn']) =>
        (await deps.resolveSupportStaffColumnFlags(cx)).hasLevelColumn,
      hasSupportProfileFingerprintColumn: deps.hasSupportProfileFingerprintColumn,
      resolveSupportStaffColumnFlags: deps.resolveSupportStaffColumnFlags,
      buildSupportEmployeeSql: deps.buildSupportEmployeeSql,
      buildSupportEmployeeValues: deps.buildSupportEmployeeValues,
      persistSupportProfileSyncArtifacts: (cx: PipelineContext['conn'], vSup: RowDataPacket) =>
        deps.persistSupportProfileSyncArtifacts(cx, vSup, ctx.batchId),
      clearScopeCache: deps.clearScopeCache,
    });
    return undefined;
  },
  syncUsers: async (ctx: PipelineContext) => {
    await deps.syncUsersFromProfilesAndSupport(
      ctx.conn,
      ctx.stats,
      {
        deriveUserIsActive: deps.deriveUserIsActive,
        protectedRoles: deps.protectedRoles,
        syncBatchId: ctx.batchId,
      },
      mode === 'USER' && ctx.citizenId ? { citizenId: ctx.citizenId } : undefined,
    );
  },
  syncSignatures: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId) return { skipped: true };
      await deps.syncSingleSignature(ctx.conn, ctx.citizenId, ctx.stats);
      return undefined;
    }
    await deps.syncSignatures(ctx.conn, ctx.stats);
    return undefined;
  },
  syncLicensesQuotas: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId) return { skipped: true };
      await deps.syncSingleLicenses(ctx.conn, ctx.citizenId);
      await deps.syncSingleQuotas(ctx.conn, ctx.citizenId, ctx.stats);
      return undefined;
    }
    await deps.syncLicensesAndQuotas(ctx.conn, ctx.stats);
    return undefined;
  },
  syncLeaves: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId) return { skipped: true };
      await deps.syncSingleLeaves(ctx.conn, ctx.citizenId, ctx.stats, ctx.batchId);
      return undefined;
    }
    await deps.syncLeaves(ctx.conn, ctx.stats, ctx.batchId);
    return undefined;
  },
  syncMovements: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId) return { skipped: true };
      await deps.syncSingleMovements(ctx.conn, ctx.citizenId);
      return undefined;
    }
    await deps.syncMovements(ctx.conn, ctx.stats);
    return undefined;
  },
  syncSpecialPositionScopes: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId) return { skipped: true };
      await deps.syncSpecialPositionScopesForCitizen(ctx.conn, ctx.citizenId);
      return undefined;
    }
    await deps.syncSpecialPositionScopes(ctx.conn);
    return undefined;
  },
  assignRoles: async (ctx: PipelineContext) => {
    if (mode === 'USER') {
      if (!ctx.citizenId || !userContext.dbUser) return { skipped: true };
      await deps.assignRoleForSingleUser(ctx.conn, userContext.dbUser, ctx.citizenId, ctx.stats);
      return undefined;
    }
    const roleResult = await deps.assignRoles();
    ctx.stats.roles = roleResult;
    return {
      payload: {
        updated: roleResult.updated,
        skipped: roleResult.skipped,
      },
    };
  },
  refreshAccessReview: async (ctx: PipelineContext) => {
    const accessReview = await deps.refreshReviewCycleFromSync({
      actorId: ctx.triggeredBy ?? null,
      syncTimestamp: new Date(),
      citizenId: mode === 'USER' ? ctx.citizenId ?? null : null,
      batchId: ctx.batchId ?? null,
    });
    return {
      payload: {
        access_review: accessReview,
      },
    };
  },
});
