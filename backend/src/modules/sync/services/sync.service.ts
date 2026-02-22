import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import db from '@config/database.js';
import {
  assignRoles,
  RoleAssignmentService,
} from '@/modules/sync/services/role-assignment.service.js';
import { clearScopeCache } from '@/modules/request/scope/scope.service.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';
import {
  parseSpecialPositionScopes,
  removeOverlaps,
  inferScopeType,
} from '@/modules/request/scope/utils.js';
import { applyImmediateMovementEligibilityCutoff } from '@/modules/workforce-compliance/services/immediate-rules.service.js';
import type { SyncRuntimeStatus, SyncStats } from '@/modules/sync/services/shared/sync.types.js';
import { createSyncStats } from '@/modules/sync/services/shared/sync-stats.service.js';
import {
  acquireSyncLock,
  createSyncLockValue,
  getLastSyncStatus as getSyncStatusFromCache,
  releaseSyncLock,
  setLastSyncResult,
  startSyncLockHeartbeat,
} from '@/modules/sync/services/shared/sync-lock.service.js';
import {
  hasLeaveStatusColumn,
  hasSupportLevelColumn,
  upsertEmployeeProfile,
  upsertLeaveQuota,
} from '@/modules/sync/services/shared/sync-db-helpers.service.js';
import { syncUsersFromProfilesAndSupport } from '@/modules/sync/services/domain/sync-users.service.js';
import {
  syncEmployees,
  syncSupportEmployees,
  upsertSingleEmployeeProfile,
  upsertSingleSupportEmployee,
} from '@/modules/sync/services/domain/sync-hr.service.js';
import {
  syncSignatures as runDomainSignaturesSync,
  syncLicensesAndQuotas as runDomainLicensesAndQuotasSync,
  syncLeaves as runDomainLeavesSync,
  syncMovements as runDomainMovementsSync,
  syncSingleSignature as runSingleSignatureSync,
  syncSingleLicenses as runSingleLicensesSync,
  syncSingleQuotas as runSingleQuotasSync,
  syncSingleLeaves as runSingleLeavesSync,
  syncSingleMovements as runSingleMovementsSync,
} from '@/modules/sync/services/domain/sync-domain.service.js';
import {
  buildScopesFromSpecialPosition as buildScopesFromSpecialPositionBase,
  syncSpecialPositionScopes as runScopeSync,
  syncSpecialPositionScopesForCitizen as runScopeSyncForCitizen,
} from '@/modules/sync/services/domain/sync-scope.service.js';
import { assignRoleForSingleUser as assignRoleForSingleUserBase } from '@/modules/sync/services/domain/sync-role.service.js';


export const VIEW_EMPLOYEE_COLUMNS = [
  'citizen_id',
  'title',
  'first_name',
  'last_name',
  'sex',
  'birth_date',
  'position_name',
  'position_number',
  'level',
  'special_position',
  'employee_type',
  'start_current_position',
  'first_entry_date',
  'mission_group',
  'department',
  'sub_department',
  'specialist',
  'expert',
  'original_status',
  'is_currently_active',
] as const;

export const VIEW_SUPPORT_COLUMNS = [
  'citizen_id',
  'title',
  'first_name',
  'last_name',
  'sex',
  'position_name',
  'position_number',
  'special_position',
  'employee_type',
  'start_current_position',
  'first_entry_date',
  'mission_group',
  'department',
  'is_currently_active',
] as const;

export const VIEW_LEAVE_COLUMNS = [
  'ref_id',
  'citizen_id',
  'leave_type',
  'start_date',
  'end_date',
  'duration_days',
  'fiscal_year',
  'remark',
  'status',
] as const;

export const citizenIdJoinBinary = (leftAlias: string, rightAlias: string) =>
  `CAST(${leftAlias}.citizen_id AS BINARY) = CAST(${rightAlias}.citizen_id AS BINARY)`;

export const citizenIdWhereBinary = (alias: string, placeholder: string) =>
  `CAST(${alias}.citizen_id AS BINARY) = CAST(${placeholder} AS BINARY)`;

