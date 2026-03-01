import { createHash } from 'node:crypto';

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
  'level',
  'special_position',
  'employee_type',
  'start_current_position',
  'first_entry_date',
  'mission_group',
  'department',
  'original_status',
  'is_currently_active',
] as const;

export const citizenIdJoinBinary = (leftAlias: string, rightAlias: string) =>
  `CAST(${leftAlias}.citizen_id AS BINARY) = CAST(${rightAlias}.citizen_id AS BINARY)`;

export const citizenIdWhereBinary = (alias: string, placeholder: string) =>
  `CAST(${alias}.citizen_id AS BINARY) = CAST(${placeholder} AS BINARY)`;
export const buildEmployeeViewQuery = () => `
  SELECT
    CAST(h.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
    h.title,
    h.name AS first_name,
    h.lastname AS last_name,
    h.sex,
    h.birthday AS birth_date,
    h.position AS position_name,
    h.positionnumber AS position_number,
    h.level,
    h.specialposition AS special_position,
    h.type AS employee_type,
    h.employment_date AS start_current_position,
    h.entry_date AS first_entry_date,
    h.missiongroup AS mission_group,
    h.workgroup_m AS department,
    h.subworkgroup AS sub_department,
    h.specialist,
    h.expert,
    h.status AS original_status,
    CASE
      WHEN h.status IN ('ปฏิบัติงาน (ตรง จ.)','ปฏิบัติงาน (ไม่ตรง จ.)') THEN 1
      WHEN h.status LIKE '%ลาศึกษา%' THEN 1
      ELSE 0
    END AS is_currently_active
  FROM hrms_databases.tb_ap_index_view h
  WHERE (
    h.position LIKE 'นายแพทย์%' OR
    h.position = 'ผู้อำนวยการเฉพาะด้าน (แพทย์)' OR
    h.position LIKE 'ทันตแพทย์%' OR
    h.position LIKE 'เภสัชกร%' OR
    h.position IN ('พยาบาลวิชาชีพ', 'พยาบาล', 'วิสัญญี') OR
    h.position IN (
      'นักเทคนิคการแพทย์', 'นักรังสีการแพทย์', 'นักกายภาพบำบัด',
      'นักแก้ไขความผิดปกติของการสื่อความหมาย', 'นักกิจกรรมบำบัด', 'นักอาชีวบำบัด',
      'นักจิตวิทยาคลินิก', 'นักเทคโนโลยีหัวใจและทรวงอก', 'นักวิชาการศึกษาพิเศษ'
    )
  )
  AND h.type NOT LIKE '%พนักงานกระทรวงสาธารณสุข%'
  AND h.type NOT LIKE '%พนักงานมหาลัย%'
  AND h.type NOT LIKE '%พนักงานราชการ%'
  AND h.type NOT LIKE '%ลูกจ้างรายวัน%'
  AND (
    h.status IN ('ปฏิบัติงาน (ตรง จ.)','ปฏิบัติงาน (ไม่ตรง จ.)')
    OR h.status LIKE 'ไม่ปฏิบัติงาน%'
    OR h.status LIKE '%ลาศึกษา%'
  )
`;

