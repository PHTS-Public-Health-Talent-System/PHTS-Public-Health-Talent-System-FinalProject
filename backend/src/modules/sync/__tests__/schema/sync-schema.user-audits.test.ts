import { userSyncAuditsQuerySchema } from '../../sync.schema.js';

describe('sync schema - userSyncAuditsQuerySchema', () => {
  test('accepts valid query values', () => {
    const parsed = userSyncAuditsQuerySchema.parse({
      query: {
        limit: '100',
        batch_id: '25',
        citizen_id: '1234567890123',
        action: 'DEACTIVATE_MISSING',
      },
    });
    expect(parsed.query.limit).toBe('100');
    expect(parsed.query.batch_id).toBe('25');
    expect(parsed.query.citizen_id).toBe('1234567890123');
    expect(parsed.query.action).toBe('DEACTIVATE_MISSING');
  });

  test('rejects invalid action', () => {
    expect(() =>
      userSyncAuditsQuerySchema.parse({
        query: {
          action: 'UNKNOWN',
        },
      }),
    ).toThrow();
  });
});
