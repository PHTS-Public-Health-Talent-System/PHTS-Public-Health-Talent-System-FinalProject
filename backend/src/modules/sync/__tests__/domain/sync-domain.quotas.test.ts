const loadModule = async () => import('../../services/domain/sync-domain.service.js');

describe('sync quotas domain', () => {
  test('skips unchanged quotas', async () => {
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
      if (sql.includes('FROM emp_licenses')) return [[]];
      if (sql.includes('FROM hrms_databases.tb_bp_license')) return [[]];
      if (sql.includes('FROM leave_quotas')) {
        return [[{
          quota_id: 1,
          citizen_id: '1234567890123',
          fiscal_year: 2569,
          quota_vacation: '10.00',
        }]];
      }
      if (sql.includes('FROM hrms_databases.setdays')) {
        return [[{
          citizen_id: '1234567890123',
          fiscal_year: 2569,
          total_quota: '10.00',
        }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const upsertLeaveQuota = jest.fn();
    const conn = { query, execute: jest.fn() } as any;
    const stats = { licenses: { upserted: 0 }, quotas: { upserted: 0 } } as any;

    await syncLicensesAndQuotas(conn, stats, {
      buildQuotasViewQuery: jest.fn().mockReturnValue('SELECT * FROM hrms_databases.setdays'),
      upsertLeaveQuota,
    });

    expect(upsertLeaveQuota).not.toHaveBeenCalled();
    expect(stats.quotas.upserted).toBe(0);
  });

  test('updates changed quota', async () => {
    const mod = await loadModule();
    const syncSingleQuotas = (
      mod as {
        syncSingleQuotas: (
          conn: unknown,
          citizenId: string,
          stats: unknown,
          deps: {
            upsertLeaveQuota: (...args: unknown[]) => Promise<unknown>;
          },
        ) => Promise<void>;
      }
    ).syncSingleQuotas;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM leave_quotas')) {
        return [[{
          quota_id: 1,
          citizen_id: '1234567890123',
          fiscal_year: 2569,
          quota_vacation: '8.00',
        }]];
      }
      if (sql.includes('FROM hrms_databases.setdays')) {
        return [[{
          citizen_id: '1234567890123',
          fiscal_year: 2569,
          total_quota: '10.00',
        }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const upsertLeaveQuota = jest.fn().mockResolvedValue(undefined);
    const conn = { query, execute: jest.fn() } as any;
    const stats = { quotas: { upserted: 0 } } as any;

    await syncSingleQuotas(conn, '1234567890123', stats, { upsertLeaveQuota });

    expect(upsertLeaveQuota).toHaveBeenCalledWith(conn, '1234567890123', 2569, '10.00');
    expect(stats.quotas.upserted).toBe(1);
  });

  test('inserts new quota when missing', async () => {
    const mod = await loadModule();
    const syncSingleQuotas = (
      mod as {
        syncSingleQuotas: (
          conn: unknown,
          citizenId: string,
          stats: unknown,
          deps: {
            upsertLeaveQuota: (...args: unknown[]) => Promise<unknown>;
          },
        ) => Promise<void>;
      }
    ).syncSingleQuotas;

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM leave_quotas')) return [[]];
      if (sql.includes('FROM hrms_databases.setdays')) {
        return [[{
          citizen_id: '1234567890123',
          fiscal_year: 2569,
          total_quota: '10.00',
        }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const upsertLeaveQuota = jest.fn().mockResolvedValue(undefined);
    const conn = { query, execute: jest.fn() } as any;
    const stats = { quotas: { upserted: 0 } } as any;

    await syncSingleQuotas(conn, '1234567890123', stats, { upsertLeaveQuota });

    expect(upsertLeaveQuota).toHaveBeenCalledTimes(1);
    expect(stats.quotas.upserted).toBe(1);
  });
});
