const mockRedisGet = jest.fn();
const mockRedisLlen = jest.fn();
const mockDbQuery = jest.fn();
const mockGetOcrWorkerEnabled = jest.fn();
const mockGetSyncRuntimeStatus = jest.fn();
const mockCountNotificationOutboxByStatus = jest.fn();
const mockFindLatestNotificationOutbox = jest.fn();
const mockFindOldestNotificationBacklogAt = jest.fn();
const mockCountNotificationOutboxByStatusSince = jest.fn();
const mockCountNotificationOutboxDeadLetters = jest.fn();
const mockCountSnapshotOutboxByStatus = jest.fn();
const mockFindLatestSnapshotOutbox = jest.fn();
const mockFindOldestSnapshotBacklogAt = jest.fn();
const mockCountSnapshotOutboxByStatusSince = jest.fn();
const mockCountSnapshotOutboxDeadLetters = jest.fn();
const mockCountOpenPayrollPeriods = jest.fn();
const mockFindLatestOpenPayrollPeriods = jest.fn();
const mockCountFailedRunsSince = jest.fn();
const mockFindLatestRunsByJobKeys = jest.fn();
const mockGetServiceBase = jest.fn();

jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    get: mockRedisGet,
    llen: mockRedisLlen,
  },
}));

jest.mock('@config/database.js', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

jest.mock('@/modules/ocr/providers/ocr-http.provider.js', () => ({
  __esModule: true,
  OcrHttpProvider: {
    getServiceBase: mockGetServiceBase,
  },
}));

jest.mock('@/modules/ocr/services/ocr-worker.service.js', () => ({
  __esModule: true,
  getOcrWorkerEnabled: mockGetOcrWorkerEnabled,
}));

jest.mock('@/modules/system/repositories/ops-job-runs.repository.js', () => ({
  __esModule: true,
  OpsJobRunsRepository: {
    countFailedRunsSince: mockCountFailedRunsSince,
    findLatestRunsByJobKeys: mockFindLatestRunsByJobKeys,
  },
}));

jest.mock('@/modules/sync/services/sync-status.service.js', () => ({
  __esModule: true,
  getSyncRuntimeStatus: mockGetSyncRuntimeStatus,
}));

jest.mock('@/modules/system/repositories/ops-status.repository.js', () => ({
  __esModule: true,
  OpsStatusRepository: {
    countNotificationOutboxByStatus: mockCountNotificationOutboxByStatus,
    findLatestNotificationOutbox: mockFindLatestNotificationOutbox,
    findOldestNotificationBacklogAt: mockFindOldestNotificationBacklogAt,
    countNotificationOutboxByStatusSince: mockCountNotificationOutboxByStatusSince,
    countNotificationOutboxDeadLetters: mockCountNotificationOutboxDeadLetters,
    countSnapshotOutboxByStatus: mockCountSnapshotOutboxByStatus,
    findLatestSnapshotOutbox: mockFindLatestSnapshotOutbox,
    findOldestSnapshotBacklogAt: mockFindOldestSnapshotBacklogAt,
    countSnapshotOutboxByStatusSince: mockCountSnapshotOutboxByStatusSince,
    countSnapshotOutboxDeadLetters: mockCountSnapshotOutboxDeadLetters,
    countOpenPayrollPeriods: mockCountOpenPayrollPeriods,
    findLatestOpenPayrollPeriods: mockFindLatestOpenPayrollPeriods,
  },
}));

describe('jobs service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockRedisGet.mockResolvedValue(null);
    mockRedisLlen.mockResolvedValue(0);
    mockDbQuery.mockResolvedValue([]);
    mockGetServiceBase.mockReturnValue('http://ocr.local');
    mockGetOcrWorkerEnabled.mockReturnValue(true);
    mockCountNotificationOutboxByStatus.mockResolvedValue([]);
    mockFindLatestNotificationOutbox.mockResolvedValue([]);
    mockFindOldestNotificationBacklogAt.mockResolvedValue(null);
    mockCountNotificationOutboxByStatusSince.mockResolvedValue([]);
    mockCountNotificationOutboxDeadLetters.mockResolvedValue(0);
    mockCountSnapshotOutboxByStatus.mockResolvedValue([]);
    mockFindLatestSnapshotOutbox.mockResolvedValue([]);
    mockFindOldestSnapshotBacklogAt.mockResolvedValue(null);
    mockCountSnapshotOutboxByStatusSince.mockResolvedValue([]);
    mockCountSnapshotOutboxDeadLetters.mockResolvedValue(0);
    mockCountOpenPayrollPeriods.mockResolvedValue(0);
    mockFindLatestOpenPayrollPeriods.mockResolvedValue([]);
    mockCountFailedRunsSince.mockResolvedValue(0);
    mockFindLatestRunsByJobKeys.mockResolvedValue([]);
  });

  test('marks HRMS sync as DEGRADED when last sync succeeded with warnings', async () => {
    mockGetSyncRuntimeStatus.mockResolvedValue({
      isSyncing: false,
      lastResult: {
        success: true,
        overall_status: 'SUCCESS_WITH_WARNINGS',
        warnings_count: 2,
      },
    });

    const { getJobStatus } = await import('@/modules/system/services/jobs.service.js');

    const result = await getJobStatus();
    const syncJob = result.jobs.find((job) => job.key === 'hrms-sync');

    expect(result.summary.sync.status).toBe('DEGRADED');
    expect(syncJob?.status).toBe('DEGRADED');
  });
});
