import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export const hasLeaveStatusColumn = async (conn: PoolConnection): Promise<boolean> => {
  const [leaveCols] = await conn.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'leave_records'
       AND COLUMN_NAME IN ('status')`,
  );
  const leaveColumnSet = new Set((leaveCols as RowDataPacket[]).map((row) => row.COLUMN_NAME));
  return leaveColumnSet.has('status');
};

export const hasSupportLevelColumn = async (conn: PoolConnection): Promise<boolean> => {
  const [supportCols] = await conn.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'emp_support_staff'
       AND COLUMN_NAME IN ('level')`,
  );
  const supportColumnSet = new Set((supportCols as RowDataPacket[]).map((row) => row.COLUMN_NAME));
  return supportColumnSet.has('level');
};

export const upsertEmployeeProfile = async (
  conn: PoolConnection,
  vEmp: RowDataPacket,
): Promise<void> => {
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
      (vEmp.special_position || '').substring(0, 65535),
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
};

export const upsertLeaveQuota = async (
  conn: PoolConnection,
  citizenId: string,
  fiscalYear: unknown,
  totalQuota: unknown,
): Promise<void> => {
  await conn.execute(
    `
      INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_vacation, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE quota_vacation = VALUES(quota_vacation), updated_at = NOW()
    `,
    [citizenId, Number.parseInt(String(fiscalYear), 10), totalQuota],
  );
};
