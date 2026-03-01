import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';
import type {
  LeaveReclassificationMeta,
  LeaveReviewMeta,
  LeaveNormalizationIssueMeta,
} from '@/modules/sync/services/domain/leave-normalizer.service.js';
import { isValidCitizenId } from '@/modules/sync/services/domain/leave-normalizer.service.js';

type LeaveRecordSqlOptions = {
  hasStatusColumn: boolean;
};

type MovementType =
  | 'ENTRY'
  | 'RESIGN'
  | 'RETIRE'
  | 'TRANSFER_OUT'
  | 'STUDY'
  | 'DEATH'
  | 'OTHER';

type SourceMovementRow = {
  source_movement_id: number;
  citizen_id: string;
  movement_type: MovementType;
  effective_date: Date | string;
  remark: string | null;
  source_updated_at: Date | string | null;
};

type ExistingMovementRow = {
  movement_id: number;
  source_movement_id: number | null;
  citizen_id: string;
  movement_type: MovementType;
  effective_date: Date | string;
  remark: string | null;
  source_updated_at: Date | string | null;
  synced_at: Date | string | null;
};

type SourceLicenseRow = {
  source_license_id: number;
  citizen_id: string;
  license_name: string | null;
  license_no: string | null;
  valid_from: Date | string;
  valid_until: Date | string;
  status: string | null;
  source_updated_at: Date | string | null;
};

type ExistingLicenseRow = {
  license_id: number;
  source_license_id: number | null;
  citizen_id: string;
  license_name: string | null;
  license_no: string | null;
  valid_from: Date | string;
  valid_until: Date | string;
  status: string | null;
  source_updated_at: Date | string | null;
};

type SourceQuotaRow = {
  citizen_id: string;
  fiscal_year: number;
  total_quota: number | string;
};

type ExistingQuotaRow = {
  quota_id: number;
  citizen_id: string;
  fiscal_year: number;
  quota_vacation: number | string;
};

const LEAVE_REF_ID_LOOKUP_CHUNK_SIZE = 1000;

const normalizeDateOnly = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

const normalizeDateTime = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    const seconds = `${value.getSeconds()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
  const raw = String(value).trim();
  if (!raw) return '';
  return raw.replace(' ', 'T').slice(0, 19);
};

const normalizeRemark = (value: string | null | undefined): string => String(value ?? '').trim();
const normalizeText = (value: string | null | undefined): string => String(value ?? '').trim();
const normalizeDecimal = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return String(value).trim();
  return parsed.toFixed(2);
};

const buildMovementCompositeKey = (row: {
  citizen_id: string;
  movement_type: MovementType;
  effective_date: Date | string;
  remark: string | null;
}): string =>
  [
    row.citizen_id,
    row.movement_type,
    normalizeDateOnly(row.effective_date),
    normalizeRemark(row.remark),
  ].join('|');

const isMovementChanged = (
  existing: ExistingMovementRow,
  source: SourceMovementRow,
): boolean =>
  existing.citizen_id !== source.citizen_id ||
  existing.movement_type !== source.movement_type ||
  normalizeDateOnly(existing.effective_date) !== normalizeDateOnly(source.effective_date) ||
  normalizeRemark(existing.remark) !== normalizeRemark(source.remark) ||
  normalizeDateTime(existing.source_updated_at) !== normalizeDateTime(source.source_updated_at);

const buildLicenseCompositeKey = (row: {
  citizen_id: string;
  license_no: string | null;
  valid_from: Date | string;
  valid_until: Date | string;
}): string =>
  [
    row.citizen_id,
    normalizeText(row.license_no),
    normalizeDateOnly(row.valid_from),
    normalizeDateOnly(row.valid_until),
  ].join('|');

const buildQuotaCompositeKey = (row: {
  citizen_id: string;
  fiscal_year: number;
}): string => `${row.citizen_id}|${Number(row.fiscal_year)}`;

const isLicenseChanged = (
  existing: ExistingLicenseRow,
  source: SourceLicenseRow,
): boolean =>
  existing.citizen_id !== source.citizen_id ||
  normalizeText(existing.license_name) !== normalizeText(source.license_name) ||
  normalizeText(existing.license_no) !== normalizeText(source.license_no) ||
  normalizeDateOnly(existing.valid_from) !== normalizeDateOnly(source.valid_from) ||
  normalizeDateOnly(existing.valid_until) !== normalizeDateOnly(source.valid_until) ||
  normalizeText(existing.status) !== normalizeText(source.status) ||
  normalizeDateTime(existing.source_updated_at) !== normalizeDateTime(source.source_updated_at);

const resolveMovementRemarkExpr = async (conn: PoolConnection): Promise<string> => {
  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = 'hrms_databases'
       AND TABLE_NAME = 'tb_bp_status'
       AND COLUMN_NAME IN ('remark', 'comment')`,
  );
  const colSet = new Set((cols as RowDataPacket[]).map((row) => String(row.COLUMN_NAME)));
  if (colSet.has('remark')) return 'm.remark';
  if (colSet.has('comment')) return 'm.comment';
  return 'NULL';
};

