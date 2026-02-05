import bcrypt from "bcryptjs";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';
import redis from '@config/redis.js';
import { assignRoles } from '@/modules/system/services/roleAssignmentService.js';
import { clearScopeCache } from '@/modules/request/scope/scope.service.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js';
import {
  parseSpecialPositionScopes,
  removeOverlaps,
  inferScopeType,
} from '@/modules/request/scope/utils.js';

const SALT_ROUNDS = 10;
const SYNC_LOCK_KEY = "system:sync:lock";
const SYNC_RESULT_KEY = "system:sync:last_result";
const LOCK_TTL_SECONDS = 300; // 5 minutes
const RESULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// Convert undefined to null for safe DB inserts.
const toNull = (val: any) => (val === undefined ? null : val);

// Check bcrypt hash format ($2a/$2b/$2y).
const isBcryptHash = (str: string): boolean =>
  /^\$2[axy]\$\d{2}\$[A-Za-z0-9./]{53}$/.test(str);

const toDateOnly = (value: any): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isActiveOriginalStatus = (status: string | null): boolean => {
  if (!status) return false;
  return status.trim().startsWith("ปฏิบัติงาน");
};

// Detect value change with support for dates and nullish values.
const isChanged = (oldVal: any, newVal: any) => {
  const oldDate = toDateOnly(oldVal);
  const newDate = toDateOnly(newVal);
  if (oldDate || newDate) {
    return oldDate !== newDate;
  }
  if (typeof oldVal === "number" && typeof newVal === "string") {
    return oldVal !== Number.parseFloat(newVal);
  }
  return String(oldVal ?? "") !== String(newVal ?? "");
};

type SyncStats = {
  users: { added: number; updated: number; skipped: number };
  employees: { upserted: number; skipped: number };
  support_employees: { upserted: number; skipped: number };
  signatures: { added: number; skipped: number };
  licenses: { upserted: number };
  quotas: { upserted: number };
  leaves: { upserted: number; skipped: number };
  movements: { added: number };
  roles: { updated: number; skipped: number; missing: number };
};

type UserSyncDecision = {
  finalPass: string | null;
  shouldHash: boolean;
  roleForInsert: string;
};

const syncUsers = async (conn: PoolConnection, stats: SyncStats) => {
  console.log("[SyncService] Processing users...");
  const [existingUsers] = await conn.query<RowDataPacket[]>(
    "SELECT id, citizen_id, role, is_active, password_hash FROM users",
  );
  const userMap = new Map(existingUsers.map((u) => [u.citizen_id, u]));
  const userIdMap = new Map(existingUsers.map((u) => [u.citizen_id, u.id]));

  const [viewUsers] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM vw_hrms_users_sync",
  );

  for (const vUser of viewUsers) {
    const dbUser = userMap.get(vUser.citizen_id);
    const decision = evaluateUserSync(dbUser, vUser, stats);
    if (!decision) continue;

    let { finalPass } = decision;
    if (decision.shouldHash && finalPass && !isBcryptHash(String(finalPass))) {
      finalPass = await bcrypt.hash(String(finalPass), SALT_ROUNDS);
    }

    await conn.execute(
      `
          INSERT INTO users (citizen_id, password_hash, role, is_active)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            password_hash = VALUES(password_hash),
            is_active = VALUES(is_active),
            updated_at = NOW()
        `,
      [vUser.citizen_id, finalPass, decision.roleForInsert, vUser.is_active],
    );
  }

  return userIdMap;
};

function evaluateUserSync(
  dbUser: RowDataPacket | undefined,
  vUser: RowDataPacket,
  stats: SyncStats,
): UserSyncDecision | null {
  if (!dbUser) {
    stats.users.added++;
    return {
      finalPass: vUser.plain_password,
      shouldHash: true,
      roleForInsert: "USER",
    };
  }

  let needsUpdate = false;
  let finalPass = vUser.plain_password;
  let shouldHash = true;

  if (dbUser.role !== vUser.role) needsUpdate = true;
  if (Number(dbUser.is_active) !== Number(vUser.is_active)) {
    needsUpdate = true;
  }

  if (dbUser.password_hash && dbUser.password_hash.length > 0) {
    shouldHash = false;
    finalPass = dbUser.password_hash;
  } else {
    needsUpdate = true;
  }

  if (!needsUpdate) {
    stats.users.skipped++;
    return null;
  }

  stats.users.updated++;
  return {
    finalPass,
    shouldHash,
    roleForInsert: dbUser.role || "USER",
  };
}

