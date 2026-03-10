import {
  buildSyncExecutionConnection,
  buildSyncExecutionStats,
} from './sync-service.execution-policy.test-helpers.js';

const mockGetConnection = jest.fn();
const mockAcquireSyncLock = jest.fn();
const mockCreateSyncLockValue = jest.fn(() => 'lock:test');
const mockStartSyncLockHeartbeat = jest.fn(() => ({}) as NodeJS.Timeout);
const mockReleaseSyncLock = jest.fn();
const mockSetLastSyncResult = jest.fn();
const mockGetDueAutoSyncWindow = jest.fn();
const mockClaimAutoSyncWindow = jest.fn();
const mockCreateSyncBatch = jest.fn();
const mockFinishSyncBatchSuccess = jest.fn();
const mockFinishSyncBatchFailed = jest.fn();
const mockDeleteStaleIssuesForBatch = jest.fn();
const mockCleanupOldMonitorData = jest.fn();
const mockRunCoreStages = jest.fn();
const mockRunPostStages = jest.fn();
const mockCreateSyncPipelineActions = jest.fn(() => ({}));
const mockCreateSyncStats = jest.fn();

jest.mock('@config/database.js', () => ({
  __esModule: true,
  default: {
    getConnection: mockGetConnection,
  },
}));

jest.mock('@/modules/identity/services/identity-role-policy.service.js', () => ({
  __esModule: true,
  assignRoles: jest.fn(async () => ({ updated: 0, skipped: 0, missing: 0 })),
  IdentityRolePolicyService: {
    PROTECTED_ROLES: new Set(['ADMIN']),
    AUTO_ASSIGNABLE_ROLES: new Set(['HEAD_SCOPE']),
    deriveRole: jest.fn(() => 'USER'),
  },
}));

jest.mock('@/modules/sync/repositories/transform-monitor.repository.js', () => ({
  __esModule: true,
  TransformMonitorRepository: {
    createSyncBatch: mockCreateSyncBatch,
    finishSyncBatchSuccess: mockFinishSyncBatchSuccess,
    finishSyncBatchFailed: mockFinishSyncBatchFailed,
    deleteStaleIssuesForBatch: mockDeleteStaleIssuesForBatch,
    cleanupOldMonitorData: mockCleanupOldMonitorData,
    startStageRun: jest.fn(),
    finishStageRun: jest.fn(),
    updateBatchPipelineStatus: jest.fn(),
    createDataIssue: jest.fn(),
  },
}));

jest.mock('@/modules/sync/repositories/role-mapping.repository.js', () => ({
  __esModule: true,
  getRoleMappingDiagnostics: jest.fn(),
}));

jest.mock('@/modules/access-review/services/access-review.service.js', () => ({
  __esModule: true,
  refreshReviewCycleFromSync: jest.fn(async () => ({
    cycleId: 99,
    createdCycle: false,
    insertedItems: 0,
  })),
}));

jest.mock('@/modules/sync/services/sync-status.service.js', () => ({
  __esModule: true,
  getSyncRuntimeStatus: jest.fn(async () => ({ isSyncing: false, lastResult: null })),
}));

jest.mock('@/modules/request/scope/application/scope.service.js', () => ({
  __esModule: true,
  clearScopeCache: jest.fn(),
}));

jest.mock('@/modules/request/data/repositories/request.repository.js', () => ({
  __esModule: true,
  requestRepository: {
    disableScopeMappings: jest.fn(),
    disableScopeMappingsByCitizenId: jest.fn(),
    insertScopeMappings: jest.fn(),
  },
}));

jest.mock('@/modules/workforce-compliance/services/immediate-rules.service.js', () => ({
  __esModule: true,
  applyImmediateMovementEligibilityCutoff: jest.fn(),
}));

jest.mock('@/modules/sync/services/shared/sync-stats.service.js', () => ({
  __esModule: true,
  createSyncStats: mockCreateSyncStats,
}));

jest.mock('@/modules/sync/services/shared/sync-lock.service.js', () => ({
  __esModule: true,
  acquireSyncLock: mockAcquireSyncLock,
  createSyncLockValue: mockCreateSyncLockValue,
  getLastSyncStatus: jest.fn(async () => ({ isSyncing: false, lastResult: null })),
  releaseSyncLock: mockReleaseSyncLock,
  setLastSyncResult: mockSetLastSyncResult,
  startSyncLockHeartbeat: mockStartSyncLockHeartbeat,
}));

