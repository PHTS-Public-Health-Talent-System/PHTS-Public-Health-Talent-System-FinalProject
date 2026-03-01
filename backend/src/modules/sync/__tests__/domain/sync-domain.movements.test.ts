const loadModule = async () => import('../../services/domain/sync-domain.service.js');

describe('sync movements domain', () => {
  test('skips unchanged source-linked movements', async () => {
    const mod = await loadModule();
    const syncMovements = (
      mod as {
        syncMovements: (
          conn: unknown,
          deps: {
            applyImmediateMovementEligibilityCutoff: (...args: unknown[]) => Promise<unknown>;
          },
        ) => Promise<void>;
      }
    ).syncMovements;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('information_schema.COLUMNS') && sql.includes('tb_bp_status')) {
        return [[{ COLUMN_NAME: 'comment' }]];
      }
      if (sql.includes('FROM emp_movements')) {
        return [[{
          movement_id: 11,
          source_movement_id: 101,
          citizen_id: '1234567890123',
          movement_type: 'TRANSFER_OUT',
          effective_date: '2026-02-01',
          remark: 'ย้ายหน่วยงาน',
          source_updated_at: '2026-02-01 09:15:00',
          synced_at: '2026-02-01 09:15:00',
        }]];
      }
      if (sql.includes('FROM hrms_databases.tb_bp_status')) {
        return [[{
          source_movement_id: 101,
          citizen_id: '1234567890123',
          movement_type: 'TRANSFER_OUT',
          effective_date: '2026-02-01',
          remark: 'ย้ายหน่วยงาน',
          source_updated_at: '2026-02-01 09:15:00',
        }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const execute = jest.fn().mockResolvedValue([{}]);
    const cutoff = jest.fn().mockResolvedValue(undefined);
    const conn = { query, execute } as any;

    await syncMovements(conn, {
      applyImmediateMovementEligibilityCutoff: cutoff,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(cutoff).toHaveBeenCalledTimes(1);
  });

  test('promotes exact manual match into source-linked movement instead of inserting duplicate', async () => {
    const mod = await loadModule();
    const syncMovements = (
      mod as {
        syncMovements: (
          conn: unknown,
          deps: {
            applyImmediateMovementEligibilityCutoff: (...args: unknown[]) => Promise<unknown>;
          },
        ) => Promise<void>;
      }
    ).syncMovements;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('information_schema.COLUMNS') && sql.includes('tb_bp_status')) {
        return [[{ COLUMN_NAME: 'comment' }]];
      }
      if (sql.includes('FROM emp_movements')) {
        return [[{
          movement_id: 22,
          source_movement_id: null,
          citizen_id: '1234567890123',
          movement_type: 'RESIGN',
          effective_date: '2026-01-31',
          remark: 'ลาออก',
          source_updated_at: null,
          synced_at: '2026-01-31 10:00:00',
        }]];
      }
      if (sql.includes('FROM hrms_databases.tb_bp_status')) {
        return [[{
          source_movement_id: 202,
          citizen_id: '1234567890123',
          movement_type: 'RESIGN',
          effective_date: '2026-01-31',
          remark: 'ลาออก',
          source_updated_at: '2026-01-31 10:05:00',
        }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const execute = jest.fn().mockResolvedValue([{}]);
    const cutoff = jest.fn().mockResolvedValue(undefined);
    const conn = { query, execute } as any;

    await syncMovements(conn, {
      applyImmediateMovementEligibilityCutoff: cutoff,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE emp_movements'),
      [
        202,
        '1234567890123',
        'RESIGN',
        '2026-01-31',
        'ลาออก',
        '2026-01-31T10:05:00',
        22,
      ],
    );
  });

  test('deletes stale source-linked movements but keeps unmatched manual rows', async () => {
    const mod = await loadModule();
    const syncMovements = (
      mod as {
        syncMovements: (
          conn: unknown,
          deps: {
            applyImmediateMovementEligibilityCutoff: (...args: unknown[]) => Promise<unknown>;
          },
        ) => Promise<void>;
      }
    ).syncMovements;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('information_schema.COLUMNS') && sql.includes('tb_bp_status')) {
        return [[{ COLUMN_NAME: 'comment' }]];
      }
      if (sql.includes('FROM emp_movements')) {
        return [[
          {
            movement_id: 31,
            source_movement_id: 301,
            citizen_id: '1234567890123',
            movement_type: 'ENTRY',
            effective_date: '2026-01-01',
            remark: 'บรรจุ',
            source_updated_at: '2026-01-01 08:00:00',
            synced_at: '2026-01-01 08:00:00',
          },
          {
            movement_id: 32,
            source_movement_id: null,
            citizen_id: '1234567890123',
            movement_type: 'TRANSFER_OUT',
            effective_date: '2026-02-15',
            remark: 'manual note',
            source_updated_at: null,
            synced_at: '2026-02-15 08:00:00',
          },
        ]];
      }
      if (sql.includes('FROM hrms_databases.tb_bp_status')) {
        return [[]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const execute = jest.fn().mockResolvedValue([{}]);
    const cutoff = jest.fn().mockResolvedValue(undefined);
    const conn = { query, execute } as any;

    await syncMovements(conn, {
      applyImmediateMovementEligibilityCutoff: cutoff,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith('DELETE FROM emp_movements WHERE movement_id = ?', [31]);
  });
});