const syncEmployees = async (
  conn: PoolConnection,
  stats: SyncStats,
  userIdMap: Map<string, number>,
) => {
  console.log("[SyncService] Processing employees...");
  const [existingEmps] = await conn.query<RowDataPacket[]>(
    "SELECT citizen_id, position_name, level, department, special_position FROM emp_profiles",
  );
  const empMap = new Map(existingEmps.map((e) => [e.citizen_id, e]));

  const [viewEmps] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM vw_hrms_employees",
  );

  for (const vEmp of viewEmps) {
    const dbEmp = empMap.get(vEmp.citizen_id);
    const specialChanged =
      dbEmp && isChanged(dbEmp.special_position, vEmp.special_position);
    if (
      dbEmp &&
      !isChanged(dbEmp.position_name, vEmp.position_name) &&
      !isChanged(dbEmp.level, vEmp.level) &&
      !isChanged(dbEmp.department, vEmp.department) &&
      !specialChanged
    ) {
      stats.employees.skipped++;
      continue;
    }

    await conn.execute(
      `
          INSERT INTO emp_profiles (
            citizen_id, title, first_name, last_name, sex, birth_date,
            position_name, position_number, level, special_position, emp_type,
            department, sub_department, mission_group, specialist, expert,
            start_work_date, first_entry_date, original_status, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            position_name = VALUES(position_name),
            level = VALUES(level),
            special_position = VALUES(special_position),
            department = VALUES(department),
            sub_department = VALUES(sub_department),
            specialist = VALUES(specialist),
            expert = VALUES(expert),
            last_synced_at = NOW()
        `,
      [
        vEmp.citizen_id,
        vEmp.title,
        vEmp.first_name,
        vEmp.last_name,
        vEmp.sex,
        vEmp.birth_date,
        vEmp.position_name,
        vEmp.position_number,
        vEmp.level,
        (vEmp.special_position || "").substring(0, 65535),
        vEmp.employee_type,
        vEmp.department,
        vEmp.sub_department,
        vEmp.mission_group,
        vEmp.specialist,
        vEmp.expert,
        vEmp.start_current_position,
        vEmp.first_entry_date,
        vEmp.original_status,
      ],
    );
    stats.employees.upserted++;

    const userId = userIdMap.get(vEmp.citizen_id);
    if (specialChanged && userId !== undefined) {
      clearScopeCache(userId);
    }
  }
};

