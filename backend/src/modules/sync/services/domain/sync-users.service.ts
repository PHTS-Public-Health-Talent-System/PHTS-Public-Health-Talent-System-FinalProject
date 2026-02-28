import bcrypt from 'bcryptjs';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';
import Logger from '@shared/utils/logger.js';

const SALT_ROUNDS = 10;
const log = Logger.create('SyncUsersService');

type UserSyncSource = {
  profileStatusCode: string | null;
  supportStatusCode: string | null;
  fromProfile: boolean;
  fromSupport: boolean;
};

const isBcryptHash = (str: string): boolean => /^\$2[axy]\$\d{2}\$[A-Za-z0-9./]{53}$/.test(str);

const insertUserSyncAudit = async (
  conn: PoolConnection,
  input: {
    syncBatchId: number | null;
    userId?: number | null;
    citizenId: string;
    action: 'CREATE' | 'ACTIVATE' | 'DEACTIVATE' | 'PASSWORD_FILLED' | 'DEACTIVATE_MISSING';
    beforeIsActive?: number | null;
    afterIsActive?: number | null;
    reason: string;
  },
): Promise<void> => {
  await conn.execute(
    `
      INSERT INTO user_sync_state_audits (
        sync_batch_id, user_id, citizen_id, action, before_is_active, after_is_active, reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.syncBatchId,
      input.userId ?? null,
      input.citizenId,
      input.action,
      input.beforeIsActive ?? null,
      input.afterIsActive ?? null,
      input.reason,
    ],
  );
};

const loadUserSources = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<Map<string, UserSyncSource>> => {
  const profileParams: string[] = [];
  const profileWhere = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) profileParams.push(options.citizenId);
  const [profileRows] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, status_code FROM emp_profiles ${profileWhere}`,
    profileParams,
  );

  const sourceMap = new Map<string, UserSyncSource>();
  for (const row of profileRows) {
    sourceMap.set(row.citizen_id, {
      profileStatusCode: row.status_code ?? null,
      supportStatusCode: null,
      fromProfile: true,
      fromSupport: false,
    });
  }

  const supportParams: string[] = [];
  const supportWhere = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) supportParams.push(options.citizenId);
  const [supportRows] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, status_code FROM emp_support_staff ${supportWhere}`,
    supportParams,
  );
  for (const row of supportRows) {
    if (!row.citizen_id) continue;
    const existing = sourceMap.get(row.citizen_id);
    sourceMap.set(row.citizen_id, {
      profileStatusCode: existing?.profileStatusCode ?? null,
      supportStatusCode: row.status_code ?? existing?.supportStatusCode ?? null,
      fromProfile: existing?.fromProfile ?? false,
      fromSupport: true,
    });
  }

  return sourceMap;
};

const resolvePasswordHash = async (rawPassword: unknown): Promise<string | null> => {
  if (!rawPassword) return null;
  let finalPass = String(rawPassword);
  if (!isBcryptHash(finalPass)) {
    finalPass = await bcrypt.hash(finalPass, SALT_ROUNDS);
  }
  return finalPass;
};

const loadPasswordMapFromHrms = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<Map<string, unknown>> => {
  const whereClause = options?.citizenId
    ? 'WHERE CAST(h.id AS BINARY) = CAST(? AS BINARY)'
    : '';
  const params = options?.citizenId ? [options.citizenId] : [];
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT CAST(h.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
             COALESCE(h.password, h.hash_password) AS password_value
      FROM hrms_databases.tb_ap_index_view h
      ${whereClause}
      `,
    params,
  );

  const map = new Map<string, unknown>();
  for (const row of rows) {
    if (!row.citizen_id) continue;
    if (row.password_value == null || String(row.password_value).trim() === '') continue;
    map.set(String(row.citizen_id), row.password_value);
  }
  return map;
};

const createUserFromSource = async (
  conn: PoolConnection,
  citizenId: string,
  desiredActive: boolean,
  passwordMap: Map<string, unknown>,
  stats: SyncStats,
  syncBatchId: number | null,
): Promise<void> => {
  const finalPass = await resolvePasswordHash(passwordMap.get(citizenId));
  if (!finalPass) {
    stats.users.skipped++;
    log.warn('Skipping user creation without password', { citizenId });
    return;
  }
  const [insertResult] = await conn.execute<ResultSetHeader>(
    `
      INSERT INTO users (citizen_id, password_hash, role, is_active)
      VALUES (?, ?, ?, ?)
    `,
    [citizenId, finalPass, 'USER', desiredActive ? 1 : 0],
  );
  await insertUserSyncAudit(conn, {
    syncBatchId,
    userId: Number(insertResult.insertId || 0) || null,
    citizenId,
    action: 'CREATE',
    beforeIsActive: null,
    afterIsActive: desiredActive ? 1 : 0,
    reason: 'created_from_sync_source',
  });
  stats.users.added++;
};

