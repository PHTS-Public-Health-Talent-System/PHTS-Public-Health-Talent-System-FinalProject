/**
 * PHTS System - Scope Resolution Service
 *
 * Provides database integration for scope-based filtering.
 * Uses special_position from emp_profiles to determine approver scopes.
 */

import { delCache, setJsonCache } from '@shared/utils/cache.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js';
import {
  ApproverScopes,
  parseSpecialPositionScopes,
  removeOverlaps,
  resolveApproverRole,
  inferScopeType,
} from '@/modules/request/scope/utils.js';

const SCOPE_CACHE_TTL_SECONDS = 6 * 60 * 60;

/**
 * Cache for approver scopes (in-memory, cleared on restart)
 * Key: `${userId}_${role}`, Value: ApproverScopes
 */
const scopeCache = new Map<string, ApproverScopes>();

/**
 * Get approver scopes from database based on special_position
 *
 * The special_position field in emp_profiles contains role assignments like:
 * - "หัวหน้าตึก/หัวหน้างาน-งานไตเทียม" -> HEAD_WARD scope
 * - "หัวหน้ากลุ่มงาน-กลุ่มงานเภสัชกรรม" -> HEAD_DEPT scope
 *
 * For simplicity, we use the pre-parsed HEAD_WARD/HEAD_DEPT columns
 * from the special_position_group_mapping table if available,
 * or parse from special_position directly.
 */
export async function getApproverScopes(
  userId: number,
  userRole: "HEAD_WARD" | "HEAD_DEPT",
): Promise<ApproverScopes> {
  const cacheKey = `${userId}_${userRole}`;
  const redisKey = `scope:${cacheKey}`;

  // Get citizen_id for the user
  const citizenId = await requestRepository.findCitizenIdByUserId(userId);

  if (!citizenId) {
    const emptyScopes = { wardScopes: [], deptScopes: [] };
    scopeCache.set(cacheKey, emptyScopes);
    await setJsonCache(redisKey, emptyScopes, SCOPE_CACHE_TTL_SECONDS);
    return emptyScopes;
  }

  // Try to get from emp_profiles special_position
  const employeeExists = await requestRepository.findEmployeeExists(citizenId);
  if (!employeeExists) {
    const emptyScopes = { wardScopes: [], deptScopes: [] };
    scopeCache.set(cacheKey, emptyScopes);
    await setJsonCache(redisKey, emptyScopes, SCOPE_CACHE_TTL_SECONDS);
    return emptyScopes;
  }

  const originalStatus = await requestRepository.findOriginalStatus(citizenId);
  if (!isActiveOriginalStatus(originalStatus)) {
    const emptyScopes = { wardScopes: [], deptScopes: [] };
    scopeCache.set(cacheKey, emptyScopes);
    await setJsonCache(redisKey, emptyScopes, SCOPE_CACHE_TTL_SECONDS);
    return emptyScopes;
  }

  let mappings = await requestRepository.getScopeMappings(
    userId,
    userRole,
  );
  if (mappings.length === 0 && citizenId) {
    mappings = await requestRepository.getScopeMappingsByCitizenId(
      citizenId,
      userRole,
    );
  }
  if (mappings.length > 0) {
    const wardScopes = mappings
      .filter((m) => m.scope_type === "UNIT")
      .map((m) => m.scope_name);
    const deptScopes = mappings
      .filter((m) => m.scope_type === "DEPT")
      .map((m) => m.scope_name);
    const scopes = { wardScopes, deptScopes };
    scopeCache.set(cacheKey, scopes);
    await setJsonCache(redisKey, scopes, SCOPE_CACHE_TTL_SECONDS);
    return scopes;
  }

  const specialPosition = await requestRepository.findSpecialPosition(citizenId);
  const scopes = parseAndClassifyScopes(specialPosition);
  scopeCache.set(cacheKey, scopes);
  await setJsonCache(redisKey, scopes, SCOPE_CACHE_TTL_SECONDS);
  return scopes;
}