jest.mock('@/modules/sync/services/sync-auto-schedule.service.js', () => ({
  __esModule: true,
  getDueAutoSyncWindow: mockGetDueAutoSyncWindow,
  claimAutoSyncWindow: mockClaimAutoSyncWindow,
}));

jest.mock('@/modules/sync/services/shared/sync-db-helpers.service.js', () => ({
  __esModule: true,
  hasLeaveStatusColumn: jest.fn(),
  hasSupportProfileFingerprintColumn: jest.fn(),
  persistEmployeeProfileSyncArtifacts: jest.fn(),
  persistSupportProfileSyncArtifacts: jest.fn(),
  resolveSupportStaffColumnFlags: jest.fn(async () => ({ hasLevelColumn: true })),
  upsertEmployeeProfile: jest.fn(),
  upsertLeaveQuota: jest.fn(),
}));

jest.mock('@/modules/sync/services/domain/sync-users.service.js', () => ({
  __esModule: true,
  syncUsersFromProfilesAndSupport: jest.fn(),
}));

jest.mock('@/modules/sync/services/domain/sync-hr.service.js', () => ({
  __esModule: true,
  syncEmployees: jest.fn(),
  syncSupportEmployees: jest.fn(),
  upsertSingleEmployeeProfile: jest.fn(),
  upsertSingleSupportEmployee: jest.fn(),
}));

jest.mock('@/modules/sync/services/domain/sync-domain.service.js', () => ({
  __esModule: true,
  syncSignatures: jest.fn(),
  syncLicensesAndQuotas: jest.fn(),
  syncLeaves: jest.fn(),
  syncMovements: jest.fn(),
  syncSingleSignature: jest.fn(),
  syncSingleLicenses: jest.fn(),
  syncSingleQuotas: jest.fn(),
  syncSingleLeaves: jest.fn(),
  syncSingleMovements: jest.fn(),
}));

jest.mock('@/modules/sync/services/domain/leave-normalizer.service.js', () => ({
  __esModule: true,
  normalizeLeaveRowWithMeta: jest.fn(),
}));

jest.mock('@/modules/sync/services/domain/sync-scope.service.js', () => ({
  __esModule: true,
  buildScopesFromSpecialPosition: jest.fn(),
  syncSpecialPositionScopes: jest.fn(),
  syncSpecialPositionScopesForCitizen: jest.fn(),
}));

jest.mock('@/modules/sync/services/domain/sync-role.service.js', () => ({
  __esModule: true,
  assignRoleForSingleUser: jest.fn(),
}));

jest.mock('@/modules/sync/services/pipeline/pipeline.runner.js', () => ({
  __esModule: true,
  runCoreStages: mockRunCoreStages,
  runPostStages: mockRunPostStages,
}));

jest.mock('@/modules/sync/services/pipeline/pipeline.context.js', () => ({
  __esModule: true,
  CORE_PIPELINE_STAGES: [],
  POST_PIPELINE_STAGES: [],
}));

jest.mock('@/modules/sync/services/pipeline/pipeline.actions.js', () => ({
  __esModule: true,
  createSyncPipelineActions: mockCreateSyncPipelineActions,
}));

jest.mock('@/modules/sync/repositories/sync-query-builders.repository.js', () => ({
  __esModule: true,
  VIEW_EMPLOYEE_COLUMNS: ['citizen_id'],
  VIEW_SUPPORT_COLUMNS: ['citizen_id'],
  buildEmployeeViewQuery: jest.fn(() => 'SELECT 1'),
  buildLeaveRecordSql: jest.fn(),
  buildLeaveRecordValues: jest.fn(),
  buildLeaveViewQuery: jest.fn(() => 'SELECT 1'),
  buildSingleLeaveViewQuery: jest.fn(() => 'SELECT 1'),
  buildQuotasViewQuery: jest.fn(() => 'SELECT 1'),
  buildSignaturesViewQuery: jest.fn(() => 'SELECT 1'),
  buildSupportEmployeeSql: jest.fn(() => ({ sql: 'SELECT 1', fields: [] })),
  buildSupportEmployeeValues: jest.fn(() => []),
  buildSupportViewQuery: jest.fn(() => 'SELECT 1'),
  citizenIdJoinBinary: jest.fn(() => '1 = 1'),
  citizenIdWhereBinary: jest.fn(() => '1 = 1'),
}));

const loadModule = async () => import('../../services/sync.service.js');

