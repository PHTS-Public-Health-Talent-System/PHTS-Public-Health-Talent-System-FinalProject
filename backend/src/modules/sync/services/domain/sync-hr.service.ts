import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';
import {
  computeEmployeeProfileFingerprint,
  computeSupportProfileFingerprint,
} from '@/modules/sync/services/shared/sync-db-helpers.service.js';

type SupportEmployeeSqlOptions = {
  hasLevelColumn: boolean;
  hasOriginalStatusColumn?: boolean;
  hasStatusCodeColumn?: boolean;
  hasStatusTextColumn?: boolean;
  hasSourceSystemColumn?: boolean;
  hasSourceUpdatedAtColumn?: boolean;
  hasRawSnapshotColumn?: boolean;
  hasProfileFingerprintColumn?: boolean;
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
    persistEmployeeProfileSyncArtifacts?: (
      conn: PoolConnection,
      vEmp: RowDataPacket,
    ) => Promise<void>;
    clearScopeCache: (userId: number) => void;
  },
): Promise<void> => {
  console.log('[SyncService] Processing employees...');
  const [existingEmps] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, position_name, level, department, sub_department,
            special_position, original_status, is_currently_active, profile_fingerprint
     FROM emp_profiles`,
  );
  const empMap = new Map(existingEmps.map((e) => [e.citizen_id, e]));

  const [viewEmps] = await conn.query<RowDataPacket[]>(
    `SELECT ${deps.viewEmployeeColumns.map((column) => `e.${column}`).join(', ')}
     FROM (${deps.buildEmployeeViewQuery()}) e`,
  );

  for (const vEmp of viewEmps) {
    const dbEmp = empMap.get(vEmp.citizen_id);
    const incomingFingerprint = computeEmployeeProfileFingerprint(vEmp);
    const dbFingerprint = String(dbEmp?.profile_fingerprint ?? '');
    const hasFingerprint = dbFingerprint.length === 64;
    const specialChanged = dbEmp && deps.isChanged(dbEmp.special_position, vEmp.special_position);
    if (dbEmp && hasFingerprint && dbFingerprint === incomingFingerprint) {
      stats.employees.skipped++;
      continue;
    }

    if (
      dbEmp &&
      !hasFingerprint &&
      !deps.isChanged(dbEmp.position_name, vEmp.position_name) &&
      !deps.isChanged(dbEmp.level, vEmp.level) &&
      !deps.isChanged(dbEmp.department, vEmp.department) &&
      !deps.isChanged(dbEmp.sub_department, vEmp.sub_department) &&
      !deps.isChanged(dbEmp.original_status, vEmp.original_status) &&
      Number(dbEmp.is_currently_active ?? 0) === Number(vEmp.is_currently_active ?? 0) &&
      !specialChanged
    ) {
      stats.employees.skipped++;
      continue;
    }

    await deps.upsertEmployeeProfile(conn, vEmp);
    if (deps.persistEmployeeProfileSyncArtifacts) {
      await deps.persistEmployeeProfileSyncArtifacts(conn, vEmp);
    }
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
    hasSupportProfileFingerprintColumn?: (conn: PoolConnection) => Promise<boolean>;
    resolveSupportStaffColumnFlags?: (
      conn: PoolConnection,
    ) => Promise<SupportEmployeeSqlOptions>;
    buildSupportEmployeeSql: (
      options: SupportEmployeeSqlOptions,
    ) => { sql: string; fields: string[] };
    buildSupportEmployeeValues: (
      vSup: RowDataPacket,
      options: SupportEmployeeSqlOptions,
    ) => unknown[];
    persistSupportProfileSyncArtifacts?: (
      conn: PoolConnection,
      vSup: RowDataPacket,
    ) => Promise<void>;
    clearScopeCache: (userId: number) => void;
  },
): Promise<void> => {
  console.log('[SyncService] Processing support employees...');

  const supportFlags = deps.resolveSupportStaffColumnFlags
    ? await deps.resolveSupportStaffColumnFlags(conn)
    : { hasLevelColumn: await deps.hasSupportLevelColumn(conn) };
  const hasSupportLevel = supportFlags.hasLevelColumn;
  const hasSupportFingerprint =
    typeof supportFlags.hasProfileFingerprintColumn === 'boolean'
      ? supportFlags.hasProfileFingerprintColumn
      : deps.hasSupportProfileFingerprintColumn
        ? await deps.hasSupportProfileFingerprintColumn(conn)
        : false;

  const sqlOptions: SupportEmployeeSqlOptions = {
    ...supportFlags,
    hasLevelColumn: hasSupportLevel,
    hasProfileFingerprintColumn: hasSupportFingerprint,
  };
  const { sql } = deps.buildSupportEmployeeSql(sqlOptions);

  const existingColumns = [
    'citizen_id',
    'title',
    'first_name',
    'last_name',
    'position_name',
    ...(hasSupportLevel ? ['level'] : []),
    'special_position',
    'emp_type',
    'department',
    ...(supportFlags.hasStatusTextColumn ? ['status_text AS original_status'] : []),
    'is_currently_active',
    ...(hasSupportFingerprint ? ['profile_fingerprint'] : []),
  ];
  const [existingSupEmps] = await conn.query<RowDataPacket[]>(
    `SELECT ${existingColumns.join(', ')} FROM emp_support_staff`,
  );
  const supEmpMap = new Map(existingSupEmps.map((e) => [e.citizen_id, e]));

  const [viewSupEmps] = await conn.query<RowDataPacket[]>(
    `SELECT ${deps.viewSupportColumns.map((column) => `s.${column}`).join(', ')}
     FROM (${deps.buildSupportViewQuery()}) s`,
  );

  for (const vSup of viewSupEmps) {
    const dbSup = supEmpMap.get(vSup.citizen_id);
    const incomingFingerprint = computeSupportProfileFingerprint(vSup);
    const dbFingerprint = String(dbSup?.profile_fingerprint ?? '');
    const useFingerprint = hasSupportFingerprint && dbFingerprint.length === 64;

    const supportSpecialChanged = dbSup && deps.isChanged(dbSup.special_position, vSup.special_position);
    if (dbSup && useFingerprint && dbFingerprint === incomingFingerprint) {
      stats.support_employees.skipped++;
      continue;
    }
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
      !deps.isChanged(dbSup.original_status, vSup.original_status) &&
      Number(dbSup.is_currently_active) === Number(vSup.is_currently_active)
    ) {
      stats.support_employees.skipped++;
      continue;
    }

    const values = deps.buildSupportEmployeeValues(vSup, sqlOptions);
    await conn.execute(sql, values);
    if (deps.persistSupportProfileSyncArtifacts) {
      await deps.persistSupportProfileSyncArtifacts(conn, vSup);
    }
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
    isChanged: (oldVal: unknown, newVal: unknown) => boolean;
    upsertEmployeeProfile: (conn: PoolConnection, vEmp: RowDataPacket) => Promise<void>;
    persistEmployeeProfileSyncArtifacts?: (
      conn: PoolConnection,
      vEmp: RowDataPacket,
    ) => Promise<void>;
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

  const [existingRows] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, position_name, level, department, sub_department,
            special_position, original_status, is_currently_active, profile_fingerprint
     FROM emp_profiles
     WHERE citizen_id = ?
     LIMIT 1`,
    [citizenId],
  );
  const dbEmp = existingRows[0];
  const incomingFingerprint = computeEmployeeProfileFingerprint(vEmp);
  const dbFingerprint = String(dbEmp?.profile_fingerprint ?? '');
  const hasFingerprint = dbFingerprint.length === 64;
  if (dbEmp && hasFingerprint && dbFingerprint === incomingFingerprint) {
    stats.employees.skipped++;
    return;
  }

  if (
    dbEmp &&
    !hasFingerprint &&
    !deps.isChanged(dbEmp.position_name, vEmp.position_name) &&
    !deps.isChanged(dbEmp.level, vEmp.level) &&
    !deps.isChanged(dbEmp.department, vEmp.department) &&
    !deps.isChanged(dbEmp.sub_department, vEmp.sub_department) &&
    !deps.isChanged(dbEmp.original_status, vEmp.original_status) &&
    Number(dbEmp.is_currently_active ?? 0) === Number(vEmp.is_currently_active ?? 0) &&
    !deps.isChanged(dbEmp.special_position, vEmp.special_position)
  ) {
    stats.employees.skipped++;
    return;
  }

  await deps.upsertEmployeeProfile(conn, vEmp);
  if (deps.persistEmployeeProfileSyncArtifacts) {
    await deps.persistEmployeeProfileSyncArtifacts(conn, vEmp);
  }
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
    hasSupportProfileFingerprintColumn?: (conn: PoolConnection) => Promise<boolean>;
    resolveSupportStaffColumnFlags?: (
      conn: PoolConnection,
    ) => Promise<SupportEmployeeSqlOptions>;
    buildSupportEmployeeSql: (
      options: SupportEmployeeSqlOptions,
    ) => { sql: string; fields: string[] };
    buildSupportEmployeeValues: (
      vSup: RowDataPacket,
      options: SupportEmployeeSqlOptions,
    ) => unknown[];
    isChanged?: (oldVal: unknown, newVal: unknown) => boolean;
    persistSupportProfileSyncArtifacts?: (
      conn: PoolConnection,
      vSup: RowDataPacket,
    ) => Promise<void>;
  },
): Promise<void> => {
  const supportFlags = deps.resolveSupportStaffColumnFlags
    ? await deps.resolveSupportStaffColumnFlags(conn)
    : { hasLevelColumn: await deps.hasSupportLevelColumn(conn) };
  const hasSupportLevel = supportFlags.hasLevelColumn;
  const hasSupportFingerprint =
    typeof supportFlags.hasProfileFingerprintColumn === 'boolean'
      ? supportFlags.hasProfileFingerprintColumn
      : deps.hasSupportProfileFingerprintColumn
        ? await deps.hasSupportProfileFingerprintColumn(conn)
        : false;
  const supportSqlOptions: SupportEmployeeSqlOptions = {
    ...supportFlags,
    hasLevelColumn: hasSupportLevel,
    hasProfileFingerprintColumn: hasSupportFingerprint,
  };
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

  const existingColumns = [
    'citizen_id',
    'title',
    'first_name',
    'last_name',
    'position_name',
    ...(hasSupportLevel ? ['level'] : []),
    'special_position',
    'emp_type',
    'department',
    ...(supportFlags.hasStatusTextColumn ? ['status_text AS original_status'] : []),
    'is_currently_active',
    ...(hasSupportFingerprint ? ['profile_fingerprint'] : []),
  ];
  const [existingRows] = await conn.query<RowDataPacket[]>(
    `SELECT ${existingColumns.join(', ')}
     FROM emp_support_staff
     WHERE citizen_id = ?
     LIMIT 1`,
    [citizenId],
  );
  const dbSup = existingRows[0];
  const incomingFingerprint = computeSupportProfileFingerprint(vSup);
  const dbFingerprint = String(dbSup?.profile_fingerprint ?? '');
  const useFingerprint = hasSupportFingerprint && dbFingerprint.length === 64;
  const isChanged = deps.isChanged ?? ((oldVal, newVal) => String(oldVal ?? '') !== String(newVal ?? ''));
  if (dbSup && useFingerprint && dbFingerprint === incomingFingerprint) {
    stats.support_employees.skipped++;
    return;
  }
  if (
    dbSup &&
    !isChanged(dbSup.title, vSup.title) &&
    !isChanged(dbSup.first_name, vSup.first_name) &&
    !isChanged(dbSup.last_name, vSup.last_name) &&
    !isChanged(dbSup.position_name, vSup.position_name) &&
    (!hasSupportLevel || !isChanged(dbSup.level, vSup.level)) &&
    !isChanged(dbSup.special_position, vSup.special_position) &&
    !isChanged(dbSup.emp_type, vSup.employee_type) &&
    !isChanged(dbSup.department, vSup.department) &&
    !isChanged(dbSup.original_status, vSup.original_status) &&
    Number(dbSup.is_currently_active ?? 0) === Number(vSup.is_currently_active ?? 0)
  ) {
    stats.support_employees.skipped++;
    return;
  }

  const supportValues = deps.buildSupportEmployeeValues(vSup, supportSqlOptions);
  await conn.execute(supportSql, supportValues);
  if (deps.persistSupportProfileSyncArtifacts) {
    await deps.persistSupportProfileSyncArtifacts(conn, vSup);
  }
  stats.support_employees.upserted++;
};
