import {
  fiscalYearFromDate,
  normalizeDateRange,
  resolveDurationDays,
  toDateOnly,
  toDateString,
} from '@/modules/sync/services/domain/leave-date-normalizer.js';

describe('leave date normalizer', () => {
  test.each([
    ['2025/06/01', '2025-06-01'],
    ['01/06/2025', '2025-06-01'],
    ['๒๕๖๘-๐๖-๐๑', '2025-06-01'],
  ])('parses %s to %s', (input, expected) => {
    expect(toDateString(toDateOnly(input))).toBe(expected);
  });

  test('fixes shifted future year from upstream bug', () => {
    expect(toDateString(toDateOnly('2066-05-16'))).toBe('2023-05-16');
  });

  test('returns normalized date range in ascending order', () => {
    const range = normalizeDateRange({
      start_date: '2025-06-05',
      end_date: '2025-06-01',
    } as any);

    expect(toDateString(range.start)).toBe('2025-06-01');
    expect(toDateString(range.end)).toBe('2025-06-05');
  });

  test('resolves half-day leave duration from row flags', () => {
    const range = normalizeDateRange({
      start_date: '2025-06-01',
      end_date: '2025-06-01',
    } as any);

    expect(
      resolveDurationDays(
        {
          source_type: 'LEAVE',
          half_day: 1,
        } as any,
        range,
      ),
    ).toBe(0.5);
  });

  test('computes fiscal year in Thai calendar', () => {
    expect(fiscalYearFromDate(toDateOnly('2025-09-30'))).toBe(2568);
    expect(fiscalYearFromDate(toDateOnly('2025-10-01'))).toBe(2569);
  });
});