export const selectColumns = (alias: string, columns: readonly string[]) =>
  columns.map((column) => `${alias}.${column}`).join(', ');

export const citizenIdSelectUtf8 = (alias: string) =>
  `CAST(${alias}.citizen_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci`;

export const binaryEquals = (leftExpr: string, rightExpr: string) =>
  `CAST(${leftExpr} AS BINARY) = CAST(${rightExpr} AS BINARY)`;

export const buildLicensesViewQuery = () => `
  INSERT INTO emp_licenses (citizen_id, license_name, license_no, valid_from, valid_until, status, synced_at)
  SELECT l.citizen_id,
         l.license_name,
         l.license_no,
         l.valid_from,
         CAST(l.valid_until AS DATE),
         l.status,
         NOW()
  FROM vw_hrms_licenses l
  ON DUPLICATE KEY UPDATE
    license_name=VALUES(license_name),
    valid_from=VALUES(valid_from),
    valid_until=VALUES(valid_until),
    status=VALUES(status),
    synced_at=NOW()
`;

export const buildQuotasViewQuery = () => `
  SELECT q.citizen_id, q.fiscal_year, q.total_quota
  FROM vw_hrms_leave_quotas q
`;

export const buildLeaveViewQuery = () => `
  SELECT ${selectColumns('lr', VIEW_LEAVE_COLUMNS)}
  FROM vw_hrms_leave_requests lr
`;

export const buildMovementsViewQuery = () => `
  INSERT INTO emp_movements (citizen_id, movement_type, effective_date, remark, synced_at)
  SELECT ${citizenIdSelectUtf8('m')} AS citizen_id,
         CASE
           WHEN ${binaryEquals('m.movement_type', "'UNKNOWN'")} THEN 'OTHER'
           ELSE m.movement_type
         END,
         m.effective_date,
         m.remark,
         NOW()
  FROM vw_hrms_movements m
  ON DUPLICATE KEY UPDATE
    movement_type = VALUES(movement_type),
    effective_date = VALUES(effective_date),
    remark = VALUES(remark),
    synced_at = NOW()
`;

export const buildSignaturesViewQuery = () => `
  SELECT s.citizen_id, s.signature_blob
  FROM vw_hrms_signatures s
`;

// Convert undefined to null for safe DB inserts.
const toNull = (val: any) => (val === undefined ? null : val);

// ─── SQL Builder Helpers (for duplication reduction) ────────────────────────

interface LeaveRecordSqlOptions {
  hasStatusColumn: boolean;
}

export const buildLeaveRecordSql = (options: LeaveRecordSqlOptions): { sql: string; fields: string[] } => {
  const { hasStatusColumn } = options;

  const baseFields = [
    'ref_id',
    'citizen_id',
    'leave_type',
    'start_date',
    'end_date',
    'duration_days',
    'fiscal_year',
    'remark',
  ];
  const fields = [...baseFields];
  const updateFields = [
    'start_date = VALUES(start_date)',
    'end_date = VALUES(end_date)',
    'duration_days = VALUES(duration_days)',
  ];

  if (hasStatusColumn) {
    fields.push('status');
    updateFields.push('status = VALUES(status)');
  }
  fields.push('synced_at');
  updateFields.push('synced_at = NOW()');

  const placeholders = fields.map(() => '?').join(', ');
  const sql = `
    INSERT INTO leave_records (${fields.join(', ')})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updateFields.join(', ')}
  `;

  return { sql, fields };
};

export const buildLeaveRecordValues = (vLeave: any, options: LeaveRecordSqlOptions): any[] => {
  const { hasStatusColumn } = options;
  const values = [
    toNull(vLeave.ref_id),
    toNull(vLeave.citizen_id),
    toNull(vLeave.leave_type),
    toNull(vLeave.start_date),
    toNull(vLeave.end_date),
    toNull(vLeave.duration_days),
    toNull(vLeave.fiscal_year),
    toNull(vLeave.remark),
  ];

  if (hasStatusColumn) {
    values.push(toNull(vLeave.status));
  }
  values.push(null); // synced_at handled by NOW()

  return values;
};