/**
 * Parse special_position and classify into ward/dept scopes
 *
 * The special_position format varies but typically includes patterns like:
 * - "หัวหน้าตึก/หัวหน้างาน-XXX" for HEAD_WARD
 * - "หัวหน้ากลุ่มงาน-XXX" for HEAD_DEPT
 * - Multiple entries separated by semicolons
 */
function parseAndClassifyScopes(
  specialPosition: string | null,
): ApproverScopes {
  if (!specialPosition) {
    return { wardScopes: [], deptScopes: [] };
  }

  const allScopes = parseSpecialPositionScopes(specialPosition);
  const wardScopes: string[] = [];
  const deptScopes: string[] = [];

  for (const scope of allScopes) {
    if (isWardScope(scope)) {
      const scopeName = extractScopeName(scope);
      pushScope(wardScopes, scopeName);
      if (inferScopeType(scopeName) === "DEPT") {
        pushScope(deptScopes, scopeName);
      }
      continue;
    }
    if (isDeptScope(scope)) {
      const scopeName = extractScopeName(scope);
      pushScope(deptScopes, scopeName);
      continue;
    }
    addInferredScope(scope, wardScopes, deptScopes);
  }

  // Remove overlaps: if scope exists in both, keep in deptScopes only
  const cleanedWardScopes = removeOverlaps(wardScopes, deptScopes);

  return {
    wardScopes: cleanedWardScopes,
    deptScopes,
  };
}

/**
 * Check if an approver can access a specific request based on scope
 *
 * @returns true if the approver has scope access to this request
 */
export async function canApproverAccessRequest(
  userId: number,
  userRole: string,
  requestDepartment: string | null | undefined,
  requestSubDepartment: string | null | undefined,
): Promise<boolean> {
  // Only HEAD_WARD and HEAD_DEPT need scope checking
  if (userRole !== "HEAD_WARD" && userRole !== "HEAD_DEPT") {
    return true; // Other roles have global access at their step
  }

  const scopes = await getApproverScopes(userId, userRole);

  if (
    userRole === "HEAD_WARD" &&
    scopes.wardScopes.length === 0 &&
    scopes.deptScopes.length > 0
  ) {
    const deptMatch = scopes.deptScopes.some(
      (scope) => scope.toLowerCase() === (requestDepartment ?? "").toLowerCase(),
    );
    if (deptMatch) {
      return true;
    }
  }

  const wardScopesForCheck =
    userRole === "HEAD_DEPT" ? [] : scopes.wardScopes;
  const resolvedRole = resolveApproverRole(
    wardScopesForCheck,
    scopes.deptScopes,
    requestDepartment,
    requestSubDepartment,
  );

  // The resolved role must match the user's role
  return resolvedRole === userRole;
}

/**
 * Get pending requests for an approver with scope filtering
 *
 * @param userId - The approver's user ID
 * @param userRole - The approver's role
 * @param stepNo - The current step number for this role
 * @returns SQL WHERE clause additions and parameters for scope filtering
 */
export async function getScopeFilterForApprover(
  userId: number,
  userRole: string,
): Promise<{ whereClause: string; params: any[] } | null> {
  // Only HEAD_WARD and HEAD_DEPT need scope filtering
  if (userRole !== "HEAD_WARD" && userRole !== "HEAD_DEPT") {
    return null; // No additional filtering needed
  }

  const scopes = await getApproverScopes(userId, userRole);

  // If no scopes defined, return no results
  if (scopes.wardScopes.length === 0 && scopes.deptScopes.length === 0) {
    return { whereClause: " AND 1 = 0", params: [] }; // No access
  }

  const { conditions, params } =
    userRole === "HEAD_WARD"
      ? buildWardConditions([...scopes.wardScopes, ...scopes.deptScopes])
      : buildDeptConditions(scopes.deptScopes);

  if (conditions.length === 0) {
    return { whereClause: " AND 1 = 0", params: [] }; // No access
  }

  return {
    whereClause: ` AND (${conditions.join(" OR ")})`,
    params,
  };
}