export const buildSupportViewQuery = () => `
  SELECT
    CAST(h.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
    h.title,
    h.name AS first_name,
    h.lastname AS last_name,
    h.sex,
    h.position AS position_name,
    h.positionnumber AS position_number,
    h.level,
    TRIM(BOTH ',' FROM REPLACE(REPLACE(h.specialposition, 'ผู้ดูแลระบบ--', ''), 'ผู้ดูแลระบบ', '')) AS special_position,
    h.type AS employee_type,
    h.employment_date AS start_current_position,
    h.entry_date AS first_entry_date,
    h.missiongroup AS mission_group,
    h.workgroup_m AS department,
    h.status AS original_status,
    CASE
      WHEN h.status IN ('ปฏิบัติงาน (ตรง จ.)','ปฏิบัติงาน (ไม่ตรง จ.)') THEN 1
      WHEN h.status LIKE '%ลาศึกษา%' THEN 1
      ELSE 0
    END AS is_currently_active
  FROM hrms_databases.tb_ap_index_view h
  LEFT JOIN (${buildEmployeeViewQuery()}) e
    ON CAST(e.citizen_id AS BINARY) = CAST(h.id AS BINARY)
  WHERE e.citizen_id IS NULL
    AND h.type IN ('ข้าราชการ', 'พนักงานราชการ', 'พนักงานกระทรวงสาธารณสุข', 'ลูกจ้างรายวัน')
    AND h.workgroup_m IN ('กลุ่มงานทรัพยากรบุคคล', 'กลุ่มงานการเงิน')
`;

export const buildQuotasViewQuery = () => `
  SELECT CAST(sd.emp_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
         CAST(sd.year AS UNSIGNED) AS fiscal_year,
         CAST(sd.setday AS DECIMAL(10,2)) AS total_quota
  FROM hrms_databases.setdays sd
  JOIN emp_profiles e
    ON CAST(e.citizen_id AS BINARY) = CAST(sd.emp_id AS BINARY)
`;

export const buildLeaveViewQuery = () => `
  WITH normalized_leave AS (
    SELECT
      dl.ID,
      CAST(dl.EMPLOYEE_ID AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
      dl.TYPE_LEAVE AS hrms_leave_type,
      dl.DETAIL AS remark,
      dl.END_DATE_DETAIL AS end_date_detail,
      dl.HALF_DAY AS half_day,
      LEAST(
        CASE
          WHEN YEAR(CAST(dl.START_DATE AS DATE)) > 2400 THEN CAST(dl.START_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.START_DATE AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(dl.END_DATE AS DATE)) > 2400 THEN CAST(dl.END_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.END_DATE AS DATE)
        END
      ) AS start_date,
      GREATEST(
        CASE
          WHEN YEAR(CAST(dl.START_DATE AS DATE)) > 2400 THEN CAST(dl.START_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.START_DATE AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(dl.END_DATE AS DATE)) > 2400 THEN CAST(dl.END_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.END_DATE AS DATE)
        END
      ) AS end_date
    FROM hrms_databases.data_leave dl
    WHERE dl.STATUS = 'Approve' AND dl.USED = 1
  ),
  calculated_leave AS (
    SELECT
      nl.*,
      CASE
        WHEN nl.half_day = 1 THEN 0.5
        WHEN nl.start_date = nl.end_date
             AND nl.end_date_detail IN ('ครึ่งวัน','ครึ่งวัน - เช้า','ครึ่งวัน - บ่าย') THEN 0.5
        ELSE (TO_DAYS(nl.end_date) - TO_DAYS(nl.start_date)) + 1
      END AS duration_days
    FROM normalized_leave nl
  ),
  dedup_leave AS (
    SELECT *
    FROM (
      SELECT
        cl.*,
        ROW_NUMBER() OVER (
          PARTITION BY cl.citizen_id, cl.end_date
          ORDER BY cl.duration_days DESC, cl.ID DESC
        ) AS rn
      FROM calculated_leave cl
    ) ranked
    WHERE ranked.rn = 1
  ),
  normalized_meeting AS (
    SELECT
      tm.meeting_id,
      CAST(tm.id_card AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
      tm.meeting_title AS remark,
      LEAST(
        CASE
          WHEN YEAR(CAST(tm.date_start AS DATE)) > 2400 THEN CAST(tm.date_start AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_start AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(tm.date_end AS DATE)) > 2400 THEN CAST(tm.date_end AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_end AS DATE)
        END
      ) AS start_date,
      GREATEST(
        CASE
          WHEN YEAR(CAST(tm.date_start AS DATE)) > 2400 THEN CAST(tm.date_start AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_start AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(tm.date_end AS DATE)) > 2400 THEN CAST(tm.date_end AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_end AS DATE)
        END
      ) AS end_date
    FROM hrms_databases.tb_meeting tm
    WHERE tm.header_approve_status = 1
  )
  SELECT
    CAST(dl.ID AS CHAR) AS ref_id,
    dl.citizen_id,
    dl.hrms_leave_type,
    dl.start_date,
    dl.end_date,
    dl.end_date_detail,
    dl.half_day,
    dl.remark,
    'approved' AS status,
    h.sex,
    'LEAVE' AS source_type,
    dl.duration_days
  FROM dedup_leave dl
  LEFT JOIN hrms_databases.tb_ap_index_view h ON CAST(h.id AS BINARY) = CAST(dl.citizen_id AS BINARY)
  UNION ALL
  SELECT
    CONCAT('MT-', nm.meeting_id) AS ref_id,
    nm.citizen_id,
    'education' AS hrms_leave_type,
    nm.start_date,
    nm.end_date,
    NULL AS end_date_detail,
    0 AS half_day,
    nm.remark,
    'approved' AS status,
    h.sex,
    'MEETING' AS source_type,
    (TO_DAYS(nm.end_date) - TO_DAYS(nm.start_date)) + 1 AS duration_days
  FROM normalized_meeting nm
  LEFT JOIN hrms_databases.tb_ap_index_view h ON CAST(h.id AS BINARY) = CAST(nm.citizen_id AS BINARY)
`;

