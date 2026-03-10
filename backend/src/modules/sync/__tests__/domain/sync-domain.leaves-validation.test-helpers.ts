import type { RowDataPacket } from 'mysql2/promise';

export const createLeaveSyncStats = () =>
  ({
    leaves: { upserted: 0, skipped: 0 },
  }) as any;

export const createLeaveSyncDeps = (overrides: Record<string, unknown> = {}) => ({
  hasLeaveStatusColumn: async () => true,
  buildLeaveRecordSql: () => ({ sql: 'INSERT INTO leave_records VALUES (?)', fields: [] }),
  buildLeaveRecordValues: () => [],
  buildLeaveViewQuery: () => 'SELECT 1',
  isChanged: () => true,
  normalizeLeaveRowWithMeta: (row: RowDataPacket) => ({
    row,
    meta: null,
    reviewMeta: null,
    normalizationIssues: [],
  }),
  ...overrides,
});
