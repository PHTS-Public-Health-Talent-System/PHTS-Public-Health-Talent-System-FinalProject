import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';

type LeaveRecordSqlOptions = {
  hasStatusColumn: boolean;
};

export const syncSignatures = async (
  conn: PoolConnection,
  stats: SyncStats,
  deps: {
    buildSignaturesViewQuery: () => string;
  },
): Promise<void> => {
  console.log('[SyncService] Processing signatures...');
  const [existingSigs] = await conn.query<RowDataPacket[]>('SELECT citizen_id FROM sig_images');
  const sigSet = new Set(existingSigs.map((s) => s.citizen_id));

  const [viewSigs] = await conn.query<RowDataPacket[]>(deps.buildSignaturesViewQuery());

  for (const vSig of viewSigs) {
    if (!vSig.citizen_id || sigSet.has(vSig.citizen_id)) {
      stats.signatures.skipped++;
      continue;
    }
    await conn.execute(
      `
          INSERT INTO sig_images (citizen_id, signature_image, updated_at) VALUES (?, ?, NOW())
        `,
      [vSig.citizen_id, vSig.signature_blob],
    );
    stats.signatures.added++;
  }
};

export const syncLicensesAndQuotas = async (
  conn: PoolConnection,
  stats: SyncStats,
  deps: {
    buildLicensesViewQuery: () => string;
    buildQuotasViewQuery: () => string;
    upsertLeaveQuota: (
      conn: PoolConnection,
      citizenId: string,
      fiscalYear: unknown,
      totalQuota: unknown,
    ) => Promise<void>;
  },
): Promise<void> => {
  console.log('[SyncService] Processing licenses and quotas...');
  await conn.query(deps.buildLicensesViewQuery());

  const [viewQuotas] = await conn.query<RowDataPacket[]>(deps.buildQuotasViewQuery());
  for (const q of viewQuotas) {
    await deps.upsertLeaveQuota(conn, q.citizen_id, q.fiscal_year, q.total_quota);
    stats.quotas.upserted++;
  }
};

export const syncLeaves = async (
  conn: PoolConnection,
  stats: SyncStats,
  deps: {
    hasLeaveStatusColumn: (conn: PoolConnection) => Promise<boolean>;
    buildLeaveRecordSql: (options: LeaveRecordSqlOptions) => { sql: string; fields: string[] };
    buildLeaveRecordValues: (vLeave: RowDataPacket, options: LeaveRecordSqlOptions) => unknown[];
    buildLeaveViewQuery: () => string;
    isChanged: (oldVal: unknown, newVal: unknown) => boolean;
    normalizeLeaveRow?: (row: RowDataPacket) => RowDataPacket;
    applyTransformRow?: (input: {
      targetView: string;
      sourceKey: string;
      row: RowDataPacket;
    }) => Promise<RowDataPacket>;
  },
): Promise<void> => {
  console.log('[SyncService] Processing leave requests...');
  const hasStatusColumn = await deps.hasLeaveStatusColumn(conn);

  const sqlOptions: LeaveRecordSqlOptions = { hasStatusColumn };
  const { sql } = deps.buildLeaveRecordSql(sqlOptions);

  const existingFields = ['ref_id', 'start_date', 'end_date'];
  if (hasStatusColumn) existingFields.push('status');
  const existingSelect = `SELECT ${existingFields.join(', ')} FROM leave_records WHERE ref_id IS NOT NULL`;

  const [existingLeaves] = await conn.query<RowDataPacket[]>(existingSelect);
  const leaveMap = new Map(existingLeaves.map((l) => [l.ref_id, l]));

  const [viewLeaves] = await conn.query<RowDataPacket[]>(deps.buildLeaveViewQuery());

  for (const sourceLeave of viewLeaves) {
    const preparedLeave = deps.applyTransformRow
      ? await deps.applyTransformRow({
          targetView: 'vw_hrms_leave_requests',
          sourceKey: String(sourceLeave.ref_id ?? ''),
          row: sourceLeave,
        })
      : sourceLeave;
    const rawLeave = deps.normalizeLeaveRow ? deps.normalizeLeaveRow(preparedLeave) : preparedLeave;
    const vLeave = rawLeave;
    if (!vLeave.ref_id) continue;
    const dbLeave = leaveMap.get(vLeave.ref_id);

    if (dbLeave) {
      const dateChanged =
        deps.isChanged(dbLeave.start_date, vLeave.start_date) ||
        deps.isChanged(dbLeave.end_date, vLeave.end_date);
      const statusChanged = hasStatusColumn ? deps.isChanged(dbLeave.status, vLeave.status) : false;
      if (!dateChanged && !statusChanged) {
        stats.leaves.skipped++;
        continue;
      }
    }

    const values = deps.buildLeaveRecordValues(vLeave, sqlOptions);
    await conn.execute(sql, values);
    stats.leaves.upserted++;
  }
};

export const syncMovements = async (
  conn: PoolConnection,
  deps: {
    buildMovementsViewQuery: () => string;
    applyImmediateMovementEligibilityCutoff: (date: Date, conn: PoolConnection) => Promise<unknown>;
  },
): Promise<void> => {
  console.log('[SyncService] Processing movements...');
  await conn.query(deps.buildMovementsViewQuery());
  await deps.applyImmediateMovementEligibilityCutoff(new Date(), conn);
};