export const buildSingleLeaveViewQuery = (citizenWhereExpr: string) => `
  WITH normalized_leave AS (
    SELECT
      dl.ID,
      CAST(dl.EMPLOYEE_ID AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
      dl.TYPE_LEAVE AS hrms_leave_type,
      dl.DETAIL AS remark,
      dl.END_DATE_DETAIL AS end_date_detail,
      dl.HALF_DAY AS half_day,
      LEAST(
        CASE
          WHEN YEAR(CAST(dl.START_DATE AS DATE)) > 2400 THEN CAST(dl.START_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.START_DATE AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(dl.END_DATE AS DATE)) > 2400 THEN CAST(dl.END_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.END_DATE AS DATE)
        END
      ) AS start_date,
      GREATEST(
        CASE
          WHEN YEAR(CAST(dl.START_DATE AS DATE)) > 2400 THEN CAST(dl.START_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.START_DATE AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(dl.END_DATE AS DATE)) > 2400 THEN CAST(dl.END_DATE AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(dl.END_DATE AS DATE)
        END
      ) AS end_date
    FROM hrms_databases.data_leave dl
    WHERE dl.STATUS = 'Approve'
      AND dl.USED = 1
      AND CAST(dl.EMPLOYEE_ID AS BINARY) = CAST(? AS BINARY)
  ),
  calculated_leave AS (
    SELECT
      nl.*,
      CASE
        WHEN nl.half_day = 1 THEN 0.5
        WHEN nl.start_date = nl.end_date
             AND nl.end_date_detail IN ('ครึ่งวัน','ครึ่งวัน - เช้า','ครึ่งวัน - บ่าย') THEN 0.5
        ELSE (TO_DAYS(nl.end_date) - TO_DAYS(nl.start_date)) + 1
      END AS duration_days
    FROM normalized_leave nl
  ),
  dedup_leave AS (
    SELECT *
    FROM (
      SELECT
        cl.*,
        ROW_NUMBER() OVER (
          PARTITION BY cl.citizen_id, cl.end_date
          ORDER BY cl.duration_days DESC, cl.ID DESC
        ) AS rn
      FROM calculated_leave cl
    ) ranked
    WHERE ranked.rn = 1
  ),
  normalized_meeting AS (
    SELECT
      tm.meeting_id,
      CAST(tm.id_card AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
      tm.meeting_title AS remark,
      LEAST(
        CASE
          WHEN YEAR(CAST(tm.date_start AS DATE)) > 2400 THEN CAST(tm.date_start AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_start AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(tm.date_end AS DATE)) > 2400 THEN CAST(tm.date_end AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_end AS DATE)
        END
      ) AS start_date,
      GREATEST(
        CASE
          WHEN YEAR(CAST(tm.date_start AS DATE)) > 2400 THEN CAST(tm.date_start AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_start AS DATE)
        END,
        CASE
          WHEN YEAR(CAST(tm.date_end AS DATE)) > 2400 THEN CAST(tm.date_end AS DATE) - INTERVAL 543 YEAR
          ELSE CAST(tm.date_end AS DATE)
        END
      ) AS end_date
    FROM hrms_databases.tb_meeting tm
    WHERE tm.header_approve_status = 1
      AND CAST(tm.id_card AS BINARY) = CAST(? AS BINARY)
  )
  SELECT *
  FROM (
    SELECT
      CAST(dl.ID AS CHAR) AS ref_id,
      dl.citizen_id,
      dl.hrms_leave_type,
      dl.start_date,
      dl.end_date,
      dl.end_date_detail,
      dl.half_day,
      dl.remark,
      'approved' AS status,
      h.sex,
      'LEAVE' AS source_type,
      dl.duration_days
    FROM dedup_leave dl
    LEFT JOIN hrms_databases.tb_ap_index_view h ON CAST(h.id AS BINARY) = CAST(dl.citizen_id AS BINARY)
    UNION ALL
    SELECT
      CONCAT('MT-', nm.meeting_id) AS ref_id,
      nm.citizen_id,
      'education' AS hrms_leave_type,
      nm.start_date,
      nm.end_date,
      NULL AS end_date_detail,
      0 AS half_day,
      nm.remark,
      'approved' AS status,
      h.sex,
      'MEETING' AS source_type,
      (TO_DAYS(nm.end_date) - TO_DAYS(nm.start_date)) + 1 AS duration_days
    FROM normalized_meeting nm
    LEFT JOIN hrms_databases.tb_ap_index_view h ON CAST(h.id AS BINARY) = CAST(nm.citizen_id AS BINARY)
  ) lr
  WHERE ${citizenWhereExpr}
`;

