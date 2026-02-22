import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';
import { clearScopeCache } from '@/modules/request/scope/scope.service.js';

type HrUserRow = {
  citizen_id: string;
  position_name?: string | null;
  special_position?: string | null;
  department?: string | null;
  sub_department?: string | null;
};

type UserRow = {
  id: number;
  citizen_id: string;
  role: string;
};

const PROTECTED_ROLES = new Set(["ADMIN", "PTS_OFFICER"]);
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

function isDirector(position: string): boolean {
  return (
    position.includes("ผู้อำนวยการ") && !position.includes("รองผู้อำนวยการ")
  );
}

export function normalizeText(value?: string | null): string {
  return (value || "").trim();
}

function deriveRole(row: HrUserRow): string {
  const positionName = normalizeText(row.position_name);
  const specialPosition = normalizeText(row.special_position);
  const department = normalizeText(row.department);

  // 1) Director (ผอ. ตัวจริงเท่านั้น ไม่รวมรอง)
  if (isDirector(positionName) || isDirector(specialPosition))
    return "DIRECTOR";

  // 2) Finance roles (ไม่รวมกลุ่มงานบัญชี)
  const isAccountingUnit = specialPosition.includes("บัญชี");
  if (
    department === "กลุ่มงานการเงิน" &&
    !isAccountingUnit &&
    isHeadDept(specialPosition)
  ) {
    return "HEAD_FINANCE";
  }
  if (department === "กลุ่มงานการเงิน" && !isAccountingUnit)
    return "FINANCE_OFFICER";

  // 3) HR department stays USER for manual role assignment.
  if (department.includes("ทรัพยากรบุคคล")) return "USER";

  // 4) Head Department (หัวหน้ากลุ่มงาน/กลุ่มภารกิจ)
  if (isHeadDept(specialPosition)) return "HEAD_DEPT";

  // 5) Head Ward (หัวหน้าตึก)
  if (isHeadWard(specialPosition)) return "HEAD_WARD";

  // 6) Default
  return "USER";
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
    const [users] = await conn.query<UserRow[] & RowDataPacket[]>(
      "SELECT id, citizen_id, role FROM users",
    );

    const [hrRows] = await conn.query<HrUserRow[] & RowDataPacket[]>(
      `
        SELECT citizen_id, position_name, special_position, department, sub_department
        FROM emp_profiles
        UNION ALL
        SELECT citizen_id, position_name, special_position, department, NULL AS sub_department
        FROM emp_support_staff
      `,
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
        missing += 1;
        continue;
      }

      // Skip protected roles (ADMIN, PTS_OFFICER)
      if (PROTECTED_ROLES.has(user.role)) {
        skipped += 1;
        continue;
      }

      const nextRole = deriveRole(hrRow);
      if (nextRole === user.role) {
        skipped += 1;
        continue;
      }

      await conn.execute(
        "UPDATE users SET role = ?, updated_at = NOW() WHERE citizen_id = ?",
        [nextRole, user.citizen_id],
      );
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

export const RoleAssignmentService = {
  assignRoles,
  deriveRole,
  PROTECTED_ROLES,
};