export const syncSingleSignature = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
  deps: {
    citizenIdWhereBinary: (alias: string, placeholder: string) => string;
  },
): Promise<void> => {
  const [viewSigs] = await conn.query<RowDataPacket[]>(
    `
      SELECT DISTINCT
        CAST(s.emp_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
        s.images AS signature_blob
      FROM hrms_databases.signature s
      WHERE s.images IS NOT NULL
        AND s.images <> ''
        AND CAST(s.emp_id AS BINARY) = CAST(? AS BINARY)
    `,
    [citizenId],
  );
  const vSig = viewSigs[0];
  if (!vSig) return;
  const [existingSigs] = await conn.query<RowDataPacket[]>(
    `SELECT citizen_id FROM sig_images WHERE ${deps.citizenIdWhereBinary('sig_images', '?')}`,
    [vSig.citizen_id],
  );
  if (existingSigs.length) {
    stats.signatures.skipped++;
    return;
  }
  await conn.execute(
    `INSERT INTO sig_images (citizen_id, signature_image, updated_at) VALUES (?, ?, NOW())`,
    [vSig.citizen_id, vSig.signature_blob],
  );
  stats.signatures.added++;
};

export const syncSingleLicenses = async (
  conn: PoolConnection,
  citizenId: string,
): Promise<void> => {
  await conn.execute(
    `
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
      WHERE CAST(l.id AS BINARY) = CAST(? AS BINARY)
      ON DUPLICATE KEY UPDATE
        license_name=VALUES(license_name),
        valid_from=VALUES(valid_from),
        valid_until=VALUES(valid_until),
        status=VALUES(status),
        synced_at=NOW()
    `,
    [citizenId],
  );
};

export const syncSingleQuotas = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
  deps: {
    upsertLeaveQuota: (
      conn: PoolConnection,
      citizenId: string,
      fiscalYear: unknown,
      totalQuota: unknown,
    ) => Promise<void>;
  },
): Promise<void> => {
  const [viewQuotas] = await conn.query<RowDataPacket[]>(
    `
      SELECT CAST(sd.emp_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
             CAST(sd.year AS UNSIGNED) AS fiscal_year,
             CAST(sd.setday AS DECIMAL(10,2)) AS total_quota
      FROM hrms_databases.setdays sd
      WHERE CAST(sd.emp_id AS BINARY) = CAST(? AS BINARY)
    `,
    [citizenId],
  );
  for (const q of viewQuotas) {
    await deps.upsertLeaveQuota(conn, q.citizen_id, q.fiscal_year, q.total_quota);
    stats.quotas.upserted++;
  }
};

export const syncSingleLeaves = async (
  conn: PoolConnection,
  citizenId: string,
  stats: SyncStats,
  deps: {
    hasLeaveStatusColumn: (conn: PoolConnection) => Promise<boolean>;
    buildLeaveRecordSql: (options: LeaveRecordSqlOptions) => { sql: string; fields: string[] };
    buildLeaveRecordValues: (vLeave: RowDataPacket, options: LeaveRecordSqlOptions) => unknown[];
    buildLeaveViewQuery: () => string;
    citizenIdWhereBinary: (alias: string, placeholder: string) => string;
    normalizeLeaveRow?: (row: RowDataPacket) => RowDataPacket;
    applyTransformRow?: (input: {
      targetView: string;
      sourceKey: string;
      row: RowDataPacket;
    }) => Promise<RowDataPacket>;
  },
): Promise<void> => {
  const hasStatusColumn = await deps.hasLeaveStatusColumn(conn);
  const leaveSqlOptions: LeaveRecordSqlOptions = { hasStatusColumn };
  const { sql: leaveSql } = deps.buildLeaveRecordSql(leaveSqlOptions);

  const [viewLeaves] = await conn.query<RowDataPacket[]>(
    `SELECT lr.*
     FROM (${deps.buildLeaveViewQuery()}) lr
     WHERE ${deps.citizenIdWhereBinary('lr', '?')}`,
    [citizenId],
  );

  for (const sourceLeave of viewLeaves) {
    const preparedLeave = deps.applyTransformRow
      ? await deps.applyTransformRow({
          targetView: 'vw_hrms_leave_requests',
          sourceKey: String(sourceLeave.ref_id ?? ''),
          row: sourceLeave,
        })
      : sourceLeave;
    const rawLeave = deps.normalizeLeaveRow ? deps.normalizeLeaveRow(preparedLeave) : preparedLeave;
    const vLeave = rawLeave;
    if (!vLeave.ref_id) continue;
    const leaveValues = deps.buildLeaveRecordValues(vLeave, leaveSqlOptions);
    await conn.execute(leaveSql, leaveValues);
    stats.leaves.upserted++;
  }
};

export const syncSingleMovements = async (
  conn: PoolConnection,
  citizenId: string,
  deps: {
    applyImmediateMovementEligibilityCutoff: (date: Date, conn: PoolConnection) => Promise<unknown>;
  },
): Promise<void> => {
  await conn.execute(
    `
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
      WHERE CAST(m.id AS BINARY) = CAST(? AS BINARY)
      ON DUPLICATE KEY UPDATE
        movement_type = VALUES(movement_type),
        effective_date = VALUES(effective_date),
        remark = VALUES(remark),
        synced_at = NOW()
    `,
    [citizenId],
  );
  await deps.applyImmediateMovementEligibilityCutoff(new Date(), conn);
};
