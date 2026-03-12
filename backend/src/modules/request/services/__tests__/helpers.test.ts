import { normalizeDateToYMD } from '@/modules/request/services/helpers.js';

describe('request service helpers - normalizeDateToYMD', () => {
  const originalDbTimezone = process.env.DB_TIMEZONE;

  beforeEach(() => {
    process.env.DB_TIMEZONE = '+07:00';
  });

  afterAll(() => {
    process.env.DB_TIMEZONE = originalDbTimezone;
  });

  it('keeps date-only string unchanged', () => {
    expect(normalizeDateToYMD('2025-01-01')).toBe('2025-01-01');
  });

  it('keeps date part from ISO-like string to avoid timezone day shift', () => {
    expect(normalizeDateToYMD('2025-01-01T00:00:00+07:00')).toBe('2025-01-01');
  });

  it('normalizes Date object using DB timezone (+07:00)', () => {
    const mysqlDateAtBangkokMidnight = new Date('2024-12-31T17:00:00.000Z');
    expect(normalizeDateToYMD(mysqlDateAtBangkokMidnight)).toBe('2025-01-01');
  });
});
