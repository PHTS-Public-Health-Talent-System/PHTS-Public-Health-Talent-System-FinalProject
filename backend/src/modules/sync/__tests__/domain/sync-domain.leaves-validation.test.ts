import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { syncLeaves, syncSingleLeaves } from '@/modules/sync/services/domain/sync-domain.service.js';
import { createLeaveSyncDeps, createLeaveSyncStats } from './sync-domain.leaves-validation.test-helpers.js';

describe('sync-domain leave validation guards', () => {
  test('syncLeaves looks up existing rows only for incoming ref_id values', async () => {
    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          [
            {
              ref_id: 'R1',
              citizen_id: '1539900084717',
              start_date: '2025-06-01',
              end_date: '2025-06-01',
              status: 'approved',
            },
          ],
        ])
        .mockResolvedValueOnce([[]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncLeaves(conn, stats, createLeaveSyncDeps());

    expect((conn.query as jest.Mock).mock.calls[0]?.[0]).toBe('SELECT 1');
    expect((conn.query as jest.Mock).mock.calls[1]?.[0]).toContain('WHERE ref_id IN (?)');
    expect((conn.query as jest.Mock).mock.calls[1]?.[0]).toContain('leave_type');
    expect((conn.query as jest.Mock).mock.calls[1]?.[0]).toContain('duration_days');
    expect((conn.query as jest.Mock).mock.calls[1]?.[0]).toContain('fiscal_year');
    expect((conn.query as jest.Mock).mock.calls[1]?.[0]).toContain('remark');
    expect((conn.query as jest.Mock).mock.calls[1]?.[1]).toEqual([['R1']]);
  });

  test('syncLeaves skips unchanged row when leave metadata matches existing record', async () => {
    const sourceRow = {
      ref_id: '87326',
      citizen_id: '5530890001312',
      leave_type: 'personal',
      start_date: '2025-06-01',
      end_date: '2025-06-01',
      duration_days: 1,
      fiscal_year: 2568,
      remark: 'สามีไม่สบาย อาหารเป็นพิษ พบแพทย์ที่โรงพยาบาล',
      status: 'approved',
    };

    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[sourceRow]])
        .mockResolvedValueOnce([[sourceRow]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncLeaves(
      conn,
      stats,
      createLeaveSyncDeps({
        isChanged: (oldVal: unknown, newVal: unknown) => oldVal !== newVal,
      }),
    );

    expect((conn.execute as jest.Mock).mock.calls).toEqual(
      expect.arrayContaining([
        [expect.stringContaining('DELETE FROM leave_records'), []],
      ]),
    );
    expect(stats.leaves.upserted).toBe(0);
    expect(stats.leaves.skipped).toBe(1);
  });

  test('syncLeaves skips row when citizen_id is invalid', async () => {
    const conn = {
      query: jest
        .fn()
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
        ])
        .mockResolvedValueOnce([[]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncLeaves(conn, stats, createLeaveSyncDeps());

    expect((conn.execute as jest.Mock).mock.calls).toEqual(
      expect.arrayContaining([
        [expect.stringContaining('DELETE FROM leave_records'), []],
      ]),
    );
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

    const stats = createLeaveSyncStats();
    await syncSingleLeaves(
      conn,
      '1539900084717',
      stats,
      createLeaveSyncDeps({ citizenIdWhereBinary: () => '1=1' }),
    );

    expect((conn.execute as jest.Mock).mock.calls.length).toBe(0);
    expect(stats.leaves.upserted).toBe(0);
    expect(stats.leaves.skipped).toBe(1);
  });

  test('syncSingleLeaves prefers a direct single-user source query when available', async () => {
    const conn = {
      query: jest.fn().mockResolvedValueOnce([[]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncSingleLeaves(
      conn,
      '1539900084717',
      stats,
      createLeaveSyncDeps({
        buildLeaveViewQuery: () => 'SELECT full_view',
        buildSingleLeaveViewQuery: (citizenWhere: string) =>
          `SELECT single_view WHERE ${citizenWhere}`,
        citizenIdWhereBinary: () => 'citizen_predicate',
      }),
    );

    expect((conn.query as jest.Mock).mock.calls[0]?.[0]).toBe(
      'SELECT single_view WHERE citizen_predicate',
    );
    expect((conn.query as jest.Mock).mock.calls[0]?.[1]).toEqual([
      '1539900084717',
      '1539900084717',
      '1539900084717',
    ]);
  });

  test('syncLeaves updates an existing row when leave_type changes even if dates/status stay the same', async () => {
    const sourceRow = {
      ref_id: '87326',
      citizen_id: '5530890001312',
      leave_type: 'personal',
      start_date: '2025-06-01',
      end_date: '2025-06-01',
      duration_days: 1,
      fiscal_year: 2568,
      remark: 'สามีไม่สบาย อาหารเป็นพิษ พบแพทย์ที่โรงพยาบาล',
      status: 'approved',
    };

    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[sourceRow]])
        .mockResolvedValueOnce([[
          {
            ref_id: '87326',
            citizen_id: '5530890001312',
            leave_type: 'sick',
            start_date: '2025-06-01',
            end_date: '2025-06-01',
            duration_days: 1,
            fiscal_year: 2568,
            remark: 'สามีไม่สบาย อาหารเป็นพิษ พบแพทย์ที่โรงพยาบาล',
            status: 'approved',
          },
        ]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncLeaves(
      conn,
      stats,
      createLeaveSyncDeps({
        buildLeaveRecordValues: (row: RowDataPacket) => [row.leave_type],
        isChanged: (oldVal: unknown, newVal: unknown) => oldVal !== newVal,
      }),
    );

    expect((conn.execute as jest.Mock).mock.calls).toEqual(
      expect.arrayContaining([
        ['INSERT INTO leave_records VALUES (?)', ['personal']],
        [expect.stringContaining('DELETE FROM leave_records'), []],
      ]),
    );
    expect(stats.leaves.upserted).toBe(1);
    expect(stats.leaves.skipped).toBe(0);
  });

  test('syncLeaves emits review-only issue metadata without changing leave type', async () => {
    const onLeaveReviewFlagged = jest.fn();
    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          {
            ref_id: '67272',
            citizen_id: '1539900059640',
            leave_type: 'sick',
            start_date: '2025-06-01',
            end_date: '2025-06-01',
            duration_days: 1,
            fiscal_year: 2568,
            remark: 'พาพ่อไปหาหมอ',
            status: 'approved',
          },
        ]])
        .mockResolvedValueOnce([[]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncLeaves(
      conn,
      stats,
      createLeaveSyncDeps({
        normalizeLeaveRowWithMeta: (row: RowDataPacket) => ({
          row,
          meta: null,
          reviewMeta: {
            source_type: 'sick',
            suspected_type: 'personal',
            reason_code: 'SICK_LEAVE_FAMILY_CARE_REVIEW',
            reason_text: 'ข้อความการลามีบริบทเป็นการดูแลบุคคลอื่น แม้ประเภทการลาจาก HRMS จะเป็นลาป่วย',
          },
          normalizationIssues: [],
        }),
        onLeaveReviewFlagged,
      }),
    );

    expect(onLeaveReviewFlagged).toHaveBeenCalledWith({
      sourceKey: '67272',
      citizenId: '1539900059640',
      remark: 'พาพ่อไปหาหมอ',
      meta: {
        source_type: 'sick',
        suspected_type: 'personal',
        reason_code: 'SICK_LEAVE_FAMILY_CARE_REVIEW',
        reason_text: 'ข้อความการลามีบริบทเป็นการดูแลบุคคลอื่น แม้ประเภทการลาจาก HRMS จะเป็นลาป่วย',
      },
    });
  });

  test('syncLeaves emits normalization issue metadata before skipping invalid rows', async () => {
    const onLeaveNormalizationIssue = jest.fn();
    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          {
            ref_id: 'LM-BAD-DATE',
            citizen_id: '1539900084717',
            leave_type: 'personal',
            start_date: null,
            end_date: null,
            duration_days: 1,
            fiscal_year: null,
            remark: 'invalid date',
            status: 'approved',
          },
        ]])
        .mockResolvedValueOnce([[]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncLeaves(
      conn,
      stats,
      createLeaveSyncDeps({
        normalizeLeaveRowWithMeta: (row: RowDataPacket) => ({
          row,
          meta: null,
          reviewMeta: null,
          normalizationIssues: [
            {
              issue_code: 'LEAVE_DATE_INVALID',
              reason_text: 'ไม่สามารถแปลงวันที่ลาได้จากข้อมูลต้นทาง',
              detail: {
                start_date: '31/13/2025',
                end_date: '31/13/2025',
              },
            },
          ],
        }),
        onLeaveNormalizationIssue,
      }),
    );

    expect(onLeaveNormalizationIssue).toHaveBeenCalledWith({
      sourceKey: 'LM-BAD-DATE',
      citizenId: '1539900084717',
      meta: {
        issue_code: 'LEAVE_DATE_INVALID',
        reason_text: 'ไม่สามารถแปลงวันที่ลาได้จากข้อมูลต้นทาง',
        detail: {
          start_date: '31/13/2025',
          end_date: '31/13/2025',
        },
      },
    });
    expect(stats.leaves.skipped).toBe(1);
  });

  test('syncLeaves removes synced leave rows whose citizen is no longer in emp_profiles', async () => {
    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[
          {
            ref_id: 'R1',
            citizen_id: '1539900084717',
            leave_type: 'personal',
            start_date: '2025-06-01',
            end_date: '2025-06-01',
            duration_days: 1,
            fiscal_year: 2568,
            remark: 'ลา',
            status: 'approved',
          },
        ]])
        .mockResolvedValueOnce([[]]),
      execute: jest.fn(),
    } as unknown as PoolConnection;

    const stats = createLeaveSyncStats();
    await syncLeaves(conn, stats, createLeaveSyncDeps({ isChanged: () => false }));

    expect((conn.execute as jest.Mock).mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining('DELETE FROM leave_records'),
          [],
        ],
      ]),
    );
    expect((conn.execute as jest.Mock).mock.calls.at(-1)?.[0]).toContain('ref_id IS NOT NULL');
    expect((conn.execute as jest.Mock).mock.calls.at(-1)?.[0]).toContain('FROM emp_profiles e');
  });
});
