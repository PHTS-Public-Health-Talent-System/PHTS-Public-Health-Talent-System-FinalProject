import { RowDataPacket } from "mysql2/promise";
import { query } from '@config/database.js';
import crypto from "node:crypto";
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { AlertLogsRepository } from '@/modules/alerts/repositories/alert-logs.repository.js';
import { AlertsRepository } from '@/modules/alerts/repositories/alerts.repository.js';
import { positionProfessionCaseSql } from '@/modules/alerts/constants/profession.constants.js';

type AlertBucket = "expired" | "30" | "60" | "90";

type LicenseAlertRow = {
  citizen_id: string;
  full_name: string;
  position_name: string;
  department: string | null;
  profession_code: string | null;
  license_no: string | null;
  license_expiry: string | null;
  days_left: number | null;
  bucket: AlertBucket;
  last_notified_at?: string | null;
};

const bucketCaseSql = `
  CASE
    WHEN effective_expiry IS NULL THEN 'expired'
    WHEN DATEDIFF(effective_expiry, DATE(?)) <= 0 THEN 'expired'
    WHEN DATEDIFF(effective_expiry, DATE(?)) <= 30 THEN '30'
    WHEN DATEDIFF(effective_expiry, DATE(?)) <= 60 THEN '60'
    WHEN DATEDIFF(effective_expiry, DATE(?)) <= 90 THEN '90'
    ELSE NULL
  END
`;

const positionExpr = "COALESCE(ep.position_name, ss.position_name, '')";
const departmentExpr = "COALESCE(ep.department, ss.department)";
// Reuse existing CASE mapping, but bind it to our joined profile alias.
const positionProfessionCaseSqlBound = positionProfessionCaseSql.replaceAll(
  "p.position_name",
  positionExpr,
);

// One row per citizen_id: take the latest license row, then enrich with profile/support fields.
const baseSubquerySql = `
  SELECT
    ll.citizen_id,
    COALESCE(ep.first_name, ss.first_name, '') AS first_name,
    COALESCE(ep.last_name, ss.last_name, '') AS last_name,
    ${positionExpr} AS position_name,
    ${departmentExpr} AS department,
    COALESCE(
      ${positionProfessionCaseSqlBound},
      (
        SELECT r.profession_code
        FROM req_eligibility re
        JOIN cfg_payment_rates r ON r.rate_id = re.master_rate_id
        WHERE re.citizen_id = ll.citizen_id
        ORDER BY re.is_active DESC, re.effective_date DESC, re.eligibility_id DESC
        LIMIT 1
      )
    ) AS profession_code,
    ll.license_no,
    ll.valid_until AS effective_expiry
  FROM (
    SELECT citizen_id, license_no, valid_until
    FROM (
      SELECT
        l.citizen_id,
        l.license_no,
        l.valid_until,
        ROW_NUMBER() OVER (
          PARTITION BY l.citizen_id
          ORDER BY l.valid_until DESC, l.valid_from DESC, l.license_id DESC
        ) AS rn
      FROM emp_licenses l
    ) ranked
    WHERE ranked.rn = 1
  ) ll
  LEFT JOIN emp_profiles ep ON ep.citizen_id = ll.citizen_id
  LEFT JOIN emp_support_staff ss ON ss.citizen_id = ll.citizen_id
`;

export async function getLicenseAlertSummary(asOf: Date = new Date()) {
  const sql = `
    SELECT
      SUM(bucket = 'expired') AS expired,
      SUM(bucket = '30') AS expiring_30,
      SUM(bucket = '60') AS expiring_60,
      SUM(bucket = '90') AS expiring_90
    FROM (
      SELECT
        ${bucketCaseSql} AS bucket
      FROM (
        ${baseSubquerySql}
      ) base
    ) buckets
    WHERE bucket IS NOT NULL
  `;

  const params = [
    asOf,
    asOf,
    asOf,
    asOf, // bucketCase
  ];

  const rows = await query<RowDataPacket[]>(sql, params);
  const row = rows[0] as any;
  const summary = {
    expired: Number(row?.expired ?? 0),
    expiring_30: Number(row?.expiring_30 ?? 0),
    expiring_60: Number(row?.expiring_60 ?? 0),
    expiring_90: Number(row?.expiring_90 ?? 0),
    total: 0,
  };
  summary.total =
    summary.expired +
    summary.expiring_30 +
    summary.expiring_60 +
    summary.expiring_90;
  return summary;
}