const updateExistingUserFromSource = async (
  conn: PoolConnection,
  dbUser: RowDataPacket,
  citizenId: string,
  desiredActive: boolean,
  passwordMap: Map<string, unknown>,
  stats: SyncStats,
  syncBatchId: number | null,
): Promise<void> => {
  let finalPass = String(dbUser.password_hash ?? '');
  let updatePassword = false;
  if (!finalPass || finalPass.length === 0) {
    const resolved = await resolvePasswordHash(passwordMap.get(citizenId));
    if (resolved) {
      finalPass = resolved;
      updatePassword = true;
    }
  }

  const needsUpdate = Number(dbUser.is_active) !== Number(desiredActive) || updatePassword;
  if (!needsUpdate) {
    stats.users.skipped++;
    return;
  }

  await conn.execute(
    `
      UPDATE users
      SET password_hash = ?, is_active = ?, updated_at = NOW()
      WHERE citizen_id = ?
    `,
    [finalPass, desiredActive ? 1 : 0, citizenId],
  );
  if (Number(dbUser.is_active) !== Number(desiredActive)) {
    await insertUserSyncAudit(conn, {
      syncBatchId,
      userId: Number(dbUser.id ?? 0) || null,
      citizenId,
      action: desiredActive ? 'ACTIVATE' : 'DEACTIVATE',
      beforeIsActive: Number(dbUser.is_active ?? 0),
      afterIsActive: desiredActive ? 1 : 0,
      reason: 'status_code_decision',
    });
  }
  if (updatePassword) {
    await insertUserSyncAudit(conn, {
      syncBatchId,
      userId: Number(dbUser.id ?? 0) || null,
      citizenId,
      action: 'PASSWORD_FILLED',
      beforeIsActive: Number(dbUser.is_active ?? 0),
      afterIsActive: desiredActive ? 1 : 0,
      reason: 'password_filled_from_hrms',
    });
  }
  stats.users.updated++;
};

const deactivateMissingUsers = async (
  conn: PoolConnection,
  existingUsers: RowDataPacket[],
  sourceMap: Map<string, UserSyncSource>,
  stats: SyncStats,
  protectedRoles: Set<string>,
  syncBatchId: number | null,
  options?: { citizenId?: string },
) => {
  for (const user of existingUsers) {
    if (options?.citizenId && user.citizen_id !== options.citizenId) continue;
    if (sourceMap.has(user.citizen_id)) continue;
    if (protectedRoles.has(String(user.role))) continue;
    if (Number(user.is_active) === 0) continue;

    await conn.execute('UPDATE users SET is_active = 0, updated_at = NOW() WHERE citizen_id = ?', [
      user.citizen_id,
    ]);
    await insertUserSyncAudit(conn, {
      syncBatchId,
      userId: Number(user.id ?? 0) || null,
      citizenId: String(user.citizen_id),
      action: 'DEACTIVATE_MISSING',
      beforeIsActive: Number(user.is_active ?? 1),
      afterIsActive: 0,
      reason: 'missing_from_profile_and_support_sources',
    });
    stats.users.updated++;
  }
};

export const syncUsersFromProfilesAndSupport = async (
  conn: PoolConnection,
  stats: SyncStats,
  deps: {
    deriveUserIsActive: (profileStatusCode: string | null, supportStatusCode: string | null) => boolean;
    protectedRoles: Set<string>;
    syncBatchId?: number | null;
  },
  options?: { citizenId?: string },
): Promise<void> => {
  console.log('[SyncService] Processing users (from profiles/support)...');

  const [existingUsers] = await conn.query<RowDataPacket[]>(
    'SELECT id, citizen_id, role, is_active, password_hash FROM users',
  );
  const userMap = new Map(existingUsers.map((u) => [u.citizen_id, u]));

  const passwordMap = await loadPasswordMapFromHrms(conn, options);
  const sourceMap = await loadUserSources(conn, options);

  for (const [citizenId, source] of sourceMap) {
    const desiredActive = deps.deriveUserIsActive(source.profileStatusCode, source.supportStatusCode);
    const dbUser = userMap.get(citizenId);
    const shouldCreateUser = desiredActive || source.fromSupport;

    if (!dbUser) {
      if (!shouldCreateUser) {
        stats.users.skipped++;
        continue;
      }
      await createUserFromSource(
        conn,
        citizenId,
        desiredActive,
        passwordMap,
        stats,
        deps.syncBatchId ?? null,
      );
      continue;
    }

    await updateExistingUserFromSource(
      conn,
      dbUser,
      citizenId,
      desiredActive,
      passwordMap,
      stats,
      deps.syncBatchId ?? null,
    );
  }

  await deactivateMissingUsers(
    conn,
    existingUsers,
    sourceMap,
    stats,
    deps.protectedRoles,
    deps.syncBatchId ?? null,
    options,
  );
};