/**
 * Clear scope cache (call when user scopes change)
 */
export function clearScopeCache(userId?: number): void {
  if (userId) {
    const wardKey = `${userId}_HEAD_WARD`;
    const deptKey = `${userId}_HEAD_DEPT`;
    scopeCache.delete(wardKey);
    scopeCache.delete(deptKey);
    void delCache(`scope:${wardKey}`, `scope:${deptKey}`);
  } else {
    scopeCache.clear();
    void delCache();
  }
}

/**
 * Check if a user is the owner of a request (self-approval scenario)
 */
export async function isRequestOwner(
  userId: number,
  requestUserId: number,
): Promise<boolean> {
  return userId === requestUserId;
}

/**
 * Get list of scopes for UI display (multi-scope dropdown)
 *
 * Returns all scopes the user has access to, formatted for display
 */
type DisplayScope = { value: string; label: string; type: "UNIT" | "DEPT" };
type ScopeMember = {
  citizenId: string;
  fullName: string;
  position: string;
  department: string | null;
  subDepartment: string | null;
  userRole: string | null;
  userRoleLabel: string;
};
type DisplayScopeWithMembers = DisplayScope & {
  memberCount: number;
  members: ScopeMember[];
};

function appendDisplayScopes(result: DisplayScope[], scopes: string[]) {
  for (const scope of scopes) {
    const scopeType = inferScopeType(scope);
    if (scopeType === "IGNORE" || scopeType === "UNKNOWN") {
      continue;
    }
    result.push({
      value: scope,
      label: scope,
      type: scopeType === "UNIT" ? "UNIT" : "DEPT",
    });
  }
}

export async function getUserScopesForDisplay(
  userId: number,
  userRole: string,
): Promise<DisplayScope[]> {
  const approverRole =
    userRole === "HEAD_WARD" || userRole === "HEAD_DEPT" ? userRole : null;
  if (!approverRole) {
    return [];
  }

  const scopes = await getApproverScopes(userId, approverRole);
  const result: DisplayScope[] = [];
  appendDisplayScopes(result, scopes.wardScopes);
  appendDisplayScopes(result, scopes.deptScopes);
  return result;
}

