import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import db from '@config/database.js';
import {
  assignRoles,
  RoleAssignmentService,
} from '@/modules/sync/services/role-assignment.service.js';
import { TransformMonitorRepository } from '@/modules/sync/repositories/transform-monitor.repository.js';
import { refreshReviewCycleFromSync } from '@/modules/access-review/services/access-review.service.js';
import { getSyncRuntimeStatus } from '@/modules/sync/services/sync-status.service.js';
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
  hasSupportProfileFingerprintColumn,
  persistEmployeeProfileSyncArtifacts,
  persistSupportProfileSyncArtifacts,
  resolveSupportStaffColumnFlags,
  upsertEmployeeProfile,
  upsertLeaveQuota,
} from '@/modules/sync/services/shared/sync-db-helpers.service.js';
import { TransformRuleEngine } from '@/modules/sync/services/shared/transform-rule-engine.service.js';
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
import { normalizeLeaveRow } from '@/modules/sync/services/domain/leave-normalizer.service.js';
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

export const VIEW_LEAVE_COLUMNS = [
  'ref_id',
  'citizen_id',
  'hrms_leave_type',
  'start_date',
  'end_date',
  'end_date_detail',
  'half_day',
  'remark',
  'status',
  'sex',
  'source_type',
  'duration_days',
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
  SELECT CAST(l.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
         l.certificate AS license_name,
         l.certificate_number AS license_no,
         l.date_start AS valid_from,
         CAST(
           CASE
             WHEN CAST(l.date_end AS CHAR CHARACTER SET utf8mb4) = '0000-00-00' THEN '9999-12-31'
             ELSE l.date_end
           END AS DATE
         ) AS valid_until,
         CASE
           WHEN CAST(l.date_end AS CHAR CHARACTER SET utf8mb4) = '0000-00-00'
                OR l.date_end >= CURDATE() THEN 'ACTIVE'
           ELSE 'EXPIRED'
         END AS status,
         NOW()
  FROM hrms_databases.tb_bp_license l
  JOIN emp_profiles e
    ON CAST(e.citizen_id AS BINARY) = CAST(l.id AS BINARY)
  WHERE l.date_end IS NOT NULL
  ON DUPLICATE KEY UPDATE
    license_name=VALUES(license_name),
    valid_from=VALUES(valid_from),
    valid_until=VALUES(valid_until),
    status=VALUES(status),
    synced_at=NOW()
`;

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

export const buildMovementsViewQuery = () => `
  INSERT INTO emp_movements (citizen_id, movement_type, effective_date, remark, synced_at)
  SELECT CAST(m.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
         CASE
           WHEN m.status_id IN ('1','2','3') THEN 'ENTRY'
           WHEN m.status_id = '4' THEN 'RETIRE'
           WHEN m.status_id = '5' THEN 'STUDY'
           WHEN m.status_id = '6' THEN 'DEATH'
           WHEN m.status_id IN ('7','8') THEN 'TRANSFER_OUT'
           WHEN m.status_id = '9' THEN 'RESIGN'
           ELSE 'OTHER'
         END,
         m.date,
         m.remark,
         NOW()
  FROM hrms_databases.tb_bp_status m
  JOIN emp_profiles e
    ON CAST(e.citizen_id AS BINARY) = CAST(m.id AS BINARY)
  ON DUPLICATE KEY UPDATE
    movement_type = VALUES(movement_type),
    effective_date = VALUES(effective_date),
    remark = VALUES(remark),
    synced_at = NOW()
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

  fields.push(
    'special_position',
    'emp_type',
    'department',
    'is_currently_active',
  );
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

  fields.push(
    'last_synced_at',
  );
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

  if (hasLevelColumn) {
    values.push(toNull(vSup.level));
  }

  values.push(
    toNull(vSup.special_position),
    toNull(vSup.employee_type),
    toNull(vSup.department),
    toNull(vSup.is_currently_active),
  );

  if (options.hasOriginalStatusColumn) {
    values.push(toNull(vSup.original_status));
  }

  if (hasStatusCodeColumn) {
    values.push(statusCode);
  }
  if (hasStatusTextColumn) {
    values.push(statusText);
  }
  if (hasSourceSystemColumn) {
    values.push('HRMS');
  }
  if (hasSourceUpdatedAtColumn) {
    values.push(new Date());
  }
  if (hasRawSnapshotColumn) {
    values.push(JSON.stringify(vSup));
  }
  if (hasProfileFingerprintColumn) {
    values.push(fingerprint);
  }

  values.push(null); // last_synced_at handled by NOW()

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

const isActiveStatusCode = (statusCode: string | null): boolean => {
  const normalized = String(statusCode ?? '').trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'STUDY_LEAVE';
};

// Used by scope sync flow where source still provides status text.
const isActiveOriginalStatus = (status: string | null): boolean => {
  if (!status) return false;
  const normalized = status.trim();
  return normalized.startsWith('ปฏิบัติงาน') || normalized.includes('ลาศึกษา');
};

export const deriveUserIsActive = (
  profileStatusCode: string | null,
  supportStatusCode: string | null,
): boolean => {
  if (profileStatusCode && profileStatusCode.trim().length > 0) {
    return isActiveStatusCode(profileStatusCode);
  }
  if (supportStatusCode && supportStatusCode.trim().length > 0) {
    return isActiveStatusCode(supportStatusCode);
  }
  return false;
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

const parseBooleanEnv = (value: string | undefined, fallback = false): boolean => {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const getSupportCleanupDryRun = (): boolean =>
  parseBooleanEnv(process.env.SYNC_SUPPORT_CLEANUP_DRY_RUN, false);

const getStatusCodeNullThresholdPct = (): number => {
  const raw = Number.parseFloat(process.env.SYNC_USER_STATUS_CODE_NULL_THRESHOLD_PCT ?? '0');
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  return raw;
};

const cleanupSupportByCurrentView = async (
  conn: PoolConnection,
  options: { dryRun: boolean },
): Promise<{ candidates: number; deleted: number; dryRun: boolean }> => {
  const [candidateRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS total
      FROM emp_support_staff s
      LEFT JOIN (${buildSupportViewQuery()}) v
        ON CAST(v.citizen_id AS BINARY) = CAST(s.citizen_id AS BINARY)
      WHERE v.citizen_id IS NULL
    `,
  );
  const candidates = Number(candidateRows[0]?.total ?? 0);
  if (options.dryRun || candidates === 0) {
    if (options.dryRun && candidates > 0) {
      console.warn(`[SyncService] support cleanup dry-run: ${candidates} rows would be deleted`);
    }
    return { candidates, deleted: 0, dryRun: options.dryRun };
  }

  const [result] = await conn.query<ResultSetHeader>(
    `
      DELETE s
      FROM emp_support_staff s
      LEFT JOIN (${buildSupportViewQuery()}) v
        ON CAST(v.citizen_id AS BINARY) = CAST(s.citizen_id AS BINARY)
      WHERE v.citizen_id IS NULL
    `,
  );
  return { candidates, deleted: Number(result.affectedRows ?? 0), dryRun: options.dryRun };
};

const enforceStatusCodeQualityGate = async (
  conn: PoolConnection,
  stats: SyncStats,
  options?: { citizenId?: string },
): Promise<void> => {
  const thresholdPct = getStatusCodeNullThresholdPct();
  const params: string[] = [];
  const profileWhere = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) params.push(options.citizenId);
  const supportWhere = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) params.push(options.citizenId);
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN status_code IS NULL OR TRIM(status_code) = '' THEN 1 ELSE 0 END) AS null_count
      FROM (
        SELECT status_code FROM emp_profiles ${profileWhere}
        UNION ALL
        SELECT status_code FROM emp_support_staff ${supportWhere}
      ) s
    `,
    params,
  );
  const total = Number(rows[0]?.total_count ?? 0);
  const nullCount = Number(rows[0]?.null_count ?? 0);
  const nullPct = total > 0 ? (nullCount / total) * 100 : 0;

  stats.quality_gates = {
    status_code_total: total,
    status_code_null: nullCount,
    threshold_pct: thresholdPct,
  };

  if (nullPct > thresholdPct) {
    throw new Error(
      `status_code quality gate failed: null=${nullCount}/${total} (${nullPct.toFixed(2)}%) > threshold ${thresholdPct}%`,
    );
  }
};

const buildSyncReconciliation = async (conn: PoolConnection) => {
  const [supportRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        (SELECT COUNT(*) FROM (${buildSupportViewQuery()}) v) AS support_view_count,
        (SELECT COUNT(*) FROM emp_support_staff) AS support_table_count
    `,
  );
  const [userRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        COUNT(*) AS users_total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS users_active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS users_inactive
      FROM users
    `,
  );
  const [statusRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        (SELECT SUM(CASE WHEN status_code IS NULL OR TRIM(status_code) = '' THEN 1 ELSE 0 END) FROM emp_profiles) AS profile_status_code_null,
        (SELECT SUM(CASE WHEN status_code IS NULL OR TRIM(status_code) = '' THEN 1 ELSE 0 END) FROM emp_support_staff) AS support_status_code_null
    `,
  );
  return {
    support: supportRows[0] ?? {},
    users: userRows[0] ?? {},
    quality: statusRows[0] ?? {},
  };
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

const syncLeaves = async (
  conn: PoolConnection,
  stats: SyncStats,
  transformEngine?: TransformRuleEngine,
) => {
  return runDomainLeavesSync(conn, stats, {
    hasLeaveStatusColumn,
    buildLeaveRecordSql,
    buildLeaveRecordValues,
    buildLeaveViewQuery,
    isChanged,
    normalizeLeaveRow,
    applyTransformRow: transformEngine
      ? (input) => transformEngine.applyRow(input)
      : undefined,
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
  return runSingleLicensesSync(conn, citizenId);
};

const syncSingleQuotas = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
): Promise<void> => {
  return runSingleQuotasSync(conn, citizenId, stats, {
    upsertLeaveQuota,
  });
};

const syncSingleLeaves = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
  transformEngine?: TransformRuleEngine,
): Promise<void> => {
  return runSingleLeavesSync(conn, citizenId, stats, {
    hasLeaveStatusColumn,
    buildLeaveRecordSql,
    buildLeaveRecordValues,
    buildLeaveViewQuery,
    citizenIdWhereBinary,
    normalizeLeaveRow,
    applyTransformRow: transformEngine
      ? (input) => transformEngine.applyRow(input)
      : undefined,
  });
};

const syncSingleMovements = async (conn: PoolConnection, citizenId: string): Promise<void> => {
  return runSingleMovementsSync(conn, citizenId, {
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
  static async performFullSync(options?: { triggeredBy?: number | null }) {
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
    let batchId: number | null = null;
    let conn: PoolConnection | null = null;
    let transformEngine: TransformRuleEngine | null = null;

    try {
      batchId = await TransformMonitorRepository.createSyncBatch({
        syncType: 'FULL',
        triggeredBy: options?.triggeredBy ?? null,
        targetCitizenId: null,
      });
      transformEngine = await TransformRuleEngine.create(batchId);

      conn = await db.getConnection();
      await conn.beginTransaction();

      const userIdMap = await getUserIdMap(conn);
      await syncEmployees(conn, stats, userIdMap, {
        viewEmployeeColumns: VIEW_EMPLOYEE_COLUMNS,
        buildEmployeeViewQuery,
        isChanged,
        upsertEmployeeProfile,
        persistEmployeeProfileSyncArtifacts: (cx, vEmp) =>
          persistEmployeeProfileSyncArtifacts(cx, vEmp, batchId),
        clearScopeCache,
      });
      await syncSupportEmployees(conn, stats, userIdMap, {
        viewSupportColumns: VIEW_SUPPORT_COLUMNS,
        buildSupportViewQuery,
        isChanged,
        hasSupportLevelColumn: async (cx) => (await resolveSupportStaffColumnFlags(cx)).hasLevelColumn,
        hasSupportProfileFingerprintColumn,
        resolveSupportStaffColumnFlags,
        buildSupportEmployeeSql,
        buildSupportEmployeeValues,
        persistSupportProfileSyncArtifacts: (cx, vSup) =>
          persistSupportProfileSyncArtifacts(cx, vSup, batchId),
        clearScopeCache,
      });
      const cleanupResult = await cleanupSupportByCurrentView(conn, {
        dryRun: getSupportCleanupDryRun(),
      });
      stats.support_cleanup = {
        candidates: cleanupResult.candidates,
        deleted: cleanupResult.deleted,
        dry_run: cleanupResult.dryRun,
      };
      await enforceStatusCodeQualityGate(conn, stats);
      await syncUsersFromProfilesAndSupport(
        conn,
        stats,
        {
          deriveUserIsActive,
          protectedRoles: RoleAssignmentService.PROTECTED_ROLES,
          syncBatchId: batchId,
        },
      );
      await syncSignatures(conn, stats);
      await syncLicensesAndQuotas(conn, stats);
      await syncLeaves(conn, stats, transformEngine);
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
      const reconciliation = await buildSyncReconciliation(conn);
      const resultData = {
        success: true,
        duration,
        stats,
        reconciliation,
        timestamp: new Date().toISOString(),
      };

      console.log(`[SyncService] Synchronization completed in ${duration}s`);

      await setLastSyncResult(resultData);

      await TransformMonitorRepository.finishSyncBatchSuccess(
        batchId,
        stats,
        Date.now() - startTotal,
      );

      let accessReview: { cycleId: number; createdCycle: boolean; insertedItems: number } | null = null;
      try {
        accessReview = await refreshReviewCycleFromSync({
          actorId: options?.triggeredBy ?? null,
          syncTimestamp: new Date(resultData.timestamp),
        });
      } catch (reviewError) {
        console.warn(
          '[SyncService] Post-sync access review refresh failed (non-fatal):',
          reviewError instanceof Error ? reviewError.message : reviewError,
        );
      }

      return {
        ...resultData,
        access_review: accessReview,
      };
    } catch (error) {
      if (conn) {
        await conn.rollback();
      }
      console.error('[SyncService] Synchronization failed:', error);
      if (batchId) {
        await TransformMonitorRepository.finishSyncBatchFailed(
          batchId,
          error instanceof Error ? error.message : String(error),
          Date.now() - startTotal,
        );
      }
      throw error;
    } finally {
      clearInterval(lockHeartbeat);
      await releaseSyncLock(lockValue);
      if (conn) {
        conn.release();
      }
    }
  }

  /**
   * Sync a single user by userId (granular sync).
   */
  static async performUserSync(userId: number, options?: { triggeredBy?: number | null }) {
    const conn = await db.getConnection();
    const startTotal = Date.now();
    let batchId: number | null = null;
    let transformEngine: TransformRuleEngine | null = null;
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
      batchId = await TransformMonitorRepository.createSyncBatch({
        syncType: 'USER',
        triggeredBy: options?.triggeredBy ?? null,
        targetCitizenId: citizenId,
      });
      transformEngine = await TransformRuleEngine.create(batchId);

      await conn.beginTransaction();

      const userIdMap = new Map<string, number>([[citizenId, dbUser.id as number]]);
      await upsertSingleEmployeeProfile(conn, citizenId, userIdMap, stats, {
        viewEmployeeColumns: VIEW_EMPLOYEE_COLUMNS,
        buildEmployeeViewQuery,
        citizenIdWhereBinary,
        isChanged,
        upsertEmployeeProfile,
        persistEmployeeProfileSyncArtifacts: (cx, vEmp) =>
          persistEmployeeProfileSyncArtifacts(cx, vEmp, batchId),
        clearScopeCache,
      });
      await upsertSingleSupportEmployee(conn, citizenId, stats, {
        viewSupportColumns: VIEW_SUPPORT_COLUMNS,
        buildSupportViewQuery,
        citizenIdWhereBinary,
        hasSupportLevelColumn: async (cx) => (await resolveSupportStaffColumnFlags(cx)).hasLevelColumn,
        hasSupportProfileFingerprintColumn,
        resolveSupportStaffColumnFlags,
        buildSupportEmployeeSql,
        buildSupportEmployeeValues,
        isChanged,
        persistSupportProfileSyncArtifacts: (cx, vSup) =>
          persistSupportProfileSyncArtifacts(cx, vSup, batchId),
      });
      await enforceStatusCodeQualityGate(conn, stats, { citizenId });
      await syncUsersFromProfilesAndSupport(
        conn,
        stats,
        {
          deriveUserIsActive,
          protectedRoles: RoleAssignmentService.PROTECTED_ROLES,
          syncBatchId: batchId,
        },
        { citizenId },
      );
      await syncSingleSignature(conn, citizenId, stats);
      await syncSingleLicenses(conn, citizenId);
      await syncSingleQuotas(conn, citizenId, stats);
      await syncSingleLeaves(conn, citizenId, stats, transformEngine);
      await syncSingleMovements(conn, citizenId);
      await syncSpecialPositionScopesForCitizen(conn, citizenId);

      await conn.commit();
      await assignRoleForSingleUser(conn, dbUser, citizenId, stats);

      await TransformMonitorRepository.finishSyncBatchSuccess(
        batchId,
        stats,
        Date.now() - startTotal,
      );

      const syncFinishedAt = new Date().toISOString();
      const reconciliation = await buildSyncReconciliation(conn);
      let accessReview: { cycleId: number; createdCycle: boolean; insertedItems: number } | null = null;
      try {
        accessReview = await refreshReviewCycleFromSync({
          actorId: options?.triggeredBy ?? null,
          syncTimestamp: new Date(syncFinishedAt),
          citizenId,
        });
      } catch (reviewError) {
        console.warn(
          '[SyncService] Post-user-sync access review refresh failed (non-fatal):',
          reviewError instanceof Error ? reviewError.message : reviewError,
        );
      }

      return {
        success: true,
        stats,
        reconciliation,
        citizenId,
        timestamp: syncFinishedAt,
        access_review: accessReview,
      };
    } catch (error) {
      await conn.rollback();
      if (batchId) {
        await TransformMonitorRepository.finishSyncBatchFailed(
          batchId,
          error instanceof Error ? error.message : String(error),
          Date.now() - startTotal,
        );
      }
      throw error;
    } finally {
      conn.release();
    }
  }

  static async refreshAccessReviewOnly(options?: {
    triggeredBy?: number | null;
    citizenId?: string | null;
  }): Promise<{
    refreshed_at: string;
    sync_timestamp: string | null;
    access_review: { cycleId: number; createdCycle: boolean; insertedItems: number };
  }> {
    const runtimeStatus = await getSyncRuntimeStatus();
    const lastResult = runtimeStatus.lastResult as { timestamp?: string } | null;
    const syncTimestamp =
      lastResult?.timestamp && !Number.isNaN(Date.parse(lastResult.timestamp))
        ? new Date(lastResult.timestamp)
        : new Date();

    const accessReview = await refreshReviewCycleFromSync({
      actorId: options?.triggeredBy ?? null,
      syncTimestamp,
      citizenId: options?.citizenId ?? null,
    });

    return {
      refreshed_at: new Date().toISOString(),
      sync_timestamp: syncTimestamp.toISOString(),
      access_review: accessReview,
    };
  }
}