const loadSourceMovements = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<SourceMovementRow[]> => {
  const movementRemarkExpr = await resolveMovementRemarkExpr(conn);
  const params: string[] = [];
  const citizenWhere = options?.citizenId
    ? `
      AND CAST(m.id AS BINARY) = CAST(? AS BINARY)
    `
    : '';
  if (options?.citizenId) params.push(options.citizenId);

  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        m.bp_status_id AS source_movement_id,
        CAST(m.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
        CASE
          WHEN m.status_id IN ('1','2','3') THEN 'ENTRY'
          WHEN m.status_id = '4' THEN 'RETIRE'
          WHEN m.status_id = '5' THEN 'STUDY'
          WHEN m.status_id = '6' THEN 'DEATH'
          WHEN m.status_id IN ('7','8') THEN 'TRANSFER_OUT'
          WHEN m.status_id = '9' THEN 'RESIGN'
          ELSE 'OTHER'
        END AS movement_type,
        m.date AS effective_date,
        ${movementRemarkExpr} AS remark,
        m.timestamp AS source_updated_at
      FROM hrms_databases.tb_bp_status m
      JOIN emp_profiles e
        ON CAST(e.citizen_id AS BINARY) = CAST(m.id AS BINARY)
      WHERE m.bp_status_id IS NOT NULL
      ${citizenWhere}
      ORDER BY m.bp_status_id ASC
    `,
    params,
  );

  return rows as SourceMovementRow[];
};

const loadSourceLicenses = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<SourceLicenseRow[]> => {
  const params: string[] = [];
  const citizenWhere = options?.citizenId
    ? `
      AND CAST(l.id AS BINARY) = CAST(? AS BINARY)
    `
    : '';
  if (options?.citizenId) params.push(options.citizenId);

  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT
        ranked.source_license_id,
        ranked.citizen_id,
        ranked.license_name,
        ranked.license_no,
        ranked.valid_from,
        ranked.valid_until,
        ranked.status,
        ranked.source_updated_at
      FROM (
        SELECT
          l.bp_license_id AS source_license_id,
          CAST(l.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
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
          l.timestamp AS source_updated_at,
          ROW_NUMBER() OVER (
            PARTITION BY
              CAST(l.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
              COALESCE(l.certificate_number, ''),
              l.date_start,
              CAST(
                CASE
                  WHEN CAST(l.date_end AS CHAR CHARACTER SET utf8mb4) = '0000-00-00' THEN '9999-12-31'
                  ELSE l.date_end
                END AS DATE
              )
            ORDER BY l.timestamp DESC, l.bp_license_id DESC
          ) AS rn
        FROM hrms_databases.tb_bp_license l
        JOIN emp_profiles e
          ON CAST(e.citizen_id AS BINARY) = CAST(l.id AS BINARY)
        WHERE l.bp_license_id IS NOT NULL
          AND l.date_end IS NOT NULL
        ${citizenWhere}
      ) ranked
      WHERE ranked.rn = 1
      ORDER BY ranked.source_license_id ASC
    `,
    params,
  );

  return rows as SourceLicenseRow[];
};