interface SupportEmployeeSqlOptions {
  hasLevelColumn: boolean;
}

export const buildSupportEmployeeSql = (
  options: SupportEmployeeSqlOptions,
): { sql: string; fields: string[] } => {
  const { hasLevelColumn } = options;

  const baseFields = ['citizen_id', 'title', 'first_name', 'last_name', 'position_name'];
  const fields = [...baseFields];
  const updateFields = [
    'title = VALUES(title)',
    'first_name = VALUES(first_name)',
    'last_name = VALUES(last_name)',
    'position_name = VALUES(position_name)',
  ];

  if (hasLevelColumn) {
    fields.push('level');
    updateFields.push('level = VALUES(level)');
  }

  fields.push(
    'special_position',
    'emp_type',
    'department',
    'is_currently_active',
    'last_synced_at',
  );
  updateFields.push(
    'special_position = VALUES(special_position)',
    'emp_type = VALUES(emp_type)',
    'department = VALUES(department)',
    'is_currently_active = VALUES(is_currently_active)',
    'last_synced_at = NOW()',
  );

  const placeholders = fields.map(() => '?').join(', ');
  const sql = `
    INSERT INTO emp_support_staff (${fields.join(', ')})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updateFields.join(', ')}
  `;

  return { sql, fields };
};

export const buildSupportEmployeeValues = (vSup: any, options: SupportEmployeeSqlOptions): any[] => {
  const { hasLevelColumn } = options;
  const values = [
    toNull(vSup.citizen_id),
    toNull(vSup.title),
    toNull(vSup.first_name),
    toNull(vSup.last_name),
    toNull(vSup.position_name),
  ];

  if (hasLevelColumn) {
    values.push(toNull(vSup.level));
  }

  values.push(
    toNull(vSup.special_position),
    toNull(vSup.employee_type),
    toNull(vSup.department),
    toNull(vSup.is_currently_active),
    null, // last_synced_at handled by NOW()
  );

  return values;
};

// ─────────────────────────────────────────────────────────────────────────────

const toDateOnly = (value: any): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isActiveOriginalStatus = (status: string | null): boolean => {
  if (!status) return false;
  return status.trim().startsWith('ปฏิบัติงาน');
};

export const deriveUserIsActive = (
  profileStatus: string | null,
  _supportIsEnableLogin: number | null,
): boolean => {
  return isActiveOriginalStatus(profileStatus);
};

// Detect value change with support for dates and nullish values.
const isChanged = (oldVal: any, newVal: any) => {
  const oldDate = toDateOnly(oldVal);
  const newDate = toDateOnly(newVal);
  if (oldDate || newDate) {
    return oldDate !== newDate;
  }
  if (typeof oldVal === 'number' && typeof newVal === 'string') {
    return oldVal !== Number.parseFloat(newVal);
  }
  return String(oldVal ?? '') !== String(newVal ?? '');
};

const getUserIdMap = async (conn: PoolConnection) => {
  const [existingUsers] = await conn.query<RowDataPacket[]>('SELECT id, citizen_id FROM users');
  return new Map(existingUsers.map((u) => [u.citizen_id, u.id]));
};

const syncSignatures = async (conn: PoolConnection, stats: SyncStats) => {
  return runDomainSignaturesSync(conn, stats, {
    buildSignaturesViewQuery,
  });
};

const syncLicensesAndQuotas = async (conn: PoolConnection, stats: SyncStats) => {
  return runDomainLicensesAndQuotasSync(conn, stats, {
    buildLicensesViewQuery,
    buildQuotasViewQuery,
    upsertLeaveQuota,
  });
};

const syncLeaves = async (conn: PoolConnection, stats: SyncStats) => {
  return runDomainLeavesSync(conn, stats, {
    hasLeaveStatusColumn,
    buildLeaveRecordSql,
    buildLeaveRecordValues,
    buildLeaveViewQuery,
    isChanged,
  });
};

