/**
 * PHTS System - Scope Resolution Utilities
 *
 * Parses special_position to determine HEAD_WARD/HEAD_DEPT scopes
 * and resolves which approver role should handle a request.
 *
 * Reference: assignRole/approval_scope_logic.txt
 */

/**
 * Scope type category
 */
export type ScopeType = "UNIT" | "DEPT" | "IGNORE" | "UNKNOWN";

/**
 * Parsed scopes for an approver
 */
export interface ApproverScopes {
  wardScopes: string[];
  deptScopes: string[];
}

/**
 * Infer scope type from scope name based on Thai keywords
 *
 * Rules:
 * - IGNORE: หัวหน้าพยาบาล, รองผู้อำนวยการฝ่ายการพยาบาล
 * - Special UNIT: Cath lab, Echo
 * - Special DEPT: องค์กรแพทย์
 * - DEPT: กลุ่มงาน, ภารกิจ (checked first because กลุ่มงาน contains งาน)
 * - UNIT: งาน, หอ, หน่วย, ศูนย์
 */
export function inferScopeType(scopeName: string): ScopeType {
  if (!scopeName) return "UNKNOWN";

  const name = scopeName.trim();

  // Check for special cases to ignore
  if (
    name.includes("หัวหน้าพยาบาล") ||
    name.includes("รองผู้อำนวยการฝ่ายการพยาบาล")
  ) {
    return "IGNORE";
  }

  // Special UNIT cases (no standard keywords)
  if (name.includes("Cath lab") || name.includes("Echo")) {
    return "UNIT";
  }

  // Special DEPT case
  if (name.includes("องค์กรแพทย์")) {
    return "DEPT";
  }

  // Check DEPT first (กลุ่มงาน contains งาน substring)
  if (name.includes("กลุ่มงาน") || name.includes("ภารกิจ")) {
    return "DEPT";
  }

  // Check UNIT keywords
  if (
    name.includes("งาน") ||
    name.includes("หอ") ||
    name.includes("หน่วย") ||
    name.includes("ศูนย์")
  ) {
    return "UNIT";
  }

  return "UNKNOWN";
}

/**
 * Parse special_position string into individual scopes
 * Format: "scope1; scope2; scope3" (semicolon-separated)
 */
export function parseSpecialPositionScopes(
  specialPosition: string | null,
): string[] {
  if (!specialPosition || specialPosition === "-") {
    return [];
  }

  return specialPosition
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "-");
}

/**
 * Remove overlapping scopes from wardScopes that also exist in deptScopes
 * Per docs: if a scope name exists in both lists, keep it in dept_scopes
 */
export function removeOverlaps(
  wardScopes: string[],
  deptScopes: string[],
): string[] {
  const deptSet = new Set(deptScopes.map((s) => s.toLowerCase()));
  return wardScopes.filter((s) => !deptSet.has(s.toLowerCase()));
}

/**
 * Normalize string for comparison (lowercase, trim)
 */
export function normalizeForMatch(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

/**
 * Check if two scope names match (case-insensitive, trimmed)
 */
export function scopeMatches(
  scope: string,
  target: string | null | undefined,
): boolean {
  if (!target) return false;
  return normalizeForMatch(scope) === normalizeForMatch(target);
}

/**
 * Check if any scope in the list matches the target
 */
export function anyScopeMatches(
  scopes: string[],
  target: string | null | undefined,
): boolean {
  if (!target) return false;
  const normalizedTarget = normalizeForMatch(target);
  return scopes.some((scope) => normalizeForMatch(scope) === normalizedTarget);
}

/**
 * Resolve which approver role should handle a request
 *
 * @param wardScopes - HEAD_WARD scopes (with overlaps already removed)
 * @param deptScopes - HEAD_DEPT scopes
 * @param requestDept - request.department
 * @param requestSubDept - request.sub_department
 * @returns 'HEAD_WARD' | 'HEAD_DEPT' | 'NONE'
 */
export function resolveApproverRole(
  wardScopes: string[],
  deptScopes: string[],
  requestDept: string | null | undefined,
  requestSubDept: string | null | undefined,
): "HEAD_WARD" | "HEAD_DEPT" | "NONE" {
  const wardMatches = countWardMatches(wardScopes, requestDept, requestSubDept);
  const deptMatches = countDeptMatches(deptScopes, requestDept, requestSubDept);

  // Conflict resolution per docs:
  // 1. If both match by unit scope -> HEAD_WARD wins
  // 2. If HEAD_WARD matches unit and HEAD_DEPT matches dept -> HEAD_WARD wins (more specific)
  // 3. If both match by dept scope -> HEAD_DEPT wins
  // 4. Single matches: return the matching role

  if (wardMatches.unit > 0 && deptMatches.unit > 0) {
    return "HEAD_WARD";
  }

  if (wardMatches.unit > 0 && deptMatches.dept > 0) {
    return "HEAD_WARD";
  }

  if (deptMatches.dept > 0) {
    return "HEAD_DEPT";
  }

  if (wardMatches.unit > 0) {
    return "HEAD_WARD";
  }

  if (deptMatches.unit > 0) {
    return "HEAD_DEPT";
  }

  if (wardMatches.dept > 0) {
    return "HEAD_WARD";
  }

  return "NONE";
}

type ScopeMatchCounts = { unit: number; dept: number };

function countWardMatches(
  scopes: string[],
  requestDept: string | null | undefined,
  requestSubDept: string | null | undefined,
): ScopeMatchCounts {
  let unit = 0;
  let dept = 0;

  for (const scope of scopes) {
    const scopeType = inferScopeType(scope);
    if (scopeType === "IGNORE") continue;

    if (scopeType === "UNIT" && scopeMatches(scope, requestSubDept)) {
      unit += 1;
    }

    if (
      scopeType === "DEPT" &&
      !requestSubDept &&
      scopeMatches(scope, requestDept)
    ) {
      dept += 1;
    }
  }

  return { unit, dept };
}

function countDeptMatches(
  scopes: string[],
  requestDept: string | null | undefined,
  requestSubDept: string | null | undefined,
): ScopeMatchCounts {
  let unit = 0;
  let dept = 0;

  for (const scope of scopes) {
    const scopeType = inferScopeType(scope);
    if (scopeType === "IGNORE") continue;

    if (scopeType === "DEPT" && scopeMatches(scope, requestDept)) {
      dept += 1;
    }

    if (scopeType === "UNIT" && scopeMatches(scope, requestSubDept)) {
      unit += 1;
    }
  }

  return { unit, dept };
}
