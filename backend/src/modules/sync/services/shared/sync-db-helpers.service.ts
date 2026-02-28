import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { createHash } from 'node:crypto';

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const isSyncHistoryArtifactsEnabled = (): boolean =>
  parseBooleanEnv(process.env.SYNC_HISTORY_ARTIFACTS_ENABLED, true);

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

export type SupportStaffColumnFlags = {
  hasLevelColumn: boolean;
  hasOriginalStatusColumn: boolean;
  hasStatusCodeColumn: boolean;
  hasStatusTextColumn: boolean;
  hasSourceSystemColumn: boolean;
  hasSourceUpdatedAtColumn: boolean;
  hasLastSyncBatchIdColumn: boolean;
  hasRawSnapshotColumn: boolean;
  hasProfileFingerprintColumn: boolean;
};

export const resolveSupportStaffColumnFlags = async (
  conn: PoolConnection,
): Promise<SupportStaffColumnFlags> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'emp_support_staff'
       AND COLUMN_NAME IN (
         'level',
         'original_status',
         'status_code',
         'status_text',
         'source_system',
         'source_updated_at',
         'last_sync_batch_id',
         'raw_snapshot',
         'profile_fingerprint'
       )`,
  );
  const columns = new Set(rows.map((row) => String(row.COLUMN_NAME)));

  return {
    hasLevelColumn: columns.has('level'),
    hasOriginalStatusColumn: columns.has('original_status'),
    hasStatusCodeColumn: columns.has('status_code'),
    hasStatusTextColumn: columns.has('status_text'),
    hasSourceSystemColumn: columns.has('source_system'),
    hasSourceUpdatedAtColumn: columns.has('source_updated_at'),
    hasLastSyncBatchIdColumn: columns.has('last_sync_batch_id'),
    hasRawSnapshotColumn: columns.has('raw_snapshot'),
    hasProfileFingerprintColumn: columns.has('profile_fingerprint'),
  };
};

export const hasSupportProfileFingerprintColumn = async (
  conn: PoolConnection,
): Promise<boolean> => {
  const flags = await resolveSupportStaffColumnFlags(conn);
  return flags.hasProfileFingerprintColumn;
};

const buildNormalizedProfile = (vEmp: RowDataPacket) => {
  const statusText = vEmp.original_status ? String(vEmp.original_status) : null;
  const isCurrentlyActive = Number(vEmp.is_currently_active) === 1 ? 1 : 0;
  const statusCode = !statusText
    ? 'UNKNOWN'
    : statusText.includes('ลาศึกษา')
      ? 'STUDY_LEAVE'
      : isCurrentlyActive
        ? 'ACTIVE'
        : 'INACTIVE';

  const normalized = {
    citizen_id: vEmp.citizen_id ?? null,
    position_name: vEmp.position_name ?? null,
    level: vEmp.level ?? null,
    department: vEmp.department ?? null,
    sub_department: vEmp.sub_department ?? null,
    special_position: vEmp.special_position ?? null,
    status_code: statusCode,
    status_text: statusText,
    is_currently_active: isCurrentlyActive,
  };

  const profileFingerprint = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');

  return {
    statusText,
    isCurrentlyActive,
    statusCode,
    normalized,
    profileFingerprint,
  };
};

export const computeEmployeeProfileFingerprint = (vEmp: RowDataPacket): string => {
  return buildNormalizedProfile(vEmp).profileFingerprint;
};

type FingerprintColumnFlags = {
  hasEmpFp: boolean;
  hasHistoryFp: boolean;
  hasRawFp: boolean;
};

const resolveFingerprintColumns = async (
  conn: PoolConnection,
): Promise<FingerprintColumnFlags> => {
  const [fpCols] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND (
         (TABLE_NAME = 'emp_profiles' AND COLUMN_NAME = 'profile_fingerprint')
         OR (TABLE_NAME = 'emp_profile_history' AND COLUMN_NAME = 'profile_fingerprint')
         OR (TABLE_NAME = 'emp_profile_raw_snapshots' AND COLUMN_NAME = 'profile_fingerprint')
       )`,
  );

  return {
    hasEmpFp: fpCols.some((r) => r.TABLE_NAME === 'emp_profiles'),
    hasHistoryFp: fpCols.some((r) => r.TABLE_NAME === 'emp_profile_history'),
    hasRawFp: fpCols.some((r) => r.TABLE_NAME === 'emp_profile_raw_snapshots'),
  };
};