export async function getUserScopesWithMembers(
  userId: number,
  userRole: string,
): Promise<DisplayScopeWithMembers[]> {
  const scopes = await getUserScopesForDisplay(userId, userRole);
  if (!scopes.length) return [];

  const scopesWithMembers = await Promise.all(
    scopes.map(async (scope) => {
      const rows = await requestRepository.findEmployeesInScope(scope.type, scope.value);
      const members: ScopeMember[] = rows.map((row) => {
        const fullName = [row.title, row.first_name, row.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        return {
          citizenId: row.citizen_id,
          fullName: fullName || row.citizen_id,
          position: row.position_name || "-",
          department: row.department,
          subDepartment: row.sub_department,
          userRole: row.user_role ?? null,
          userRoleLabel: mapUserRoleToThaiLabel(row.user_role ?? null),
        };
      });
      return {
        ...scope,
        memberCount: members.length,
        members,
      };
    }),
  );

  return scopesWithMembers;
}

function mapUserRoleToThaiLabel(role: string | null): string {
  switch ((role ?? "").toUpperCase()) {
    case "ADMIN":
      return "ผู้ดูแลระบบ";
    case "DIRECTOR":
      return "ผู้อำนวยการ";
    case "HEAD_FINANCE":
      return "หัวหน้าการเงิน";
    case "FINANCE_OFFICER":
      return "เจ้าหน้าที่การเงิน";
    case "HEAD_HR":
      return "หัวหน้าทรัพยากรบุคคล";
    case "PTS_OFFICER":
      return "เจ้าหน้าที่ พ.ต.ส.";
    case "HEAD_DEPT":
      return "หัวหน้ากลุ่มงาน";
    case "HEAD_WARD":
      return "หัวหน้าตึก/หัวหน้างาน";
    case "USER":
      return "ผู้ใช้งานทั่วไป";
    default:
      return "ยังไม่ได้กำหนดสิทธิ์";
  }
}

/**
 * Get scope filter for a specific selected scope
 *
 * Used when user selects a specific scope from the dropdown
 */
export async function getScopeFilterForSelectedScope(
  userId: number,
  userRole: string,
  selectedScope: string,
): Promise<{ whereClause: string; params: any[] } | null> {
  if (userRole !== "HEAD_WARD" && userRole !== "HEAD_DEPT") {
    return null;
  }

  // Verify user has access to this scope
  const scopes = await getApproverScopes(userId, userRole);
  const allUserScopes = [...scopes.wardScopes, ...scopes.deptScopes];

  const hasAccess = allUserScopes.some(
    (s) => s.toLowerCase() === selectedScope.toLowerCase(),
  );

  if (!hasAccess) {
    return { whereClause: " AND 1 = 0", params: [] }; // No access to this scope
  }

  return buildSelectedScopeFilter(selectedScope);
}

function isWardScope(scope: string): boolean {
  return scope.includes("หัวหน้าตึก") || scope.includes("หัวหน้างาน-");
}

function isDeptScope(scope: string): boolean {
  return scope.includes("หัวหน้ากลุ่มงาน");
}

function extractScopeName(scope: string): string {
  const parts = scope.split("-");
  return parts.length > 1 ? parts.slice(1).join("-").trim() : scope.trim();
}

function pushScope(target: string[], scopeName: string) {
  if (scopeName && inferScopeType(scopeName) !== "IGNORE") {
    target.push(scopeName);
  }
}

function addInferredScope(
  scope: string,
  wardScopes: string[],
  deptScopes: string[],
) {
  const scopeType = inferScopeType(scope);
  if (scopeType === "UNIT") {
    wardScopes.push(scope);
  } else if (scopeType === "DEPT") {
    deptScopes.push(scope);
  }
}

function buildWardConditions(scopes: string[]): {
  conditions: string[];
  params: string[];
} {
  const conditions: string[] = [];
  const params: string[] = [];

  for (const scope of scopes) {
    conditions.push("LOWER(e.sub_department) = LOWER(?)");
    params.push(scope);
  }

  for (const scope of scopes) {
    if (inferScopeType(scope) === "DEPT") {
      conditions.push("(LOWER(e.department) = LOWER(?))");
      params.push(scope);
    }
  }

  return { conditions, params };
}

function buildDeptConditions(scopes: string[]): {
  conditions: string[];
  params: string[];
} {
  const conditions: string[] = [];
  const params: string[] = [];

  for (const scope of scopes) {
    conditions.push("LOWER(e.department) = LOWER(?)");
    params.push(scope);
  }

  for (const scope of scopes) {
    if (inferScopeType(scope) === "UNIT") {
      conditions.push("LOWER(e.sub_department) = LOWER(?)");
      params.push(scope);
    }
  }

  return { conditions, params };
}

function buildSelectedScopeFilter(selectedScope: string): {
  whereClause: string;
  params: string[];
} {
  const scopeType = inferScopeType(selectedScope);
  if (scopeType === "UNIT") {
    return {
      whereClause: " AND LOWER(e.sub_department) = LOWER(?)",
      params: [selectedScope],
    };
  }
  if (scopeType === "DEPT") {
    return {
      whereClause: " AND LOWER(e.department) = LOWER(?)",
      params: [selectedScope],
    };
  }
  return { whereClause: " AND 1 = 0", params: [] };
}

function isActiveOriginalStatus(status: string | null): boolean {
  if (!status) return false;
  return status.trim().startsWith("ปฏิบัติงาน");
}
