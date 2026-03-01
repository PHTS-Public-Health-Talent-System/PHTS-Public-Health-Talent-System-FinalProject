jest.mock('@/modules/sync/services/sync.service.js', () => ({
  SyncService: {
    performScheduledFullSync: jest.fn(),
  },
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

  test('runs auto sync when a scheduled run is due', async () => {
    const { SyncService } = await import('@/modules/sync/services/sync.service.js');
    const { startSyncWorker } = await import('@/modules/sync/services/sync-worker.service.js');

    (SyncService.performScheduledFullSync as jest.Mock)
      .mockResolvedValueOnce({ batch_id: 123 })
      .mockResolvedValue(null);

    startSyncWorker();
    await jest.advanceTimersByTimeAsync(1100);

    expect(SyncService.performScheduledFullSync).toHaveBeenCalledTimes(2);
    expect(SyncService.performScheduledFullSync).toHaveBeenCalledWith({ triggeredBy: null });
  });

  test('does not run a sync when no scheduled window is due', async () => {
    const { SyncService } = await import('@/modules/sync/services/sync.service.js');
    const { startSyncWorker } = await import('@/modules/sync/services/sync-worker.service.js');

    (SyncService.performScheduledFullSync as jest.Mock).mockResolvedValue(null);

    startSyncWorker();
    await jest.advanceTimersByTimeAsync(1100);

    expect(SyncService.performScheduledFullSync).toHaveBeenCalled();
  });

  test('does not start when worker is disabled', async () => {
    process.env.SYNC_WORKER_ENABLED = 'false';
    const { SyncService } = await import('@/modules/sync/services/sync.service.js');
    const { startSyncWorker } = await import('@/modules/sync/services/sync-worker.service.js');

    startSyncWorker();
    await jest.advanceTimersByTimeAsync(1100);

    expect(SyncService.performScheduledFullSync).not.toHaveBeenCalled();
  });
});