export const upsertEmployeeProfile = async (
  conn: PoolConnection,
  vEmp: RowDataPacket,
): Promise<void> => {
  const { statusText, isCurrentlyActive, statusCode, profileFingerprint } =
    buildNormalizedProfile(vEmp);
  const safeRawSnapshot = JSON.stringify(vEmp);

  await conn.execute(
    `
      INSERT INTO emp_profiles (
        citizen_id, title, first_name, last_name, sex, birth_date,
        position_name, position_number, level, special_position, emp_type,
        department, sub_department, mission_group, specialist, expert,
        start_work_date, first_entry_date, original_status,
        is_currently_active, status_code, status_text,
        source_system, source_updated_at, raw_snapshot, profile_fingerprint,
        last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HRMS', NOW(), CAST(? AS JSON), ?, NOW())
      ON DUPLICATE KEY UPDATE
        position_name = VALUES(position_name),
        level = VALUES(level),
        special_position = VALUES(special_position),
        department = VALUES(department),
        sub_department = VALUES(sub_department),
        is_currently_active = VALUES(is_currently_active),
        status_code = VALUES(status_code),
        status_text = VALUES(status_text),
        source_system = VALUES(source_system),
        source_updated_at = VALUES(source_updated_at),
        raw_snapshot = VALUES(raw_snapshot),
        profile_fingerprint = VALUES(profile_fingerprint),
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
      isCurrentlyActive,
      statusCode,
      statusText,
      safeRawSnapshot,
      profileFingerprint,
    ],
  );
};

export const persistEmployeeProfileSyncArtifacts = async (
  conn: PoolConnection,
  vEmp: RowDataPacket,
  syncBatchId: number | null,
): Promise<void> => {
  const { normalized, profileFingerprint } = buildNormalizedProfile(vEmp);
  const fpCols = await resolveFingerprintColumns(conn);

  if (fpCols.hasEmpFp) {
    await conn.execute(
      `
        UPDATE emp_profiles
        SET last_sync_batch_id = ?,
            profile_fingerprint = COALESCE(profile_fingerprint, ?)
        WHERE citizen_id = ?
      `,
      [syncBatchId, profileFingerprint, vEmp.citizen_id],
    );
  } else {
    await conn.execute(
      `
        UPDATE emp_profiles
        SET last_sync_batch_id = ?
        WHERE citizen_id = ?
      `,
      [syncBatchId, vEmp.citizen_id],
    );
  }

  if (!isSyncHistoryArtifactsEnabled()) {
    return;
  }

  const [lastHistoryRows] = await conn.query<RowDataPacket[]>(
    `
      SELECT history_id, position_name, level, department, sub_department,
             special_position, status_code, status_text, is_currently_active
             ${fpCols.hasHistoryFp ? ', profile_fingerprint' : ''}
      FROM emp_profile_history
      WHERE citizen_id = ? AND valid_to IS NULL
      ORDER BY history_id DESC
      LIMIT 1
    `,
    [vEmp.citizen_id],
  );
  const lastHistory = lastHistoryRows[0] as RowDataPacket | undefined;

  const isSameByFingerprint =
    fpCols.hasHistoryFp && lastHistory
      ? String(lastHistory.profile_fingerprint ?? '') === profileFingerprint
      : false;

  const isSameByFields =
    lastHistory &&
    String(lastHistory.position_name ?? '') === String(normalized.position_name ?? '') &&
    String(lastHistory.level ?? '') === String(normalized.level ?? '') &&
    String(lastHistory.department ?? '') === String(normalized.department ?? '') &&
    String(lastHistory.sub_department ?? '') === String(normalized.sub_department ?? '') &&
    String(lastHistory.special_position ?? '') === String(normalized.special_position ?? '') &&
    String(lastHistory.status_code ?? '') === String(normalized.status_code ?? '') &&
    String(lastHistory.status_text ?? '') === String(normalized.status_text ?? '') &&
    Number(lastHistory.is_currently_active ?? 0) === Number(normalized.is_currently_active ?? 0);

  if (isSameByFingerprint || isSameByFields) {
    return;
  }

  if (lastHistory?.history_id) {
    await conn.execute(
      `
        UPDATE emp_profile_history
        SET valid_to = NOW()
        WHERE history_id = ? AND valid_to IS NULL
      `,
      [lastHistory.history_id],
    );
  }

  if (fpCols.hasHistoryFp) {
    await conn.execute(
      `
        INSERT INTO emp_profile_history (
          citizen_id, position_name, level, department, sub_department,
          special_position, status_code, status_text, is_currently_active, profile_fingerprint,
          change_type, sync_batch_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNC_UPSERT', ?)
      `,
      [
        vEmp.citizen_id,
        normalized.position_name,
        normalized.level,
        normalized.department,
        normalized.sub_department,
        normalized.special_position,
        normalized.status_code,
        normalized.status_text,
        normalized.is_currently_active,
        profileFingerprint,
        syncBatchId,
      ],
    );
  } else {
    await conn.execute(
      `
        INSERT INTO emp_profile_history (
          citizen_id, position_name, level, department, sub_department,
          special_position, status_code, status_text, is_currently_active,
          change_type, sync_batch_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNC_UPSERT', ?)
      `,
      [
        vEmp.citizen_id,
        normalized.position_name,
        normalized.level,
        normalized.department,
        normalized.sub_department,
        normalized.special_position,
        normalized.status_code,
        normalized.status_text,
        normalized.is_currently_active,
        syncBatchId,
      ],
    );
  }

  if (fpCols.hasRawFp) {
    await conn.execute(
      `
        INSERT INTO emp_profile_raw_snapshots (
          citizen_id, source_table, raw_payload, normalized_payload, profile_fingerprint, sync_batch_id
        )
        VALUES (?, 'tb_ap_index_view', CAST(? AS JSON), CAST(? AS JSON), ?, ?)
      `,
      [
        vEmp.citizen_id,
        JSON.stringify(vEmp),
        JSON.stringify(normalized),
        profileFingerprint,
        syncBatchId,
      ],
    );
  } else {
    await conn.execute(
      `
        INSERT INTO emp_profile_raw_snapshots (
          citizen_id, source_table, raw_payload, normalized_payload, sync_batch_id
        )
        VALUES (?, 'tb_ap_index_view', CAST(? AS JSON), CAST(? AS JSON), ?)
      `,
      [
        vEmp.citizen_id,
        JSON.stringify(vEmp),
        JSON.stringify(normalized),
        syncBatchId,
      ],
    );
  }
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

const buildNormalizedSupportProfile = (vSup: RowDataPacket) => {
  const isCurrentlyActive = Number(vSup.is_currently_active) === 1 ? 1 : 0;
  const statusCode = isCurrentlyActive ? 'ACTIVE' : 'INACTIVE';
  const statusText = isCurrentlyActive ? 'ปฏิบัติงาน' : 'ไม่ปฏิบัติงาน';

  const normalized = {
    citizen_id: vSup.citizen_id ?? null,
    position_name: vSup.position_name ?? null,
    level: vSup.level ?? null,
    department: vSup.department ?? null,
    special_position: vSup.special_position ?? null,
    status_code: statusCode,
    status_text: statusText,
    is_currently_active: isCurrentlyActive,
  };

  const profileFingerprint = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');

  return {
    statusCode,
    statusText,
    normalized,
    profileFingerprint,
  };
};

export const computeSupportProfileFingerprint = (vSup: RowDataPacket): string => {
  return buildNormalizedSupportProfile(vSup).profileFingerprint;
};

type SupportFingerprintColumnFlags = {
  hasSupportHistoryTable: boolean;
  hasSupportRawTable: boolean;
  hasSupportFp: boolean;
  hasSupportHistoryFp: boolean;
  hasSupportRawFp: boolean;
};

const resolveSupportFingerprintColumns = async (
  conn: PoolConnection,
): Promise<SupportFingerprintColumnFlags> => {
  const [tableRows] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('emp_support_staff_history', 'emp_support_staff_raw_snapshots')`,
  );
  const tableSet = new Set(tableRows.map((r) => String(r.TABLE_NAME)));

  const [fpCols] = await conn.query<RowDataPacket[]>(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND (
         (TABLE_NAME = 'emp_support_staff' AND COLUMN_NAME = 'profile_fingerprint')
         OR (TABLE_NAME = 'emp_support_staff_history' AND COLUMN_NAME = 'profile_fingerprint')
         OR (TABLE_NAME = 'emp_support_staff_raw_snapshots' AND COLUMN_NAME = 'profile_fingerprint')
       )`,
  );

  return {
    hasSupportHistoryTable: tableSet.has('emp_support_staff_history'),
    hasSupportRawTable: tableSet.has('emp_support_staff_raw_snapshots'),
    hasSupportFp: fpCols.some((r) => r.TABLE_NAME === 'emp_support_staff'),
    hasSupportHistoryFp: fpCols.some((r) => r.TABLE_NAME === 'emp_support_staff_history'),
    hasSupportRawFp: fpCols.some((r) => r.TABLE_NAME === 'emp_support_staff_raw_snapshots'),
  };
};

export const persistSupportProfileSyncArtifacts = async (
  conn: PoolConnection,
  vSup: RowDataPacket,
  syncBatchId: number | null,
): Promise<void> => {
  const { normalized, profileFingerprint } = buildNormalizedSupportProfile(vSup);
  const supportCols = await resolveSupportStaffColumnFlags(conn);
  const fpCols = await resolveSupportFingerprintColumns(conn);

  if (supportCols.hasLastSyncBatchIdColumn && fpCols.hasSupportFp) {
    await conn.execute(
      `
        UPDATE emp_support_staff
        SET last_sync_batch_id = ?,
            profile_fingerprint = COALESCE(profile_fingerprint, ?)
        WHERE citizen_id = ?
      `,
      [syncBatchId, profileFingerprint, vSup.citizen_id],
    );
  } else if (supportCols.hasLastSyncBatchIdColumn) {
    await conn.execute(
      `
        UPDATE emp_support_staff
        SET last_sync_batch_id = ?
        WHERE citizen_id = ?
      `,
      [syncBatchId, vSup.citizen_id],
    );
  } else if (fpCols.hasSupportFp) {
    await conn.execute(
      `
        UPDATE emp_support_staff
        SET profile_fingerprint = COALESCE(profile_fingerprint, ?)
        WHERE citizen_id = ?
      `,
      [profileFingerprint, vSup.citizen_id],
    );
  }

  if (!isSyncHistoryArtifactsEnabled()) {
    return;
  }

  if (!fpCols.hasSupportHistoryTable && !fpCols.hasSupportRawTable) {
    return;
  }

  let lastHistory: RowDataPacket | undefined;
  if (fpCols.hasSupportHistoryTable) {
    const [lastHistoryRows] = await conn.query<RowDataPacket[]>(
      `
        SELECT history_id, position_name, level, department, special_position,
               status_code, status_text, is_currently_active
               ${fpCols.hasSupportHistoryFp ? ', profile_fingerprint' : ''}
        FROM emp_support_staff_history
        WHERE citizen_id = ? AND valid_to IS NULL
        ORDER BY history_id DESC
        LIMIT 1
      `,
      [vSup.citizen_id],
    );
    lastHistory = lastHistoryRows[0] as RowDataPacket | undefined;
  }

  const isSameByFingerprint =
    fpCols.hasSupportHistoryFp && lastHistory
      ? String(lastHistory.profile_fingerprint ?? '') === profileFingerprint
      : false;

  const isSameByFields =
    lastHistory &&
    String(lastHistory.position_name ?? '') === String(normalized.position_name ?? '') &&
    String(lastHistory.level ?? '') === String(normalized.level ?? '') &&
    String(lastHistory.department ?? '') === String(normalized.department ?? '') &&
    String(lastHistory.special_position ?? '') === String(normalized.special_position ?? '') &&
    String(lastHistory.status_code ?? '') === String(normalized.status_code ?? '') &&
    String(lastHistory.status_text ?? '') === String(normalized.status_text ?? '') &&
    Number(lastHistory.is_currently_active ?? 0) === Number(normalized.is_currently_active ?? 0);

  if (isSameByFingerprint || isSameByFields) {
    return;
  }

  if (fpCols.hasSupportHistoryTable && lastHistory?.history_id) {
    await conn.execute(
      `
        UPDATE emp_support_staff_history
        SET valid_to = NOW()
        WHERE history_id = ? AND valid_to IS NULL
      `,
      [lastHistory.history_id],
    );
  }

  if (fpCols.hasSupportHistoryTable && fpCols.hasSupportHistoryFp) {
    await conn.execute(
      `
        INSERT INTO emp_support_staff_history (
          citizen_id, position_name, level, department, special_position,
          status_code, status_text, is_currently_active, profile_fingerprint,
          change_type, sync_batch_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNC_UPSERT', ?)
      `,
      [
        vSup.citizen_id,
        normalized.position_name,
        normalized.level,
        normalized.department,
        normalized.special_position,
        normalized.status_code,
        normalized.status_text,
        normalized.is_currently_active,
        profileFingerprint,
        syncBatchId,
      ],
    );
  } else if (fpCols.hasSupportHistoryTable) {
    await conn.execute(
      `
        INSERT INTO emp_support_staff_history (
          citizen_id, position_name, level, department, special_position,
          status_code, status_text, is_currently_active,
          change_type, sync_batch_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNC_UPSERT', ?)
      `,
      [
        vSup.citizen_id,
        normalized.position_name,
        normalized.level,
        normalized.department,
        normalized.special_position,
        normalized.status_code,
        normalized.status_text,
        normalized.is_currently_active,
        syncBatchId,
      ],
    );
  }

  if (fpCols.hasSupportRawTable && fpCols.hasSupportRawFp) {
    await conn.execute(
      `
        INSERT INTO emp_support_staff_raw_snapshots (
          citizen_id, source_table, raw_payload, normalized_payload, profile_fingerprint, sync_batch_id
        )
        VALUES (?, 'tb_ap_index_view', CAST(? AS JSON), CAST(? AS JSON), ?, ?)
      `,
      [
        vSup.citizen_id,
        JSON.stringify(vSup),
        JSON.stringify(normalized),
        profileFingerprint,
        syncBatchId,
      ],
    );
  } else if (fpCols.hasSupportRawTable) {
    await conn.execute(
      `
        INSERT INTO emp_support_staff_raw_snapshots (
          citizen_id, source_table, raw_payload, normalized_payload, sync_batch_id
        )
        VALUES (?, 'tb_ap_index_view', CAST(? AS JSON), CAST(? AS JSON), ?)
      `,
      [
        vSup.citizen_id,
        JSON.stringify(vSup),
        JSON.stringify(normalized),
        syncBatchId,
      ],
    );
  }
};
