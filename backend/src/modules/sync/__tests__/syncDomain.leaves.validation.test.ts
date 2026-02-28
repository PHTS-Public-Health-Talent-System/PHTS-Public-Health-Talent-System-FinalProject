import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { syncLeaves, syncSingleLeaves } from '@/modules/sync/services/domain/sync-domain.service.js';

const createStats = () =>
  ({
    leaves: { upserted: 0, skipped: 0 },
  }) as any;

describe('sync-domain leave validation guards', () => {
  test('syncLeaves skips row when citizen_id is invalid', async () => {
    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([
          [
            {
              ref_id: 'R1',
              citizen_id: '',
              start_date: '2025-06-01',
              end_date: '2025-06-01',
              status: 'approved',
            },
          ],
        ]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createStats();
    await syncLeaves(conn, stats, {
      hasLeaveStatusColumn: async () => true,
      buildLeaveRecordSql: () => ({ sql: 'INSERT INTO leave_records VALUES (?)', fields: [] }),
      buildLeaveRecordValues: () => [],
      buildLeaveViewQuery: () => 'SELECT 1',
      isChanged: () => true,
      normalizeLeaveRowWithMeta: (row: RowDataPacket) => ({ row, meta: null }),
    });

    expect((conn.execute as jest.Mock).mock.calls.length).toBe(0);
    expect(stats.leaves.upserted).toBe(0);
    expect(stats.leaves.skipped).toBe(1);
  });

  test('syncSingleLeaves skips row when start/end date is missing after normalization', async () => {
    const conn = {
      query: jest.fn().mockResolvedValueOnce([
        [
          {
            ref_id: 'R2',
            citizen_id: '1539900084717',
            start_date: null,
            end_date: null,
            status: 'approved',
          },
        ],
      ]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createStats();
    await syncSingleLeaves(conn, '1539900084717', stats, {
      hasLeaveStatusColumn: async () => true,
      buildLeaveRecordSql: () => ({ sql: 'INSERT INTO leave_records VALUES (?)', fields: [] }),
      buildLeaveRecordValues: () => [],
      buildLeaveViewQuery: () => 'SELECT 1',
      citizenIdWhereBinary: () => '1=1',
      normalizeLeaveRowWithMeta: (row: RowDataPacket) => ({ row, meta: null }),
    });

    expect((conn.execute as jest.Mock).mock.calls.length).toBe(0);
    expect(stats.leaves.upserted).toBe(0);
    expect(stats.leaves.skipped).toBe(1);
  });
});