const syncMovements = async (conn: PoolConnection, _stats: SyncStats) => {
  return runDomainMovementsSync(conn, {
    buildMovementsViewQuery,
    applyImmediateMovementEligibilityCutoff,
  });
};

export const buildScopesFromSpecialPosition = (specialPosition: string | null) => {
  return buildScopesFromSpecialPositionBase(specialPosition, {
    parseSpecialPositionScopes,
    removeOverlaps,
    inferScopeType,
  });
};

const syncSpecialPositionScopes = async (conn: PoolConnection) => {
  return runScopeSync(conn, {
    citizenIdJoinBinary,
    isActiveOriginalStatus,
    parseScopes: buildScopesFromSpecialPosition,
    disableScopeMappings: requestRepository.disableScopeMappings.bind(requestRepository),
    disableScopeMappingsByCitizenId: requestRepository.disableScopeMappingsByCitizenId.bind(
      requestRepository,
    ),
    insertScopeMappings: requestRepository.insertScopeMappings.bind(requestRepository),
    clearScopeCache,
  });
};

const syncSpecialPositionScopesForCitizen = async (conn: PoolConnection, citizenId: string) => {
  return runScopeSyncForCitizen(conn, citizenId, {
    citizenIdJoinBinary,
    isActiveOriginalStatus,
    parseScopes: buildScopesFromSpecialPosition,
    disableScopeMappings: requestRepository.disableScopeMappings.bind(requestRepository),
    disableScopeMappingsByCitizenId: requestRepository.disableScopeMappingsByCitizenId.bind(
      requestRepository,
    ),
    insertScopeMappings: requestRepository.insertScopeMappings.bind(requestRepository),
    clearScopeCache,
  });
};

const syncSingleSignature = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return runSingleSignatureSync(conn, citizenId, stats, {
    citizenIdWhereBinary,
  });
};

const syncSingleLicenses = async (conn: PoolConnection, citizenId: string): Promise<void> => {
  return runSingleLicensesSync(conn, citizenId, {
    citizenIdWhereBinary,
  });
};

const syncSingleQuotas = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return runSingleQuotasSync(conn, citizenId, stats, {
    citizenIdWhereBinary,
    upsertLeaveQuota,
  });
};

const syncSingleLeaves = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return runSingleLeavesSync(conn, citizenId, stats, {
    hasLeaveStatusColumn,
    buildLeaveRecordSql,
    buildLeaveRecordValues,
    selectColumns,
    viewLeaveColumns: VIEW_LEAVE_COLUMNS,
    citizenIdWhereBinary,
  });
};

const syncSingleMovements = async (conn: PoolConnection, citizenId: string): Promise<void> => {
  return runSingleMovementsSync(conn, citizenId, {
    citizenIdSelectUtf8,
    citizenIdWhereBinary,
    applyImmediateMovementEligibilityCutoff,
  });
};

const assignRoleForSingleUser = async (
  conn: PoolConnection,
  dbUser: RowDataPacket,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return assignRoleForSingleUserBase(conn, dbUser, citizenId, stats, {
    citizenIdWhereBinary,
    roleAssignmentService: {
      PROTECTED_ROLES: RoleAssignmentService.PROTECTED_ROLES,
      deriveRole: (hrRow: unknown) => RoleAssignmentService.deriveRole(hrRow as any),
    },
    clearScopeCache,
  });
};

export class SyncService {
  /**
   * Return cached status (fast path for dashboards).
   */
  static async getLastSyncStatus(): Promise<SyncRuntimeStatus> {
    return getSyncStatusFromCache();
  }