const loadExistingMovements = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<ExistingMovementRow[]> => {
  const params: string[] = [];
  const where = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) params.push(options.citizenId);
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT movement_id,
             source_movement_id,
             citizen_id,
             movement_type,
             effective_date,
             remark,
             source_updated_at,
             synced_at
      FROM emp_movements
      ${where}
      ORDER BY movement_id DESC
    `,
    params,
  );
  return rows as ExistingMovementRow[];
};

const loadExistingLicenses = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<ExistingLicenseRow[]> => {
  const params: string[] = [];
  const where = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) params.push(options.citizenId);
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT license_id,
             source_license_id,
             citizen_id,
             license_name,
             license_no,
             valid_from,
             valid_until,
             status,
             source_updated_at
      FROM emp_licenses
      ${where}
      ORDER BY license_id DESC
    `,
    params,
  );
  return rows as ExistingLicenseRow[];
};

const loadSourceQuotas = async (
  conn: PoolConnection,
  buildQuotasViewQuery: (() => string) | null,
  options?: { citizenId?: string },
): Promise<SourceQuotaRow[]> => {
  if (options?.citizenId) {
    const [rows] = await conn.query<RowDataPacket[]>(
      `
        SELECT CAST(sd.emp_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS citizen_id,
               CAST(sd.year AS UNSIGNED) AS fiscal_year,
               CAST(sd.setday AS DECIMAL(10,2)) AS total_quota
        FROM hrms_databases.setdays sd
        WHERE CAST(sd.emp_id AS BINARY) = CAST(? AS BINARY)
      `,
      [options.citizenId],
    );
    return rows as SourceQuotaRow[];
  }

  if (!buildQuotasViewQuery) return [];
  const [rows] = await conn.query<RowDataPacket[]>(buildQuotasViewQuery());
  return rows as SourceQuotaRow[];
};

const loadExistingQuotas = async (
  conn: PoolConnection,
  options?: { citizenId?: string },
): Promise<ExistingQuotaRow[]> => {
  const params: string[] = [];
  const where = options?.citizenId ? 'WHERE citizen_id = ?' : '';
  if (options?.citizenId) params.push(options.citizenId);
  const [rows] = await conn.query<RowDataPacket[]>(
    `
      SELECT quota_id, citizen_id, fiscal_year, quota_vacation
      FROM leave_quotas
      ${where}
    `,
    params,
  );
  return rows as ExistingQuotaRow[];
};

const loadExistingLeavesByRefIds = async (
  conn: PoolConnection,
  refIds: string[],
  options: { hasStatusColumn: boolean },
): Promise<RowDataPacket[]> => {
  const uniqueRefIds = [...new Set(refIds.map((refId) => String(refId ?? '').trim()).filter(Boolean))];
  if (uniqueRefIds.length === 0) return [];

  const fields = ['ref_id', 'start_date', 'end_date', 'leave_type', 'duration_days', 'fiscal_year', 'remark'];
  if (options.hasStatusColumn) fields.push('status');

  const rows: RowDataPacket[] = [];
  for (let i = 0; i < uniqueRefIds.length; i += LEAVE_REF_ID_LOOKUP_CHUNK_SIZE) {
    const chunk = uniqueRefIds.slice(i, i + LEAVE_REF_ID_LOOKUP_CHUNK_SIZE);
    const [chunkRows] = await conn.query<RowDataPacket[]>(
      `SELECT ${fields.join(', ')} FROM leave_records WHERE ref_id IN (?)`,
      [chunk],
    );
    rows.push(...chunkRows);
  }

  return rows;
};

