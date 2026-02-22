import bcrypt from 'bcryptjs';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';

const SALT_ROUNDS = 10;

type UserSyncSource = {
  profileStatus: string | null;
  supportEnable: number | null;
  fromProfile: boolean;
  fromSupport: boolean;
};

const isBcryptHash = (str: string): boolean => /^\$2[axy]\$\d{2}\$[A-Za-z0-9./]{53}$/.test(str);

const loadUserSources = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<Map<string, UserSyncSource>> => {
  const profileParams: string[] = [];
  const profileWhere = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) profileParams.push(options.citizenId);
  const [profileRows] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, original_status FROM emp_profiles ${profileWhere}`,
    profileParams,
  );

  const sourceMap = new Map<string, UserSyncSource>();
  for (const row of profileRows) {
    sourceMap.set(row.citizen_id, {
      profileStatus: row.original_status ?? null,
      supportEnable: null,
      fromProfile: true,
      fromSupport: false,
    });
  }

  const supportParams: string[] = [];
  const supportWhere = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) supportParams.push(options.citizenId);
  const [supportRows] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, is_currently_active FROM emp_support_staff ${supportWhere}`,
    supportParams,
  );
  for (const row of supportRows) {
    if (!row.citizen_id) continue;
    const existing = sourceMap.get(row.citizen_id);
    sourceMap.set(row.citizen_id, {
      profileStatus: existing?.profileStatus ?? null,
      supportEnable: row.is_currently_active ?? existing?.supportEnable ?? null,
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
): Promise<void> => {
  const finalPass = await resolvePasswordHash(passwordMap.get(citizenId));
  if (!finalPass) {
    stats.users.skipped++;
    console.warn(`[SyncService] Skipping user creation without password: citizen_id=${citizenId}`);
    return;
  }
  await conn.execute(
    `
      INSERT INTO users (citizen_id, password_hash, role, is_active)
      VALUES (?, ?, ?, ?)
    `,
    [citizenId, finalPass, 'USER', desiredActive ? 1 : 0],
  );
  stats.users.added++;
};

const updateExistingUserFromSource = async (
  conn: PoolConnection,
  dbUser: RowDataPacket,
  citizenId: string,
  desiredActive: boolean,
  passwordMap: Map<string, unknown>,
  stats: SyncStats,
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
  stats.users.updated++;
};

const deactivateMissingUsers = async (
  conn: PoolConnection,
  existingUsers: RowDataPacket[],
  sourceMap: Map<string, UserSyncSource>,
  stats: SyncStats,
  protectedRoles: Set<string>,
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
    stats.users.updated++;
  }
};

export const syncUsersFromProfilesAndSupport = async (
  conn: PoolConnection,
  stats: SyncStats,
  deps: {
    deriveUserIsActive: (profileStatus: string | null, supportEnable: number | null) => boolean;
    protectedRoles: Set<string>;
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
    const desiredActive = deps.deriveUserIsActive(source.profileStatus, source.supportEnable);
    const dbUser = userMap.get(citizenId);
    const shouldCreateUser = desiredActive || source.fromSupport;

    if (!dbUser) {
      if (!shouldCreateUser) {
        stats.users.skipped++;
        continue;
      }
      await createUserFromSource(conn, citizenId, desiredActive, passwordMap, stats);
      continue;
    }

    await updateExistingUserFromSource(conn, dbUser, citizenId, desiredActive, passwordMap, stats);
  }

  await deactivateMissingUsers(conn, existingUsers, sourceMap, stats, deps.protectedRoles, options);
};