export const buildSignaturesViewQuery = () => `
  SELECT DISTINCT
    CAST(s.emp_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
    s.images AS signature_blob
  FROM hrms_databases.signature s
  WHERE s.images IS NOT NULL
    AND s.images <> ''
    AND (
      EXISTS (
        SELECT 1 FROM emp_profiles e
        WHERE CAST(e.citizen_id AS BINARY) = CAST(s.emp_id AS BINARY)
      )
      OR EXISTS (
        SELECT 1 FROM emp_support_staff sp
        WHERE CAST(sp.citizen_id AS BINARY) = CAST(s.emp_id AS BINARY)
      )
    )
`;

const toNull = (val: any) => (val === undefined ? null : val);

export interface LeaveRecordSqlOptions {
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
    'leave_type = VALUES(leave_type)',
    'start_date = VALUES(start_date)',
    'end_date = VALUES(end_date)',
    'duration_days = VALUES(duration_days)',
    'fiscal_year = VALUES(fiscal_year)',
    'remark = VALUES(remark)',
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
  values.push(null);
  return values;
};

export interface SupportEmployeeSqlOptions {
  hasLevelColumn: boolean;
  hasOriginalStatusColumn?: boolean;
  hasStatusCodeColumn?: boolean;
  hasStatusTextColumn?: boolean;
  hasSourceSystemColumn?: boolean;
  hasSourceUpdatedAtColumn?: boolean;
  hasRawSnapshotColumn?: boolean;
  hasProfileFingerprintColumn?: boolean;
}