const syncMovementRows = async (
  conn: PoolConnection,
  sourceRows: SourceMovementRow[],
  existingRows: ExistingMovementRow[],
): Promise<void> => {
  const existingBySourceId = new Map<number, ExistingMovementRow>();
  const existingByComposite = new Map<string, ExistingMovementRow[]>();

  for (const row of existingRows) {
    if (row.source_movement_id != null && !existingBySourceId.has(Number(row.source_movement_id))) {
      existingBySourceId.set(Number(row.source_movement_id), row);
      continue;
    }

    const key = buildMovementCompositeKey(row);
    const bucket = existingByComposite.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      existingByComposite.set(key, [row]);
    }
  }

  const seenSourceIds = new Set<number>();

  for (const sourceRow of sourceRows) {
    const sourceId = Number(sourceRow.source_movement_id);
    seenSourceIds.add(sourceId);

    const bySourceId = existingBySourceId.get(sourceId);
    if (bySourceId) {
      if (!isMovementChanged(bySourceId, sourceRow)) {
        continue;
      }
      await conn.execute(
        `
          UPDATE emp_movements
          SET citizen_id = ?,
              movement_type = ?,
              effective_date = ?,
              remark = ?,
              source_updated_at = ?,
              synced_at = NOW()
          WHERE movement_id = ?
        `,
        [
          sourceRow.citizen_id,
          sourceRow.movement_type,
          normalizeDateOnly(sourceRow.effective_date),
          sourceRow.remark,
          normalizeDateTime(sourceRow.source_updated_at) || null,
          bySourceId.movement_id,
        ],
      );
      continue;
    }

    const compositeKey = buildMovementCompositeKey(sourceRow);
    const compositeMatches = existingByComposite.get(compositeKey) ?? [];
    const fallback = compositeMatches.shift();
    if (compositeMatches.length === 0) {
      existingByComposite.delete(compositeKey);
    } else {
      existingByComposite.set(compositeKey, compositeMatches);
    }

    if (fallback) {
      await conn.execute(
        `
          UPDATE emp_movements
          SET source_movement_id = ?,
              citizen_id = ?,
              movement_type = ?,
              effective_date = ?,
              remark = ?,
              source_updated_at = ?,
              synced_at = NOW()
          WHERE movement_id = ?
        `,
        [
          sourceId,
          sourceRow.citizen_id,
          sourceRow.movement_type,
          normalizeDateOnly(sourceRow.effective_date),
          sourceRow.remark,
          normalizeDateTime(sourceRow.source_updated_at) || null,
          fallback.movement_id,
        ],
      );
      existingBySourceId.set(sourceId, {
        ...fallback,
        source_movement_id: sourceId,
        citizen_id: sourceRow.citizen_id,
        movement_type: sourceRow.movement_type,
        effective_date: normalizeDateOnly(sourceRow.effective_date),
        remark: sourceRow.remark,
        source_updated_at: normalizeDateTime(sourceRow.source_updated_at) || null,
      });
      continue;
    }

    await conn.execute(
      `
        INSERT INTO emp_movements (
          source_movement_id,
          citizen_id,
          movement_type,
          effective_date,
          remark,
          source_updated_at,
          synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        sourceId,
        sourceRow.citizen_id,
        sourceRow.movement_type,
        normalizeDateOnly(sourceRow.effective_date),
        sourceRow.remark,
        normalizeDateTime(sourceRow.source_updated_at) || null,
      ],
    );
  }

  const staleMovementIds = existingRows
    .filter(
      (row) =>
        row.source_movement_id != null && !seenSourceIds.has(Number(row.source_movement_id)),
    )
    .map((row) => row.movement_id);

  for (const movementId of staleMovementIds) {
    await conn.execute(`DELETE FROM emp_movements WHERE movement_id = ?`, [movementId]);
  }
};

const syncLicenseRows = async (
  conn: PoolConnection,
  sourceRows: SourceLicenseRow[],
  existingRows: ExistingLicenseRow[],
): Promise<number> => {
  const existingBySourceId = new Map<number, ExistingLicenseRow>();
  const existingByComposite = new Map<string, ExistingLicenseRow[]>();

  for (const row of existingRows) {
    if (row.source_license_id != null && !existingBySourceId.has(Number(row.source_license_id))) {
      existingBySourceId.set(Number(row.source_license_id), row);
      continue;
    }

    const key = buildLicenseCompositeKey(row);
    const bucket = existingByComposite.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      existingByComposite.set(key, [row]);
    }
  }

  const seenSourceIds = new Set<number>();
  let upserted = 0;

  for (const sourceRow of sourceRows) {
    const sourceId = Number(sourceRow.source_license_id);
    seenSourceIds.add(sourceId);

    const bySourceId = existingBySourceId.get(sourceId);
    if (bySourceId) {
      if (!isLicenseChanged(bySourceId, sourceRow)) {
        continue;
      }
      await conn.execute(
        `
          UPDATE emp_licenses
          SET citizen_id = ?,
              license_name = ?,
              license_no = ?,
              valid_from = ?,
              valid_until = ?,
              status = ?,
              source_updated_at = ?,
              synced_at = NOW()
          WHERE license_id = ?
        `,
        [
          sourceRow.citizen_id,
          sourceRow.license_name,
          sourceRow.license_no,
          normalizeDateOnly(sourceRow.valid_from),
          normalizeDateOnly(sourceRow.valid_until),
          sourceRow.status,
          normalizeDateTime(sourceRow.source_updated_at) || null,
          bySourceId.license_id,
        ],
      );
      upserted++;
      continue;
    }

    const compositeKey = buildLicenseCompositeKey(sourceRow);
    const compositeMatches = existingByComposite.get(compositeKey) ?? [];
    const fallback = compositeMatches.shift();
    if (compositeMatches.length === 0) {
      existingByComposite.delete(compositeKey);
    } else {
      existingByComposite.set(compositeKey, compositeMatches);
    }

    if (fallback) {
      await conn.execute(
        `
          UPDATE emp_licenses
          SET source_license_id = ?,
              citizen_id = ?,
              license_name = ?,
              license_no = ?,
              valid_from = ?,
              valid_until = ?,
              status = ?,
              source_updated_at = ?,
              synced_at = NOW()
          WHERE license_id = ?
        `,
        [
          sourceId,
          sourceRow.citizen_id,
          sourceRow.license_name,
          sourceRow.license_no,
          normalizeDateOnly(sourceRow.valid_from),
          normalizeDateOnly(sourceRow.valid_until),
          sourceRow.status,
          normalizeDateTime(sourceRow.source_updated_at) || null,
          fallback.license_id,
        ],
      );
      existingBySourceId.set(sourceId, {
        ...fallback,
        source_license_id: sourceId,
        citizen_id: sourceRow.citizen_id,
        license_name: sourceRow.license_name,
        license_no: sourceRow.license_no,
        valid_from: normalizeDateOnly(sourceRow.valid_from),
        valid_until: normalizeDateOnly(sourceRow.valid_until),
        status: sourceRow.status,
        source_updated_at: normalizeDateTime(sourceRow.source_updated_at) || null,
      });
      upserted++;
      continue;
    }

    await conn.execute(
      `
        INSERT INTO emp_licenses (
          source_license_id,
          citizen_id,
          license_name,
          license_no,
          valid_from,
          valid_until,
          status,
          source_updated_at,
          synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        sourceId,
        sourceRow.citizen_id,
        sourceRow.license_name,
        sourceRow.license_no,
        normalizeDateOnly(sourceRow.valid_from),
        normalizeDateOnly(sourceRow.valid_until),
        sourceRow.status,
        normalizeDateTime(sourceRow.source_updated_at) || null,
      ],
    );
    upserted++;
  }

  const staleLicenseIds = existingRows
    .filter((row) => row.source_license_id != null && !seenSourceIds.has(Number(row.source_license_id)))
    .map((row) => row.license_id);

  for (const licenseId of staleLicenseIds) {
    await conn.execute(`DELETE FROM emp_licenses WHERE license_id = ?`, [licenseId]);
  }

  return upserted;
};