describe('SyncService execution policy', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockCreateSyncStats.mockReturnValue(buildSyncExecutionStats());
    mockCreateSyncBatch.mockResolvedValue(5001);
    mockFinishSyncBatchSuccess.mockResolvedValue(undefined);
    mockFinishSyncBatchFailed.mockResolvedValue(undefined);
    mockDeleteStaleIssuesForBatch.mockResolvedValue(0);
    mockCleanupOldMonitorData.mockResolvedValue({
      data_issues_deleted: 0,
      user_audits_deleted: 0,
      stage_runs_deleted: 0,
    });
    mockRunCoreStages.mockResolvedValue([
      {
        batch_id: 5001,
        stage_key: 'sync-users',
        stage_group: 'CORE',
        status: 'SUCCESS',
      },
    ]);
    mockRunPostStages.mockResolvedValue({
      core_status: 'SUCCESS',
      post_status: 'SUCCESS',
      overall_status: 'SUCCESS',
      warnings_count: 0,
      stages: [],
    });
    mockSetLastSyncResult.mockResolvedValue(undefined);
    mockAcquireSyncLock.mockResolvedValue(true);
    mockReleaseSyncLock.mockResolvedValue(undefined);
    mockGetDueAutoSyncWindow.mockResolvedValue({
      runKey: 'system:sync:auto-last-run:daily:2026-03-01',
      ttlSeconds: 172800,
    });
    mockClaimAutoSyncWindow.mockResolvedValue(true);
    mockGetConnection.mockImplementation(async () => buildSyncExecutionConnection());
  });

  test('performUserSync aborts when another sync already holds the lock', async () => {
    const mod = await loadModule();
    const executeSpy = jest
      .spyOn(mod.SyncService as any, 'executePipelineSync')
      .mockResolvedValue({ success: true });

    mockAcquireSyncLock.mockResolvedValue(false);

    await expect(mod.SyncService.performUserSync(42, { triggeredBy: 7 })).rejects.toThrow(
      'Synchronization is already in progress. Please wait.',
    );

    expect(mockAcquireSyncLock).toHaveBeenCalledWith('lock:test');
    expect(executeSpy).not.toHaveBeenCalled();
    expect(mockStartSyncLockHeartbeat).not.toHaveBeenCalled();
    expect(mockReleaseSyncLock).not.toHaveBeenCalled();
  });

  test('performScheduledFullSync does not claim a schedule slot before lock acquisition succeeds', async () => {
    const mod = await loadModule();
    const executeSpy = jest
      .spyOn(mod.SyncService as any, 'executePipelineSync')
      .mockResolvedValue({ success: true });

    mockAcquireSyncLock.mockResolvedValue(false);

    await expect(
      (mod.SyncService as any).performScheduledFullSync({
        triggeredBy: null,
        at: new Date('2026-03-01T03:10:00+07:00'),
      }),
    ).rejects.toThrow('Synchronization is already in progress. Please wait.');

    expect(mockGetDueAutoSyncWindow).toHaveBeenCalled();
    expect(mockClaimAutoSyncWindow).not.toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
    expect(mockGetConnection).not.toHaveBeenCalled();
  });

  test('executePipelineSync keeps a committed batch successful when cache write fails after commit', async () => {
    const mod = await loadModule();
    const executePipelineSync = (mod.SyncService as any).executePipelineSync.bind(mod.SyncService);

    mockSetLastSyncResult.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      executePipelineSync({
        mode: 'FULL',
        triggeredBy: 9,
      }),
    ).resolves.toMatchObject({
      success: true,
      overall_status: 'SUCCESS_WITH_WARNINGS',
      warnings_count: 1,
    });

    expect(mockFinishSyncBatchSuccess).toHaveBeenCalled();
    expect(mockFinishSyncBatchFailed).not.toHaveBeenCalled();
  });

  test('pipeline actions do not receive legacy normalizeLeaveRow dependency', async () => {
    const mod = await loadModule();
    const domainMod = await import('@/modules/sync/services/domain/sync-domain.service.js');

    await mod.SyncService.performFullSync({ triggeredBy: 9 });

    expect(mockCreateSyncPipelineActions).toHaveBeenCalled();
    const pipelineDeps = mockCreateSyncPipelineActions.mock.calls[0]?.[1];
    expect(pipelineDeps).toBeDefined();
    expect(typeof pipelineDeps.syncLeaves).toBe('function');

    await pipelineDeps.syncLeaves({} as any, buildSyncExecutionStats(), 5001);

    const leaveSyncDeps = (domainMod.syncLeaves as jest.Mock).mock.calls[0]?.[2];
    expect(leaveSyncDeps).toBeDefined();
    expect('normalizeLeaveRow' in leaveSyncDeps).toBe(false);
    expect(leaveSyncDeps.normalizeLeaveRowWithMeta).toBeDefined();
  });
});
