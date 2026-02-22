import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';

type SupportEmployeeSqlOptions = {
  hasLevelColumn: boolean;
};

export const syncEmployees = async (
  conn: PoolConnection,
  stats: SyncStats,
  userIdMap: Map<string, number>,
  deps: {
    viewEmployeeColumns: readonly string[];
    buildEmployeeViewQuery: () => string;
    isChanged: (oldVal: unknown, newVal: unknown) => boolean;
    upsertEmployeeProfile: (conn: PoolConnection, vEmp: RowDataPacket) => Promise<void>;
    clearScopeCache: (userId: number) => void;
  },
): Promise<void> => {
  console.log('[SyncService] Processing employees...');
  const [existingEmps] = await conn.query<RowDataPacket[]>(
    'SELECT citizen_id, position_name, level, department, special_position FROM emp_profiles',
  );
  const empMap = new Map(existingEmps.map((e) => [e.citizen_id, e]));

  const [viewEmps] = await conn.query<RowDataPacket[]>(
    `SELECT ${deps.viewEmployeeColumns.map((column) => `e.${column}`).join(', ')}
     FROM (${deps.buildEmployeeViewQuery()}) e`,
  );

  for (const vEmp of viewEmps) {
    const dbEmp = empMap.get(vEmp.citizen_id);
    const specialChanged = dbEmp && deps.isChanged(dbEmp.special_position, vEmp.special_position);
    if (
      dbEmp &&
      !deps.isChanged(dbEmp.position_name, vEmp.position_name) &&
      !deps.isChanged(dbEmp.level, vEmp.level) &&
      !deps.isChanged(dbEmp.department, vEmp.department) &&
      !specialChanged
    ) {
      stats.employees.skipped++;
      continue;
    }

    await deps.upsertEmployeeProfile(conn, vEmp);
    stats.employees.upserted++;

    const userId = userIdMap.get(vEmp.citizen_id);
    if (specialChanged && userId !== undefined) {
      deps.clearScopeCache(userId);
    }
  }
};

export const syncSupportEmployees = async (
  conn: PoolConnection,
  stats: SyncStats,
  userIdMap: Map<string, number>,
  deps: {
    viewSupportColumns: readonly string[];
    buildSupportViewQuery: () => string;
    isChanged: (oldVal: unknown, newVal: unknown) => boolean;
    hasSupportLevelColumn: (conn: PoolConnection) => Promise<boolean>;
    buildSupportEmployeeSql: (
      options: SupportEmployeeSqlOptions,
    ) => { sql: string; fields: string[] };
    buildSupportEmployeeValues: (
      vSup: RowDataPacket,
      options: SupportEmployeeSqlOptions,
    ) => unknown[];
    clearScopeCache: (userId: number) => void;
  },
): Promise<void> => {
  console.log('[SyncService] Processing support employees...');

  const hasSupportLevel = await deps.hasSupportLevelColumn(conn);

  const sqlOptions: SupportEmployeeSqlOptions = { hasLevelColumn: hasSupportLevel };
  const { sql } = deps.buildSupportEmployeeSql(sqlOptions);

  const [existingSupEmps] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, title, first_name, last_name, position_name,
            level, special_position, emp_type, department,
            is_currently_active
     FROM emp_support_staff`,
  );
  const supEmpMap = new Map(existingSupEmps.map((e) => [e.citizen_id, e]));

  const [viewSupEmps] = await conn.query<RowDataPacket[]>(
    `SELECT ${deps.viewSupportColumns.map((column) => `s.${column}`).join(', ')}
     FROM (${deps.buildSupportViewQuery()}) s`,
  );

  for (const vSup of viewSupEmps) {
    const dbSup = supEmpMap.get(vSup.citizen_id);

    const supportSpecialChanged = dbSup && deps.isChanged(dbSup.special_position, vSup.special_position);
    if (
      dbSup &&
      !deps.isChanged(dbSup.title, vSup.title) &&
      !deps.isChanged(dbSup.first_name, vSup.first_name) &&
      !deps.isChanged(dbSup.last_name, vSup.last_name) &&
      !deps.isChanged(dbSup.position_name, vSup.position_name) &&
      (!hasSupportLevel || !deps.isChanged(dbSup.level, vSup.level)) &&
      !supportSpecialChanged &&
      !deps.isChanged(dbSup.emp_type, vSup.employee_type) &&
      !deps.isChanged(dbSup.department, vSup.department) &&
      Number(dbSup.is_currently_active) === Number(vSup.is_currently_active)
    ) {
      stats.support_employees.skipped++;
      continue;
    }

    const values = deps.buildSupportEmployeeValues(vSup, sqlOptions);
    await conn.execute(sql, values);
    stats.support_employees.upserted++;

    const userId = userIdMap.get(vSup.citizen_id);
    if (supportSpecialChanged && userId !== undefined) {
      deps.clearScopeCache(userId);
    }
  }
};

export const upsertSingleEmployeeProfile = async (
  conn: PoolConnection,
  citizenId: string,
  userIdMap: Map<string, number>,
  stats: SyncStats,
  deps: {
    viewEmployeeColumns: readonly string[];
    buildEmployeeViewQuery: () => string;
    citizenIdWhereBinary: (alias: string, placeholder: string) => string;
    upsertEmployeeProfile: (conn: PoolConnection, vEmp: RowDataPacket) => Promise<void>;
    clearScopeCache: (userId: number) => void;
  },
): Promise<void> => {
  const [viewEmps] = await conn.query<RowDataPacket[]>(
    `SELECT ${deps.viewEmployeeColumns.map((column) => `e.${column}`).join(', ')}
     FROM (${deps.buildEmployeeViewQuery()}) e
     WHERE ${deps.citizenIdWhereBinary('e', '?')}
     LIMIT 1`,
    [citizenId],
  );
  const vEmp = viewEmps[0];
  if (!vEmp) return;

  await deps.upsertEmployeeProfile(conn, vEmp);
  stats.employees.upserted++;
  const userId = userIdMap.get(citizenId);
  if (userId) deps.clearScopeCache(userId);
};

export const upsertSingleSupportEmployee = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
  deps: {
    viewSupportColumns: readonly string[];
    buildSupportViewQuery: () => string;
    citizenIdWhereBinary: (alias: string, placeholder: string) => string;
    hasSupportLevelColumn: (conn: PoolConnection) => Promise<boolean>;
    buildSupportEmployeeSql: (
      options: SupportEmployeeSqlOptions,
    ) => { sql: string; fields: string[] };
    buildSupportEmployeeValues: (
      vSup: RowDataPacket,
      options: SupportEmployeeSqlOptions,
    ) => unknown[];
  },
): Promise<void> => {
  const hasSupportLevel = await deps.hasSupportLevelColumn(conn);
  const supportSqlOptions: SupportEmployeeSqlOptions = { hasLevelColumn: hasSupportLevel };
  const { sql: supportSql } = deps.buildSupportEmployeeSql(supportSqlOptions);

  const [viewSupEmps] = await conn.query<RowDataPacket[]>(
    `SELECT ${deps.viewSupportColumns.map((column) => `s.${column}`).join(', ')}
     FROM (${deps.buildSupportViewQuery()}) s
     WHERE ${deps.citizenIdWhereBinary('s', '?')}
     LIMIT 1`,
    [citizenId],
  );
  const vSup = viewSupEmps[0];
  if (!vSup) return;
  const supportValues = deps.buildSupportEmployeeValues(vSup, supportSqlOptions);
  await conn.execute(supportSql, supportValues);
  stats.support_employees.upserted++;
};