  /**
   * Run the full smart sync workflow with distributed lock + status caching.
   */
  static async performFullSync() {
    console.log('[SyncService] Requesting synchronization...');

    const lockValue = createSyncLockValue();
    const locked = await acquireSyncLock(lockValue);
    if (!locked) {
      console.warn('[SyncService] Synchronization aborted: already in progress.');
      throw new Error('Synchronization is already in progress. Please wait.');
    }
    const lockHeartbeat = startSyncLockHeartbeat(lockValue);

    const startTotal = Date.now();
    const stats = createSyncStats();

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      const userIdMap = await getUserIdMap(conn);
      await syncEmployees(conn, stats, userIdMap, {
        viewEmployeeColumns: VIEW_EMPLOYEE_COLUMNS,
        isChanged,
        upsertEmployeeProfile,
        clearScopeCache,
      });
      await syncSupportEmployees(conn, stats, userIdMap, {
        viewSupportColumns: VIEW_SUPPORT_COLUMNS,
        isChanged,
        hasSupportLevelColumn,
        buildSupportEmployeeSql,
        buildSupportEmployeeValues,
        clearScopeCache,
      });
      await syncUsersFromProfilesAndSupport(
        conn,
        stats,
        {
          deriveUserIsActive,
          protectedRoles: RoleAssignmentService.PROTECTED_ROLES,
        },
      );
      await syncSignatures(conn, stats);
      await syncLicensesAndQuotas(conn, stats);
      await syncLeaves(conn, stats);
      await syncMovements(conn, stats);
      await syncSpecialPositionScopes(conn);

      await conn.commit();

      // 7. Assign roles based on HR data (after commit)
      console.log('[SyncService] Assigning roles based on HR data...');
      try {
        const roleResult = await assignRoles();
        stats.roles = roleResult;
        console.log(
          `[SyncService] Role assignment: ${roleResult.updated} updated, ${roleResult.skipped} skipped`,
        );
      } catch (roleError) {
        console.warn(
          '[SyncService] Role assignment failed (non-fatal):',
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

      await setLastSyncResult(resultData);

      return resultData;
    } catch (error) {
      await conn.rollback();
      console.error('[SyncService] Synchronization failed:', error);
      throw error;
    } finally {
      clearInterval(lockHeartbeat);
      await releaseSyncLock(lockValue);
      conn.release();
    }
  }

  /**
   * Sync a single user by userId (granular sync).
   */
  static async performUserSync(userId: number) {
    const conn = await db.getConnection();
    try {
      const [userRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, citizen_id, role FROM users WHERE id = ? LIMIT 1',
        [userId],
      );
      const dbUser = userRows[0];
      if (!dbUser?.citizen_id) {
        throw new Error('User not found for sync');
      }

      const citizenId = dbUser.citizen_id as string;
      const stats = createSyncStats();

      await conn.beginTransaction();

      const userIdMap = new Map<string, number>([[citizenId, dbUser.id as number]]);
      await upsertSingleEmployeeProfile(conn, citizenId, userIdMap, stats, {
        viewEmployeeColumns: VIEW_EMPLOYEE_COLUMNS,
        citizenIdWhereBinary,
        upsertEmployeeProfile,
        clearScopeCache,
      });
      await upsertSingleSupportEmployee(conn, citizenId, stats, {
        viewSupportColumns: VIEW_SUPPORT_COLUMNS,
        citizenIdWhereBinary,
        hasSupportLevelColumn,
        buildSupportEmployeeSql,
        buildSupportEmployeeValues,
      });
      await syncUsersFromProfilesAndSupport(
        conn,
        stats,
        {
          deriveUserIsActive,
          protectedRoles: RoleAssignmentService.PROTECTED_ROLES,
        },
        { citizenId },
      );
      await syncSingleSignature(conn, citizenId, stats);
      await syncSingleLicenses(conn, citizenId);
      await syncSingleQuotas(conn, citizenId, stats);
      await syncSingleLeaves(conn, citizenId, stats);
      await syncSingleMovements(conn, citizenId);
      await syncSpecialPositionScopesForCitizen(conn, citizenId);

      await conn.commit();
      await assignRoleForSingleUser(conn, dbUser, citizenId, stats);

      return {
        success: true,
        stats,
        citizenId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}