export async function getLicenseAlertList(
  bucket: AlertBucket,
  asOf: Date = new Date(),
) {
  const sql = `
    SELECT
      citizen_id,
      TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS full_name,
      position_name,
      department,
      profession_code,
      license_no,
      DATE(effective_expiry) AS license_expiry,
      DATEDIFF(effective_expiry, DATE(?)) AS days_left,
      ${bucketCaseSql} AS bucket
    FROM (
      ${baseSubquerySql}
    ) base
    WHERE ${bucketCaseSql} = ?
    ORDER BY citizen_id ASC
  `;

  const params = [
    asOf,
    asOf,
    asOf,
    asOf,
    asOf,
    asOf,
    asOf,
    asOf,
    asOf,
    bucket,
  ];

  const rows = await query<RowDataPacket[]>(sql, params);
  const normalizedRows = (rows as any[]).map((row) => ({
    citizen_id: row.citizen_id,
    full_name: row.full_name?.trim() ? row.full_name.trim() : row.citizen_id,
    position_name: row.position_name,
    department: row.department ?? null,
    profession_code: row.profession_code ?? null,
    license_no: row.license_no ?? null,
    license_expiry: row.license_expiry ? String(row.license_expiry) : null,
    days_left: row.days_left !== null ? Number(row.days_left) : null,
    bucket: row.bucket as AlertBucket,
  })) as LicenseAlertRow[];

  const refs = normalizedRows.map((row) => `${row.citizen_id}:${row.bucket}`);
  if (refs.length === 0) return normalizedRows;

  const placeholders = refs.map(() => "?").join(",");
  const logs = await query<RowDataPacket[]>(
    `SELECT reference_id, MAX(sent_at) AS sent_at
     FROM alert_logs
     WHERE alert_type = 'LICENSE_EXPIRING'
       AND reference_type = 'citizen'
       AND reference_id IN (${placeholders})
     GROUP BY reference_id`,
    refs,
  );

  const notifiedMap = new Map<string, string>();
  logs.forEach((row: any) => {
    if (row.reference_id) {
      notifiedMap.set(String(row.reference_id), row.sent_at ? String(row.sent_at) : "");
    }
  });

  return normalizedRows.map((row) => ({
    ...row,
    last_notified_at: notifiedMap.get(`${row.citizen_id}:${row.bucket}`) ?? null,
  }));
}

const hashKey = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function hasDailyNotification(citizenId: string, bucket: AlertBucket, date: Date): Promise<boolean> {
  const key = `LICENSE_EXPIRING:citizen:${citizenId}:${bucket}:${date.toISOString().slice(0, 10)}`;
  return AlertLogsRepository.hasPayloadHash(hashKey(key));
}

export async function notifyLicenseAlerts(
  items: Array<{ citizen_id: string; bucket: AlertBucket }>,
  asOf: Date = new Date(),
) {
  let sent = 0;
  let skipped = 0;

  for (const item of items) {
    const citizenId = item.citizen_id.trim();
    if (!citizenId) continue;

    if (await hasDailyNotification(citizenId, item.bucket, asOf)) {
      skipped += 1;
      continue;
    }

    const userId = await AlertsRepository.findUserIdByCitizenId(citizenId);
    if (userId) {
      const prefix = item.bucket === "expired" ? "ใบอนุญาตหมดอายุแล้ว" : "ใบอนุญาตใกล้หมดอายุ";
      await NotificationService.notifyUser(
        userId,
        "แจ้งเตือนใบอนุญาตประกอบวิชาชีพ",
        `${prefix} กรุณาตรวจสอบและดำเนินการต่ออายุ`,
        "/dashboard/user/settings",
        "LICENSE",
      );
    }

    const dedupeKey = `LICENSE_EXPIRING:citizen:${citizenId}:${item.bucket}:${asOf.toISOString().slice(0, 10)}`;
    await AlertLogsRepository.insertLog({
      alert_type: "LICENSE_EXPIRING",
      target_user_id: userId ?? null,
      reference_type: "citizen",
      reference_id: `${citizenId}:${item.bucket}`,
      payload_hash: hashKey(dedupeKey),
      status: "SENT",
      sent_at: asOf,
    });
    sent += 1;
  }

  return { sent, skipped };
}

export type { AlertBucket, LicenseAlertRow };
