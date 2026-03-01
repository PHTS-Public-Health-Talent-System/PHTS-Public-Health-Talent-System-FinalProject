const redisStore = new Map<string, string>();

jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, ...args: Array<string | number>) => {
      const hasNx = args.some((arg) => String(arg).toUpperCase() === 'NX');
      if (hasNx && redisStore.has(key)) {
        return null;
      }
      redisStore.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (redisStore.delete(key)) removed += 1;
      }
      return removed;
    }),
  },
}));

describe('sync auto schedule service', () => {
  beforeEach(() => {
    jest.resetModules();
    redisStore.clear();
    delete process.env.SYNC_AUTO_MODE;
    delete process.env.SYNC_AUTO_DAILY_HOUR;
    delete process.env.SYNC_AUTO_DAILY_MINUTE;
    delete process.env.SYNC_AUTO_INTERVAL_MINUTES;
    delete process.env.SYNC_AUTO_TIMEZONE;
  });

  test('uses default daily schedule when no config is set', async () => {
    const { getSyncAutoScheduleConfig } = await import(
      '@/modules/sync/services/sync-auto-schedule.service.js'
    );

    const schedule = await getSyncAutoScheduleConfig();
    expect(schedule.mode).toBe('DAILY');
    expect(schedule.hour).toBe(2);
    expect(schedule.minute).toBe(0);
    expect(schedule.interval_minutes).toBe(60);
  });

  test('persists interval schedule and returns normalized values', async () => {
    const { setSyncAutoScheduleConfig, getSyncAutoScheduleConfig } = await import(
      '@/modules/sync/services/sync-auto-schedule.service.js'
    );

    await setSyncAutoScheduleConfig({
      mode: 'INTERVAL',
      interval_minutes: 30,
      timezone: 'Asia/Bangkok',
    });
    const schedule = await getSyncAutoScheduleConfig();

    expect(schedule.mode).toBe('INTERVAL');
    expect(schedule.interval_minutes).toBe(30);
    expect(schedule.timezone).toBe('Asia/Bangkok');
  });

  test('falls back to the default timezone when persisted config contains an invalid timezone', async () => {
    const redis = (await import('@config/redis.js')).default as unknown as {
      set: jest.Mock;
    };
    const { getSyncAutoScheduleConfig } = await import(
      '@/modules/sync/services/sync-auto-schedule.service.js'
    );

    await redis.set(
      'system:sync:auto-schedule',
      JSON.stringify({
        mode: 'DAILY',
        hour: 4,
        minute: 0,
        interval_minutes: 60,
        timezone: 'Mars/Olympus',
      }),
    );

    const schedule = await getSyncAutoScheduleConfig();

    expect(schedule.timezone).toBe('Asia/Bangkok');
  });

  test('daily mode runs once after scheduled minute and dedupes same day', async () => {
    const { setSyncAutoScheduleConfig, shouldRunAutoSync } = await import(
      '@/modules/sync/services/sync-auto-schedule.service.js'
    );

    await setSyncAutoScheduleConfig({
      mode: 'DAILY',
      hour: 3,
      minute: 10,
      timezone: 'Asia/Bangkok',
    });

    await expect(shouldRunAutoSync(new Date('2026-03-01T03:09:00+07:00'))).resolves.toBe(false);
    await expect(shouldRunAutoSync(new Date('2026-03-01T03:10:00+07:00'))).resolves.toBe(true);
    await expect(shouldRunAutoSync(new Date('2026-03-01T05:45:00+07:00'))).resolves.toBe(false);
    await expect(shouldRunAutoSync(new Date('2026-03-02T03:10:00+07:00'))).resolves.toBe(true);
  });

  test('interval mode runs once per interval bucket', async () => {
    const { setSyncAutoScheduleConfig, shouldRunAutoSync } = await import(
      '@/modules/sync/services/sync-auto-schedule.service.js'
    );

    await setSyncAutoScheduleConfig({
      mode: 'INTERVAL',
      interval_minutes: 30,
      timezone: 'Asia/Bangkok',
    });

    await expect(shouldRunAutoSync(new Date('2026-03-01T03:00:00+07:00'))).resolves.toBe(true);
    await expect(shouldRunAutoSync(new Date('2026-03-01T03:29:00+07:00'))).resolves.toBe(false);
    await expect(shouldRunAutoSync(new Date('2026-03-01T03:30:00+07:00'))).resolves.toBe(true);
  });
});
