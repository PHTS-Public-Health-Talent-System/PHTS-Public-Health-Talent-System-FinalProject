import type { PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import { clearScopeCache } from '@/modules/request/scope/application/scope.service.js';
import {
  IdentityRolePolicyRepository,
  type IdentityHrUserRow as HrUserRow,
} from '@/modules/identity/repositories/identity-role-policy.repository.js';
import { UserRole } from '@/types/auth.js';

const ALL_SYSTEM_ROLES = Object.freeze([
  UserRole.USER,
  UserRole.HEAD_WARD,
  UserRole.HEAD_DEPT,
  UserRole.PTS_OFFICER,
  UserRole.HEAD_HR,
  UserRole.HEAD_FINANCE,
  UserRole.FINANCE_OFFICER,
  UserRole.DIRECTOR,
  UserRole.ADMIN,
] as const);

const HR_MANAGED_ROLES = new Set<string>([
  UserRole.HEAD_WARD,
  UserRole.HEAD_DEPT,
]);

const MANUAL_ASSIGNABLE_ROLES = new Set<string>([
  UserRole.USER,
  UserRole.PTS_OFFICER,
  UserRole.HEAD_HR,
  UserRole.HEAD_FINANCE,
  UserRole.FINANCE_OFFICER,
  UserRole.DIRECTOR,
  UserRole.ADMIN,
]);

const PROTECTED_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.PTS_OFFICER,
]);

const AUTO_ASSIGNABLE_ROLES = HR_MANAGED_ROLES;
const ASSISTANT_TOKENS = [
  "รองหัวหน้า",
  "ผู้ช่วยหัวหน้า",
  "ผู้ช่วยหัวหน้าตึก",
  "รองหัวหน้าตึก",
];
const HEAD_DEPT_TOKENS = ["หัวหน้ากลุ่มงาน", "หัวหน้ากลุ่มภารกิจ"];

function includesAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function isAssistant(position: string): boolean {
  return includesAny(position, ASSISTANT_TOKENS);
}

function isHeadWard(position: string): boolean {
  return position.includes("หัวหน้าตึก") && !isAssistant(position);
}

function isHeadDept(position: string): boolean {
  return includesAny(position, HEAD_DEPT_TOKENS) && !isAssistant(position);
}

export function normalizeText(value?: string | null): string {
  return (value || "").trim();
}

function deriveRole(row: HrUserRow): string {
  const specialPosition = normalizeText(row.special_position);

  // Auto role assignment supports HEAD_DEPT + HEAD_WARD.
  if (isHeadDept(specialPosition)) return UserRole.HEAD_DEPT;
  if (isHeadWard(specialPosition)) return UserRole.HEAD_WARD;

  // All non-head roles stay USER and must be set manually when needed.
  return UserRole.USER;
}

export interface RoleAssignmentResult {
  updated: number;
  skipped: number;
  missing: number;
}

/**
 * Assign roles to users based on HR data.
 * Can use an existing connection (for transaction) or create a new one.
 */
export async function assignRoles(
  conn?: PoolConnection,
): Promise<RoleAssignmentResult> {
  const useExistingConn = Boolean(conn);
  conn ??= await db.getConnection();

  try {
    const [users, hrRows, scopeRows] = await Promise.all([
      IdentityRolePolicyRepository.findUsers(conn),
      IdentityRolePolicyRepository.findProfileRows(conn),
      IdentityRolePolicyRepository.findActiveHeadScopes(conn),
    ]);
    const scopedHeadRoleSet = new Set(
      scopeRows.map((row) => `${String(row.citizen_id)}|${String(row.role)}`),
    );

    const hrMap = new Map<string, HrUserRow>();
    for (const row of hrRows) {
      if (!hrMap.has(row.citizen_id)) hrMap.set(row.citizen_id, row);
    }

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const user of users) {
      const hrRow = hrMap.get(user.citizen_id);
      if (!hrRow) {
        if (AUTO_ASSIGNABLE_ROLES.has(user.role)) {
          await IdentityRolePolicyRepository.updateUserRole(conn, {
            citizenId: user.citizen_id,
            nextRole: UserRole.USER,
          });
          clearScopeCache(user.id);
          updated += 1;
          continue;
        }
        missing += 1;
        continue;
      }

      // Skip protected roles (ADMIN, PTS_OFFICER)
      if (PROTECTED_ROLES.has(user.role)) {
        skipped += 1;
        continue;
      }

      const derivedRole = deriveRole(hrRow);
      const nextRole =
        (derivedRole === UserRole.HEAD_WARD || derivedRole === UserRole.HEAD_DEPT) &&
        !scopedHeadRoleSet.has(`${user.citizen_id}|${derivedRole}`)
          ? UserRole.USER
          : derivedRole;
      if (
        nextRole === UserRole.USER &&
        user.role !== UserRole.USER &&
        !AUTO_ASSIGNABLE_ROLES.has(user.role)
      ) {
        skipped += 1;
        continue;
      }
      if (nextRole === user.role) {
        skipped += 1;
        continue;
      }

      await IdentityRolePolicyRepository.updateUserRole(conn, {
        citizenId: user.citizen_id,
        nextRole,
      });
      clearScopeCache(user.id);
      updated += 1;
    }

    return { updated, skipped, missing };
  } finally {
    if (!useExistingConn && conn) {
      conn.release();
    }
  }
}

export const IdentityRolePolicyService = {
  assignRoles,
  deriveRole,
  ALL_SYSTEM_ROLES,
  HR_MANAGED_ROLES,
  MANUAL_ASSIGNABLE_ROLES,
  PROTECTED_ROLES,
  AUTO_ASSIGNABLE_ROLES,
};

// Backward-compatible export for existing callers.
export const RoleAssignmentService = IdentityRolePolicyService;
