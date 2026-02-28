import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';

export const assignRoleForSingleUser = async (
  conn: PoolConnection,
  dbUser: RowDataPacket,
  citizenId: string,
  stats: SyncStats,
  deps: {
    citizenIdWhereBinary: (alias: string, placeholder: string) => string;
    roleAssignmentService: {
      PROTECTED_ROLES: Set<string>;
      AUTO_ASSIGNABLE_ROLES: Set<string>;
      deriveRole: (hrRow: unknown) => string;
    };
    clearScopeCache: (userId: number) => void;
  },
): Promise<void> => {
  try {
    const [hrRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT citizen_id, position_name, special_position, department, sub_department
        FROM emp_profiles WHERE ${deps.citizenIdWhereBinary('emp_profiles', '?')}
        LIMIT 1
      `,
      [citizenId],
    );
    const hrRow = hrRows[0] as RowDataPacket | undefined;
    if (!hrRow) {
      if (deps.roleAssignmentService.AUTO_ASSIGNABLE_ROLES.has(dbUser.role as string)) {
        await conn.execute(
          `UPDATE users
           SET role = 'USER', updated_at = NOW()
           WHERE ${deps.citizenIdWhereBinary('users', '?')}`,
          [citizenId],
        );
        deps.clearScopeCache(dbUser.id as number);
        stats.roles.updated++;
        return;
      }
      stats.roles.missing++;
      return;
    }
    const currentRole = dbUser.role as string;
    if (deps.roleAssignmentService.PROTECTED_ROLES.has(currentRole)) {
      stats.roles.skipped++;
      return;
    }
    const derivedRole = deps.roleAssignmentService.deriveRole(hrRow);
    let nextRole = derivedRole;
    if (derivedRole === 'HEAD_WARD' || derivedRole === 'HEAD_DEPT') {
      const [scopeRows] = await conn.query<RowDataPacket[]>(
        `
          SELECT 1
          FROM special_position_scope_map
          WHERE is_active = 1
            AND role = ?
            AND ${deps.citizenIdWhereBinary('special_position_scope_map', '?')}
          LIMIT 1
        `,
        [derivedRole, citizenId],
      );
      if (scopeRows.length === 0) {
        nextRole = 'USER';
      }
    }
    if (
      nextRole === 'USER' &&
      currentRole !== 'USER' &&
      !deps.roleAssignmentService.AUTO_ASSIGNABLE_ROLES.has(currentRole)
    ) {
      stats.roles.skipped++;
      return;
    }
    if (nextRole === currentRole) {
      stats.roles.skipped++;
      return;
    }
    await conn.execute(
      `UPDATE users
       SET role = ?, updated_at = NOW()
       WHERE ${deps.citizenIdWhereBinary('users', '?')}`,
      [nextRole, citizenId],
    );
    deps.clearScopeCache(dbUser.id as number);
    stats.roles.updated++;
  } catch (roleError) {
    console.warn('[SyncService] Single role assignment failed:', roleError);
  }
};
