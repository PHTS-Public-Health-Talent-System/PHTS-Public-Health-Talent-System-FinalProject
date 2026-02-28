jest.mock('@/modules/sync/services/sync.service.js', () => ({
  SyncService: {
    performFullSync: jest.fn(),
  },
}));

jest.mock('@/modules/sync/services/sync-auto-schedule.service.js', () => ({
  shouldRunAutoSync: jest.fn(),
}));

describe('sync worker service', () => {
  const originalEnabled = process.env.SYNC_WORKER_ENABLED;
  const originalPollMs = process.env.SYNC_WORKER_POLL_MS;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    process.env.SYNC_WORKER_ENABLED = 'true';
    process.env.SYNC_WORKER_POLL_MS = '1000';
  });

  afterEach(async () => {
    const mod = await import('@/modules/sync/services/sync-worker.service.js');
    await mod.stopSyncWorker();
    jest.useRealTimers();
    jest.clearAllMocks();
    if (originalEnabled === undefined) delete process.env.SYNC_WORKER_ENABLED;
    else process.env.SYNC_WORKER_ENABLED = originalEnabled;
    if (originalPollMs === undefined) delete process.env.SYNC_WORKER_POLL_MS;
    else process.env.SYNC_WORKER_POLL_MS = originalPollMs;
  });

  test('runs auto sync when scheduler says due', async () => {
    const { shouldRunAutoSync } = await import('@/modules/sync/services/sync-auto-schedule.service.js');
    const { SyncService } = await import('@/modules/sync/services/sync.service.js');
    const { startSyncWorker } = await import('@/modules/sync/services/sync-worker.service.js');

    (shouldRunAutoSync as jest.Mock).mockResolvedValueOnce(true).mockResolvedValue(false);
    (SyncService.performFullSync as jest.Mock).mockResolvedValue({ batch_id: 123 });

    startSyncWorker();
    await jest.advanceTimersByTimeAsync(1100);

    expect(SyncService.performFullSync).toHaveBeenCalledTimes(1);
    expect(SyncService.performFullSync).toHaveBeenCalledWith({ triggeredBy: null });
  });

  test('skips sync execution when scheduler says not due', async () => {
    const { shouldRunAutoSync } = await import('@/modules/sync/services/sync-auto-schedule.service.js');
    const { SyncService } = await import('@/modules/sync/services/sync.service.js');
    const { startSyncWorker } = await import('@/modules/sync/services/sync-worker.service.js');

    (shouldRunAutoSync as jest.Mock).mockResolvedValue(false);

    startSyncWorker();
    await jest.advanceTimersByTimeAsync(1100);

    expect(shouldRunAutoSync).toHaveBeenCalled();
    expect(SyncService.performFullSync).not.toHaveBeenCalled();
  });

  test('does not start when worker is disabled', async () => {
    process.env.SYNC_WORKER_ENABLED = 'false';
    const { shouldRunAutoSync } = await import('@/modules/sync/services/sync-auto-schedule.service.js');
    const { SyncService } = await import('@/modules/sync/services/sync.service.js');
    const { startSyncWorker } = await import('@/modules/sync/services/sync-worker.service.js');

    startSyncWorker();
    await jest.advanceTimersByTimeAsync(1100);

    expect(shouldRunAutoSync).not.toHaveBeenCalled();
    expect(SyncService.performFullSync).not.toHaveBeenCalled();
  });
});

