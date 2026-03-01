jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
  },
}));

describe('sync lock service', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('createSyncLockValue returns unique value even within same millisecond', async () => {
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const mod = await import('@/modules/sync/services/shared/sync-lock.service.js');

    const lockA = mod.createSyncLockValue();
    const lockB = mod.createSyncLockValue();

    expect(lockA).not.toBe(lockB);
    expect(lockA).toMatch(/^lock:\d+:[a-z0-9-]+$/i);
    expect(lockB).toMatch(/^lock:\d+:[a-z0-9-]+$/i);
    dateSpy.mockRestore();
  });

  test('heartbeat refreshes lock only when current lock value matches owner', async () => {
    const redis = (await import('@config/redis.js')).default as unknown as {
      eval: jest.Mock;
    };
    const mod = await import('@/modules/sync/services/shared/sync-lock.service.js');

    redis.eval.mockResolvedValue(1);
    const timer = mod.startSyncLockHeartbeat('lock:owner');

    await jest.advanceTimersByTimeAsync(60_100);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("GET", KEYS[1])'),
      1,
      'system:sync:lock',
      'lock:owner',
      '300',
    );
    clearInterval(timer);
  });

  test('releaseSyncLock deletes lock only when current lock value matches owner', async () => {
    const redis = (await import('@config/redis.js')).default as unknown as {
      eval: jest.Mock;
      get: jest.Mock;
      del: jest.Mock;
    };
    const mod = await import('@/modules/sync/services/shared/sync-lock.service.js');

    redis.eval.mockResolvedValue(1);
    await mod.releaseSyncLock('lock:owner');

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("GET", KEYS[1])'),
      1,
      'system:sync:lock',
      'lock:owner',
    );
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