const syncSupportEmployees = async (
  conn: PoolConnection,
  stats: SyncStats,
  userIdMap: Map<string, number>,
) => {
  console.log("[SyncService] Processing support employees...");

  const [existingSupEmps] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id, title, first_name, last_name, position_name,
            level, special_position, emp_type, department,
            is_currently_active
     FROM emp_support_staff`,
  );
  const supEmpMap = new Map(existingSupEmps.map((e) => [e.citizen_id, e]));

  const [viewSupEmps] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM vw_hrms_support_staff",
  );

  for (const vSup of viewSupEmps) {
    const dbSup = supEmpMap.get(vSup.citizen_id);

    const supportSpecialChanged =
      dbSup && isChanged(dbSup.special_position, vSup.special_position);
    if (
      dbSup &&
      !isChanged(dbSup.title, vSup.title) &&
      !isChanged(dbSup.first_name, vSup.first_name) &&
      !isChanged(dbSup.last_name, vSup.last_name) &&
      !isChanged(dbSup.position_name, vSup.position_name) &&
      !isChanged(dbSup.level, vSup.level) &&
      !supportSpecialChanged &&
      !isChanged(dbSup.emp_type, vSup.employee_type) &&
      !isChanged(dbSup.department, vSup.department) &&
      Number(dbSup.is_currently_active) === Number(vSup.is_currently_active)
    ) {
      stats.support_employees.skipped++;
      continue;
    }

    await conn.execute(
      `
          INSERT INTO emp_support_staff (
            citizen_id, title, first_name, last_name,
            position_name, level, special_position, emp_type,
            department, is_currently_active, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            position_name = VALUES(position_name),
            level = VALUES(level),
            special_position = VALUES(special_position),
            emp_type = VALUES(emp_type),
            department = VALUES(department),
            is_currently_active = VALUES(is_currently_active),
            last_synced_at = NOW()
        `,
      [
        toNull(vSup.citizen_id),
        toNull(vSup.title),
        toNull(vSup.first_name),
        toNull(vSup.last_name),
        toNull(vSup.position_name),
        toNull(vSup.level),
        toNull(vSup.special_position),
        toNull(vSup.employee_type),
        toNull(vSup.department),
        toNull(vSup.is_currently_active),
      ],
    );
    stats.support_employees.upserted++;

    const userId = userIdMap.get(vSup.citizen_id);
    if (supportSpecialChanged && userId !== undefined) {
      clearScopeCache(userId);
    }
  }
};

const syncSignatures = async (conn: PoolConnection, stats: SyncStats) => {
  console.log("[SyncService] Processing signatures...");
  const [existingSigs] = await conn.query<RowDataPacket[]>(
    "SELECT user_id FROM sig_images",
  );
  const sigSet = new Set(existingSigs.map((s) => s.user_id));

  const [viewSigs] = await conn.query<RowDataPacket[]>(
    `
        SELECT u.id as user_id, s.signature_blob
        FROM vw_hrms_signatures s
        JOIN users u ON CONVERT(s.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      `,
  );

  for (const vSig of viewSigs) {
    if (sigSet.has(vSig.user_id)) {
      stats.signatures.skipped++;
      continue;
    }
    await conn.execute(
      `
          INSERT INTO sig_images (user_id, signature_image, updated_at) VALUES (?, ?, NOW())
        `,
      [vSig.user_id, vSig.signature_blob],
    );
    stats.signatures.added++;
  }
};

const syncLicensesAndQuotas = async (
  conn: PoolConnection,
  stats: SyncStats,
) => {
  console.log("[SyncService] Processing licenses and quotas...");
  await conn.query(`
        INSERT INTO emp_licenses (citizen_id, license_no, valid_from, valid_until, status, synced_at)
        SELECT l.citizen_id, l.license_no, l.valid_from, l.valid_until, l.status, NOW()
        FROM vw_hrms_licenses l
        JOIN users u ON CONVERT(l.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
        ON DUPLICATE KEY UPDATE valid_from=VALUES(valid_from), valid_until=VALUES(valid_until), status=VALUES(status), synced_at=NOW()
      `);

  const [viewQuotas] = await conn.query<RowDataPacket[]>(
    `
        SELECT q.citizen_id, q.fiscal_year, q.total_quota
        FROM vw_hrms_leave_quotas q
        JOIN users u ON CONVERT(q.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      `,
  );
  for (const q of viewQuotas) {
    await conn.execute(
      `
          INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_vacation, updated_at)
          VALUES (?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE quota_vacation = VALUES(quota_vacation), updated_at = NOW()
        `,
      [q.citizen_id, q.fiscal_year, q.total_quota],
    );
    stats.quotas.upserted++;
  }
};

const syncLeaves = async (conn: PoolConnection, stats: SyncStats) => {
  console.log("[SyncService] Processing leave requests...");
  const [statusCols] = await conn.query<RowDataPacket[]>(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'leave_records'
       AND COLUMN_NAME = 'status'
     LIMIT 1`,
  );
  const hasStatusColumn = statusCols.length > 0;

  const existingSelect = hasStatusColumn
    ? "SELECT ref_id, status, start_date, end_date, is_no_pay FROM leave_records WHERE ref_id IS NOT NULL"
    : "SELECT ref_id, start_date, end_date, is_no_pay FROM leave_records WHERE ref_id IS NOT NULL";

  const [existingLeaves] = await conn.query<RowDataPacket[]>(existingSelect);
  const leaveMap = new Map(existingLeaves.map((l) => [l.ref_id, l]));

  const [viewLeaves] = await conn.query<RowDataPacket[]>(
    `
        SELECT lr.* FROM vw_hrms_leave_requests lr
        JOIN users u ON CONVERT(lr.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      `,
  );

  for (const vLeave of viewLeaves) {
    if (!vLeave.ref_id) continue;
    const dbLeave = leaveMap.get(vLeave.ref_id);

    if (dbLeave) {
      const dateChanged =
        isChanged(dbLeave.start_date, vLeave.start_date) ||
        isChanged(dbLeave.end_date, vLeave.end_date);
      const statusChanged = hasStatusColumn
        ? isChanged(dbLeave.status, vLeave.status)
        : false;
      const noPayChanged = isChanged(dbLeave.is_no_pay, vLeave.is_no_pay);
      if (!dateChanged && !statusChanged && !noPayChanged) {
        stats.leaves.skipped++;
        continue;
      }
    }

    if (hasStatusColumn) {
      await conn.execute(
        `
            INSERT INTO leave_records (
              ref_id, citizen_id, leave_type, start_date, end_date,
              duration_days, fiscal_year, remark, status, is_no_pay, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              start_date = VALUES(start_date),
              end_date = VALUES(end_date),
              duration_days = VALUES(duration_days),
              is_no_pay = VALUES(is_no_pay),
              synced_at = NOW()
          `,
        [
          toNull(vLeave.ref_id),
          toNull(vLeave.citizen_id),
          toNull(vLeave.leave_type),
          toNull(vLeave.start_date),
          toNull(vLeave.end_date),
          toNull(vLeave.duration_days),
          toNull(vLeave.fiscal_year),
          toNull(vLeave.remark),
          toNull(vLeave.status),
          toNull(vLeave.is_no_pay ?? 0),
        ],
      );
    } else {
      await conn.execute(
        `
            INSERT INTO leave_records (
              ref_id, citizen_id, leave_type, start_date, end_date,
              duration_days, fiscal_year, remark, is_no_pay, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              start_date = VALUES(start_date),
              end_date = VALUES(end_date),
              duration_days = VALUES(duration_days),
              is_no_pay = VALUES(is_no_pay),
              synced_at = NOW()
          `,
        [
          toNull(vLeave.ref_id),
          toNull(vLeave.citizen_id),
          toNull(vLeave.leave_type),
          toNull(vLeave.start_date),
          toNull(vLeave.end_date),
          toNull(vLeave.duration_days),
          toNull(vLeave.fiscal_year),
          toNull(vLeave.remark),
          toNull(vLeave.is_no_pay ?? 0),
        ],
      );
    }
    stats.leaves.upserted++;
  }
};

const syncMovements = async (conn: PoolConnection, _stats: SyncStats) => {
  console.log("[SyncService] Processing movements...");
  await conn.query(`
        INSERT INTO emp_movements (citizen_id, movement_type, effective_date, remark, synced_at)
        SELECT m.citizen_id, m.movement_type, m.effective_date, m.remark, NOW()
        FROM vw_hrms_movements m
        JOIN users u ON CONVERT(m.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
        ON DUPLICATE KEY UPDATE
          movement_type = VALUES(movement_type),
          effective_date = VALUES(effective_date),
          remark = VALUES(remark),
          synced_at = NOW()
      `);
};

const buildScopesFromSpecialPosition = (specialPosition: string | null) => {
  if (!specialPosition) return { wardScopes: [], deptScopes: [] };
  const allScopes = parseSpecialPositionScopes(specialPosition);
  const wardScopes: string[] = [];
  const deptScopes: string[] = [];

  for (const scope of allScopes) {
    const isHeadWard =
      scope.includes("หัวหน้าตึก") || scope.includes("หัวหน้างาน-");
    const isHeadDept = scope.includes("หัวหน้ากลุ่มงาน");

    if (isHeadWard) {
      const parts = scope.split("-");
      const scopeName =
        parts.length > 1 ? parts.slice(1).join("-").trim() : scope.trim();
      if (scopeName && inferScopeType(scopeName) !== "IGNORE") {
        wardScopes.push(scopeName);
        if (inferScopeType(scopeName) === "DEPT") {
          deptScopes.push(scopeName);
        }
      }
      continue;
    }

    if (isHeadDept) {
      const parts = scope.split("-");
      const scopeName =
        parts.length > 1 ? parts.slice(1).join("-").trim() : scope.trim();
      if (scopeName && inferScopeType(scopeName) !== "IGNORE") {
        deptScopes.push(scopeName);
      }
      continue;
    }
  }

  const cleanedWardScopes = removeOverlaps(wardScopes, deptScopes);
  const uniqWard = Array.from(new Set(cleanedWardScopes.map((s) => s.trim())));
  const uniqDept = Array.from(new Set(deptScopes.map((s) => s.trim())));
  return { wardScopes: uniqWard, deptScopes: uniqDept };
};

const syncSpecialPositionScopes = async (conn: PoolConnection) => {
  console.log("[SyncService] Processing special_position scope mapping...");

  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT u.id AS user_id,
             u.citizen_id,
             u.role,
             e.special_position,
             e.original_status,
             s.is_currently_active AS support_active
      FROM users u
      LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
      WHERE u.role IN ('HEAD_WARD','HEAD_DEPT')
    `,
  );

  for (const row of rows) {
    const citizenId = row.citizen_id as string;
    const role = row.role as string;
    const specialPosition = row.special_position as string | null;
    const originalStatus = row.original_status as string | null;
    const supportActive = row.support_active as number | null;

    const isActive =
      isActiveOriginalStatus(originalStatus) ||
      Number(supportActive) === 1;

    if (!isActive) {
      await requestRepository.disableScopeMappings(citizenId, role, conn);
      continue;
    }

    const scopes = buildScopesFromSpecialPosition(specialPosition);

    await requestRepository.disableScopeMappings(citizenId, role, conn);

    if (scopes.wardScopes.length === 0 && scopes.deptScopes.length === 0) {
      console.warn(
        `[SyncService] special_position parse failed: citizen_id=${citizenId}, role=${role}, special_position="${specialPosition ?? ""}"`,
      );
      continue;
    }

    const inputs = [
      ...scopes.wardScopes.map((scopeName) => ({
        citizen_id: citizenId,
        role,
        scope_type: "UNIT" as const,
        scope_name: scopeName,
        source: "AUTO" as const,
      })),
      ...scopes.deptScopes.map((scopeName) => ({
        citizen_id: citizenId,
        role,
        scope_type: "DEPT" as const,
        scope_name: scopeName,
        source: "AUTO" as const,
      })),
    ];

    await requestRepository.insertScopeMappings(inputs, conn);

    const userId = row.user_id as number;
    if (userId) {
      clearScopeCache(userId);
    }
  }
};

export class SyncService {
  /**
   * Return cached status (fast path for dashboards).
   */
  static async getLastSyncStatus() {
    const [data, lock] = await Promise.all([
      redis.get(SYNC_RESULT_KEY),
      redis.get(SYNC_LOCK_KEY),
    ]);
    return {
      isSyncing: Boolean(lock),
      lastResult: data ? JSON.parse(data) : null,
    };
  }

  /**
   * Run the full smart sync workflow with distributed lock + status caching.
   */
  static async performFullSync() {
    console.log("[SyncService] Requesting synchronization...");

    const lockValue = `lock:${Date.now()}`;
    const locked = await redis.set(
      SYNC_LOCK_KEY,
      lockValue,
      "EX",
      LOCK_TTL_SECONDS,
      "NX",
    );
    if (!locked) {
      console.warn(
        "[SyncService] Synchronization aborted: already in progress.",
      );
      throw new Error("Synchronization is already in progress. Please wait.");
    }

    const startTotal = Date.now();
    const stats = {
      users: { added: 0, updated: 0, skipped: 0 },
      employees: { upserted: 0, skipped: 0 },
      support_employees: { upserted: 0, skipped: 0 },
      signatures: { added: 0, skipped: 0 },
      licenses: { upserted: 0 },
      quotas: { upserted: 0 },
      leaves: { upserted: 0, skipped: 0 },
      movements: { added: 0 },
      roles: { updated: 0, skipped: 0, missing: 0 },
    };

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      const userIdMap = await syncUsers(conn, stats);
      await syncEmployees(conn, stats, userIdMap);
      await syncSupportEmployees(conn, stats, userIdMap);
      await syncSignatures(conn, stats);
      await syncLicensesAndQuotas(conn, stats);
      await syncLeaves(conn, stats);
      await syncMovements(conn, stats);
      await syncSpecialPositionScopes(conn);

      await conn.commit();

      // 7. Assign roles based on HR data (after commit)
      console.log("[SyncService] Assigning roles based on HR data...");
      try {
        const roleResult = await assignRoles();
        stats.roles = roleResult;
        console.log(
          `[SyncService] Role assignment: ${roleResult.updated} updated, ${roleResult.skipped} skipped`,
        );
      } catch (roleError) {
        console.warn(
          "[SyncService] Role assignment failed (non-fatal):",
          roleError instanceof Error ? roleError.message : roleError,
        );
        // We do not throw here to allow the overall sync to maintain "success" state
        // since the data sync part (users, employees, etc.) was successfully committed.
      }

      const duration = ((Date.now() - startTotal) / 1000).toFixed(2);
      const resultData = {
        success: true,
        duration,
        stats,
        timestamp: new Date().toISOString(),
      };

      console.log(`[SyncService] Synchronization completed in ${duration}s`);

      await redis.set(
        SYNC_RESULT_KEY,
        JSON.stringify(resultData),
        "EX",
        RESULT_TTL_SECONDS,
      );

      return resultData;
    } catch (error) {
      await conn.rollback();
      console.error("[SyncService] Synchronization failed:", error);
      throw error;
    } finally {
      await SyncService.releaseLock(lockValue);
      conn.release();
    }
  }

  private static async releaseLock(lockValue: string) {
    try {
      const current = await redis.get(SYNC_LOCK_KEY);
      if (current === lockValue) {
        await redis.del(SYNC_LOCK_KEY);
      }
    } catch (err) {
      console.error("[SyncService] Failed to release sync lock:", err);
    }
  }
}