const syncQuotaRows = async (
  conn: PoolConnection,
  sourceRows: SourceQuotaRow[],
  existingRows: ExistingQuotaRow[],
  deps: {
    upsertLeaveQuota: (
      conn: PoolConnection,
      citizenId: string,
      fiscalYear: unknown,
      totalQuota: unknown,
    ) => Promise<void>;
  },
): Promise<number> => {
  const existingByKey = new Map<string, ExistingQuotaRow>();
  for (const row of existingRows) {
    existingByKey.set(buildQuotaCompositeKey(row), row);
  }

  let upserted = 0;

  for (const sourceRow of sourceRows) {
    const key = buildQuotaCompositeKey(sourceRow);
    const existing = existingByKey.get(key);
    if (existing && normalizeDecimal(existing.quota_vacation) === normalizeDecimal(sourceRow.total_quota)) {
      continue;
    }

    await deps.upsertLeaveQuota(conn, sourceRow.citizen_id, sourceRow.fiscal_year, sourceRow.total_quota);
    upserted++;
  }

  return upserted;
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
  const [sourceLicenses, existingLicenses] = await Promise.all([
    loadSourceLicenses(conn),
    loadExistingLicenses(conn),
  ]);
  stats.licenses.upserted += await syncLicenseRows(conn, sourceLicenses, existingLicenses);

  const [sourceQuotas, existingQuotas] = await Promise.all([
    loadSourceQuotas(conn, deps.buildQuotasViewQuery),
    loadExistingQuotas(conn),
  ]);
  stats.quotas.upserted += await syncQuotaRows(conn, sourceQuotas, existingQuotas, {
    upsertLeaveQuota: deps.upsertLeaveQuota,
  });
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
    normalizeLeaveRowWithMeta: (row: RowDataPacket) => {
      row: RowDataPacket;
      meta: LeaveReclassificationMeta | null;
      reviewMeta: LeaveReviewMeta | null;
      normalizationIssues: LeaveNormalizationIssueMeta[];
    };
    onLeaveReclassified?: (input: {
      sourceKey: string;
      citizenId: string;
      remark: string;
      meta: LeaveReclassificationMeta;
    }) => Promise<void>;
    onLeaveReviewFlagged?: (input: {
      sourceKey: string;
      citizenId: string;
      remark: string;
      meta: LeaveReviewMeta;
    }) => Promise<void>;
    onLeaveNormalizationIssue?: (input: {
      sourceKey: string;
      citizenId: string;
      meta: LeaveNormalizationIssueMeta;
    }) => Promise<void>;
  },
): Promise<void> => {
  console.log('[SyncService] Processing leave requests...');
  const hasStatusColumn = await deps.hasLeaveStatusColumn(conn);

  const sqlOptions: LeaveRecordSqlOptions = { hasStatusColumn };
  const { sql } = deps.buildLeaveRecordSql(sqlOptions);
  const [viewLeaves] = await conn.query<RowDataPacket[]>(deps.buildLeaveViewQuery());
  const existingLeaves = await loadExistingLeavesByRefIds(
    conn,
    viewLeaves.map((leave) => String(leave.ref_id ?? '')),
    { hasStatusColumn },
  );
  const leaveMap = new Map(existingLeaves.map((l) => [l.ref_id, l]));

  for (const sourceLeave of viewLeaves) {
    const leaveWithRawType = {
      ...sourceLeave,
      raw_hrms_leave_type: sourceLeave.hrms_leave_type ?? sourceLeave.leave_type ?? null,
    } as RowDataPacket;
    const normalized = deps.normalizeLeaveRowWithMeta(leaveWithRawType);
    const vLeave = normalized.row;
    if (deps.onLeaveNormalizationIssue && vLeave.ref_id && vLeave.citizen_id) {
      for (const issue of normalized.normalizationIssues) {
        await deps.onLeaveNormalizationIssue({
          sourceKey: String(vLeave.ref_id),
          citizenId: String(vLeave.citizen_id),
          meta: issue,
        });
      }
    }
    if (!vLeave.ref_id || !isValidCitizenId(vLeave.citizen_id) || !vLeave.start_date || !vLeave.end_date) {
      stats.leaves.skipped++;
      continue;
    }
    if (
      normalized.meta &&
      deps.onLeaveReclassified &&
      vLeave.citizen_id
    ) {
      await deps.onLeaveReclassified({
        sourceKey: String(vLeave.ref_id),
        citizenId: String(vLeave.citizen_id),
        remark: String(vLeave.remark ?? ''),
        meta: normalized.meta,
      });
    }
    if (
      normalized.reviewMeta &&
      deps.onLeaveReviewFlagged &&
      vLeave.citizen_id
    ) {
      await deps.onLeaveReviewFlagged({
        sourceKey: String(vLeave.ref_id),
        citizenId: String(vLeave.citizen_id),
        remark: String(vLeave.remark ?? ''),
        meta: normalized.reviewMeta,
      });
    }
    const dbLeave = leaveMap.get(vLeave.ref_id);

    if (dbLeave) {
      const dateChanged =
        deps.isChanged(dbLeave.start_date, vLeave.start_date) ||
        deps.isChanged(dbLeave.end_date, vLeave.end_date);
      const leaveTypeChanged = deps.isChanged(dbLeave.leave_type, vLeave.leave_type);
      const durationChanged = deps.isChanged(
        normalizeDecimal(dbLeave.duration_days),
        normalizeDecimal(vLeave.duration_days),
      );
      const fiscalYearChanged = deps.isChanged(dbLeave.fiscal_year, vLeave.fiscal_year);
      const remarkChanged = deps.isChanged(
        normalizeRemark(dbLeave.remark),
        normalizeRemark(vLeave.remark),
      );
      const statusChanged = hasStatusColumn ? deps.isChanged(dbLeave.status, vLeave.status) : false;
      if (
        !dateChanged &&
        !leaveTypeChanged &&
        !durationChanged &&
        !fiscalYearChanged &&
        !remarkChanged &&
        !statusChanged
      ) {
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
    applyImmediateMovementEligibilityCutoff: (date: Date, conn: PoolConnection) => Promise<unknown>;
  },
): Promise<void> => {
  console.log('[SyncService] Processing movements...');
  const [sourceRows, existingRows] = await Promise.all([
    loadSourceMovements(conn),
    loadExistingMovements(conn),
  ]);
  await syncMovementRows(conn, sourceRows, existingRows);
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
  const [sourceRows, existingRows] = await Promise.all([
    loadSourceLicenses(conn, { citizenId }),
    loadExistingLicenses(conn, { citizenId }),
  ]);
  await syncLicenseRows(conn, sourceRows, existingRows);
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
  const [sourceRows, existingRows] = await Promise.all([
    loadSourceQuotas(conn, null, { citizenId }),
    loadExistingQuotas(conn, { citizenId }),
  ]);
  stats.quotas.upserted += await syncQuotaRows(conn, sourceRows, existingRows, {
    upsertLeaveQuota: deps.upsertLeaveQuota,
  });
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
    buildSingleLeaveViewQuery?: (citizenWhereExpr: string) => string;
    citizenIdWhereBinary: (alias: string, placeholder: string) => string;
    normalizeLeaveRowWithMeta: (row: RowDataPacket) => {
      row: RowDataPacket;
      meta: LeaveReclassificationMeta | null;
      reviewMeta: LeaveReviewMeta | null;
      normalizationIssues: LeaveNormalizationIssueMeta[];
    };
    onLeaveReclassified?: (input: {
      sourceKey: string;
      citizenId: string;
      remark: string;
      meta: LeaveReclassificationMeta;
    }) => Promise<void>;
    onLeaveReviewFlagged?: (input: {
      sourceKey: string;
      citizenId: string;
      remark: string;
      meta: LeaveReviewMeta;
    }) => Promise<void>;
    onLeaveNormalizationIssue?: (input: {
      sourceKey: string;
      citizenId: string;
      meta: LeaveNormalizationIssueMeta;
    }) => Promise<void>;
  },
): Promise<void> => {
  const hasStatusColumn = await deps.hasLeaveStatusColumn(conn);
  const leaveSqlOptions: LeaveRecordSqlOptions = { hasStatusColumn };
  const { sql: leaveSql } = deps.buildLeaveRecordSql(leaveSqlOptions);
  const citizenWhereExpr = deps.citizenIdWhereBinary('lr', '?');
  const sourceSql = deps.buildSingleLeaveViewQuery
    ? deps.buildSingleLeaveViewQuery(citizenWhereExpr)
    : `SELECT lr.*
       FROM (${deps.buildLeaveViewQuery()}) lr
       WHERE ${citizenWhereExpr}`;
  const sourceParams = deps.buildSingleLeaveViewQuery
    ? [citizenId, citizenId, citizenId]
    : [citizenId];

  const [viewLeaves] = await conn.query<RowDataPacket[]>(
    sourceSql,
    sourceParams,
  );

  for (const sourceLeave of viewLeaves) {
    const leaveWithRawType = {
      ...sourceLeave,
      raw_hrms_leave_type: sourceLeave.hrms_leave_type ?? sourceLeave.leave_type ?? null,
    } as RowDataPacket;
    const normalized = deps.normalizeLeaveRowWithMeta(leaveWithRawType);
    const vLeave = normalized.row;
    if (deps.onLeaveNormalizationIssue && vLeave.ref_id && vLeave.citizen_id) {
      for (const issue of normalized.normalizationIssues) {
        await deps.onLeaveNormalizationIssue({
          sourceKey: String(vLeave.ref_id),
          citizenId: String(vLeave.citizen_id),
          meta: issue,
        });
      }
    }
    if (!vLeave.ref_id || !isValidCitizenId(vLeave.citizen_id) || !vLeave.start_date || !vLeave.end_date) {
      stats.leaves.skipped++;
      continue;
    }
    if (
      normalized.meta &&
      deps.onLeaveReclassified &&
      vLeave.citizen_id
    ) {
      await deps.onLeaveReclassified({
        sourceKey: String(vLeave.ref_id),
        citizenId: String(vLeave.citizen_id),
        remark: String(vLeave.remark ?? ''),
        meta: normalized.meta,
      });
    }
    if (
      normalized.reviewMeta &&
      deps.onLeaveReviewFlagged &&
      vLeave.citizen_id
    ) {
      await deps.onLeaveReviewFlagged({
        sourceKey: String(vLeave.ref_id),
        citizenId: String(vLeave.citizen_id),
        remark: String(vLeave.remark ?? ''),
        meta: normalized.reviewMeta,
      });
    }
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
  const [sourceRows, existingRows] = await Promise.all([
    loadSourceMovements(conn, { citizenId }),
    loadExistingMovements(conn, { citizenId }),
  ]);
  await syncMovementRows(conn, sourceRows, existingRows);
  await deps.applyImmediateMovementEligibilityCutoff(new Date(), conn);
};
