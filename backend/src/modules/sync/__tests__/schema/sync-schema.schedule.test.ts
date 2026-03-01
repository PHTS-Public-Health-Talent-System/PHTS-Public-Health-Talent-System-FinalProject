import { syncScheduleSchema } from '../../sync.schema.js';

describe('sync schema - syncScheduleSchema', () => {
  test('accepts a valid IANA timezone', () => {
    const parsed = syncScheduleSchema.parse({
      body: {
        mode: 'DAILY',
        hour: 2,
        minute: 30,
        timezone: 'Asia/Bangkok',
      },
    });

    expect(parsed.body.timezone).toBe('Asia/Bangkok');
  });

  test('rejects an invalid timezone value', () => {
    expect(() =>
      syncScheduleSchema.parse({
        body: {
          mode: 'INTERVAL',
          interval_minutes: 60,
          timezone: 'Mars/Olympus',
        },
      }),
    ).toThrow('timezone ไม่ถูกต้อง');
  });
});
