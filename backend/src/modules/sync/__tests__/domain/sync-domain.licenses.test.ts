const loadModule = async () => import('../../services/domain/sync-domain.service.js');

describe('sync licenses domain', () => {
  test('skips unchanged source-linked licenses', async () => {
    const mod = await loadModule();
    const syncLicensesAndQuotas = (
      mod as {
        syncLicensesAndQuotas: (
          conn: unknown,
          stats: unknown,
          deps: {
            buildQuotasViewQuery: () => string;
            upsertLeaveQuota: (...args: unknown[]) => Promise<unknown>;
          },
        ) => Promise<void>;
      }
    ).syncLicensesAndQuotas;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM emp_licenses')) {
        return [[{
          license_id: 10,
          source_license_id: 101,
          citizen_id: '1234567890123',
          license_name: 'ใบประกอบวิชาชีพ',
          license_no: 'ABC123',
          valid_from: '2024-01-01',
          valid_until: '2029-01-01',
          status: 'ACTIVE',
          source_updated_at: '2026-02-01 10:00:00',
        }]];
      }
      if (sql.includes('FROM hrms_databases.tb_bp_license')) {
        return [[{
          source_license_id: 101,
          citizen_id: '1234567890123',
          license_name: 'ใบประกอบวิชาชีพ',
          license_no: 'ABC123',
          valid_from: '2024-01-01',
          valid_until: '2029-01-01',
          status: 'ACTIVE',
          source_updated_at: '2026-02-01 10:00:00',
        }]];
      }
      if (sql.includes('FROM leave_quotas')) {
        return [[]];
      }
      if (sql.includes('FROM hrms_databases.setdays')) {
        return [[]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const execute = jest.fn().mockResolvedValue([{}]);
    const upsertLeaveQuota = jest.fn();
    const conn = { query, execute } as any;
    const stats = { licenses: { upserted: 0 }, quotas: { upserted: 0 } } as any;

    await syncLicensesAndQuotas(conn, stats, {
      buildQuotasViewQuery: jest.fn().mockReturnValue('SELECT * FROM hrms_databases.setdays'),
      upsertLeaveQuota,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(stats.licenses.upserted).toBe(0);
    expect(upsertLeaveQuota).not.toHaveBeenCalled();
  });

  test('promotes exact legacy license into source-linked row instead of inserting duplicate', async () => {
    const mod = await loadModule();
    const syncSingleLicenses = (
      mod as {
        syncSingleLicenses: (conn: unknown, citizenId: string) => Promise<void>;
      }
    ).syncSingleLicenses;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM emp_licenses')) {
        return [[{
          license_id: 20,
          source_license_id: null,
          citizen_id: '1234567890123',
          license_name: 'ใบประกอบวิชาชีพ',
          license_no: 'ABC123',
          valid_from: '2024-01-01',
          valid_until: '2029-01-01',
          status: 'ACTIVE',
          source_updated_at: null,
        }]];
      }
      if (sql.includes('FROM hrms_databases.tb_bp_license')) {
        return [[{
          source_license_id: 202,
          citizen_id: '1234567890123',
          license_name: 'ใบประกอบวิชาชีพ',
          license_no: 'ABC123',
          valid_from: '2024-01-01',
          valid_until: '2029-01-01',
          status: 'ACTIVE',
          source_updated_at: '2026-03-01 04:00:00',
        }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const execute = jest.fn().mockResolvedValue([{}]);
    const conn = { query, execute } as any;

    await syncSingleLicenses(conn, '1234567890123');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE emp_licenses'),
      [
        202,
        '1234567890123',
        'ใบประกอบวิชาชีพ',
        'ABC123',
        '2024-01-01',
        '2029-01-01',
        'ACTIVE',
        '2026-03-01T04:00:00',
        20,
      ],
    );
  });

  test('deletes stale source-linked licenses missing from source', async () => {
    const mod = await loadModule();
    const syncSingleLicenses = (
      mod as {
        syncSingleLicenses: (conn: unknown, citizenId: string) => Promise<void>;
      }
    ).syncSingleLicenses;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM emp_licenses')) {
        return [[
          {
            license_id: 30,
            source_license_id: 303,
            citizen_id: '1234567890123',
            license_name: 'ใบประกอบวิชาชีพ',
            license_no: 'ABC123',
            valid_from: '2024-01-01',
            valid_until: '2029-01-01',
            status: 'ACTIVE',
            source_updated_at: '2026-02-01 10:00:00',
          },
          {
            license_id: 31,
            source_license_id: null,
            citizen_id: '1234567890123',
            license_name: 'manual backup',
            license_no: 'MANUAL',
            valid_from: '2024-01-01',
            valid_until: '2029-01-01',
            status: 'ACTIVE',
            source_updated_at: null,
          },
        ]];
      }
      if (sql.includes('FROM hrms_databases.tb_bp_license')) {
        return [[]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const execute = jest.fn().mockResolvedValue([{}]);
    const conn = { query, execute } as any;

    await syncSingleLicenses(conn, '1234567890123');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith('DELETE FROM emp_licenses WHERE license_id = ?', [30]);
  });
});