export const buildSupportEmployeeSql = (
  options: SupportEmployeeSqlOptions,
): { sql: string; fields: string[] } => {
  const {
    hasLevelColumn,
    hasStatusCodeColumn,
    hasStatusTextColumn,
    hasSourceSystemColumn,
    hasSourceUpdatedAtColumn,
    hasRawSnapshotColumn,
    hasProfileFingerprintColumn,
  } = options;

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

  fields.push('special_position', 'emp_type', 'department', 'is_currently_active');
  updateFields.push(
    'special_position = VALUES(special_position)',
    'emp_type = VALUES(emp_type)',
    'department = VALUES(department)',
    'is_currently_active = VALUES(is_currently_active)',
  );

  if (options.hasOriginalStatusColumn) {
    fields.push('original_status');
    updateFields.push('original_status = VALUES(original_status)');
  }
  if (hasStatusCodeColumn) {
    fields.push('status_code');
    updateFields.push('status_code = VALUES(status_code)');
  }
  if (hasStatusTextColumn) {
    fields.push('status_text');
    updateFields.push('status_text = VALUES(status_text)');
  }
  if (hasSourceSystemColumn) {
    fields.push('source_system');
    updateFields.push('source_system = VALUES(source_system)');
  }
  if (hasSourceUpdatedAtColumn) {
    fields.push('source_updated_at');
    updateFields.push('source_updated_at = VALUES(source_updated_at)');
  }
  if (hasRawSnapshotColumn) {
    fields.push('raw_snapshot');
    updateFields.push('raw_snapshot = VALUES(raw_snapshot)');
  }
  if (hasProfileFingerprintColumn) {
    fields.push('profile_fingerprint');
    updateFields.push('profile_fingerprint = VALUES(profile_fingerprint)');
  }

  fields.push('last_synced_at');
  updateFields.push('last_synced_at = NOW()');

  const placeholders = fields.map(() => '?').join(', ');
  const sql = `
    INSERT INTO emp_support_staff (${fields.join(', ')})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updateFields.join(', ')}
  `;
  return { sql, fields };
};

export const buildSupportEmployeeValues = (vSup: any, options: SupportEmployeeSqlOptions): any[] => {
  const {
    hasLevelColumn,
    hasStatusCodeColumn,
    hasStatusTextColumn,
    hasSourceSystemColumn,
    hasSourceUpdatedAtColumn,
    hasRawSnapshotColumn,
    hasProfileFingerprintColumn,
  } = options;
  const isActive = Number(vSup.is_currently_active ?? 0) === 1;
  const statusCode = isActive ? 'ACTIVE' : 'INACTIVE';
  const statusText = vSup.original_status ?? (isActive ? 'ปฏิบัติงาน' : 'ไม่ปฏิบัติงาน');
  const normalized = {
    citizen_id: toNull(vSup.citizen_id),
    position_name: toNull(vSup.position_name),
    level: toNull(vSup.level),
    department: toNull(vSup.department),
    special_position: toNull(vSup.special_position),
    status_code: statusCode,
    status_text: statusText,
    is_currently_active: isActive ? 1 : 0,
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
  const values = [
    toNull(vSup.citizen_id),
    toNull(vSup.title),
    toNull(vSup.first_name),
    toNull(vSup.last_name),
    toNull(vSup.position_name),
  ];

  if (hasLevelColumn) values.push(toNull(vSup.level));

  values.push(
    toNull(vSup.special_position),
    toNull(vSup.employee_type),
    toNull(vSup.department),
    toNull(vSup.is_currently_active),
  );

  if (options.hasOriginalStatusColumn) values.push(toNull(vSup.original_status));
  if (hasStatusCodeColumn) values.push(statusCode);
  if (hasStatusTextColumn) values.push(statusText);
  if (hasSourceSystemColumn) values.push('HRMS');
  if (hasSourceUpdatedAtColumn) values.push(new Date());
  if (hasRawSnapshotColumn) values.push(JSON.stringify(vSup));
  if (hasProfileFingerprintColumn) values.push(fingerprint);

  values.push(null);
  return values;
};
