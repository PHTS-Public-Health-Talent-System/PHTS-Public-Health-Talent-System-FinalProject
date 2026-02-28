import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export type IdentityUserRow = {
  id: number;
  citizen_id: string;
  role: string;
};

export type IdentityHrUserRow = {
  citizen_id: string;
  position_name?: string | null;
  special_position?: string | null;
  department?: string | null;
  sub_department?: string | null;
};

export type ActiveHeadScopeRow = {
  citizen_id: string;
  role: string;
};

export class IdentityRolePolicyRepository {
  static async findUsers(conn: PoolConnection): Promise<IdentityUserRow[]> {
    const [rows] = await conn.query<IdentityUserRow[] & RowDataPacket[]>(
      'SELECT id, citizen_id, role FROM users',
    );
    return rows;
  }

  static async findProfileRows(conn: PoolConnection): Promise<IdentityHrUserRow[]> {
    const [rows] = await conn.query<IdentityHrUserRow[] & RowDataPacket[]>(
      `
        SELECT citizen_id, position_name, special_position, department, sub_department
        FROM emp_profiles
      `,
    );
    return rows;
  }

  static async findActiveHeadScopes(conn: PoolConnection): Promise<ActiveHeadScopeRow[]> {
    const [rows] = await conn.query<ActiveHeadScopeRow[] & RowDataPacket[]>(
      `
        SELECT citizen_id, role
        FROM special_position_scope_map
        WHERE is_active = 1
          AND role IN ('HEAD_WARD', 'HEAD_DEPT')
      `,
    );
    return rows;
  }

  static async updateUserRole(
    conn: PoolConnection,
    input: { citizenId: string; nextRole: string },
  ): Promise<void> {
    await conn.execute('UPDATE users SET role = ?, updated_at = NOW() WHERE citizen_id = ?', [
      input.nextRole,
      input.citizenId,
    ]);
  }
}

