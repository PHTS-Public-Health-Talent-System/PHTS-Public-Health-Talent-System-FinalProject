import { RowDataPacket } from "mysql2/promise";
import { query } from "../../../config/database.js";

type AlertBucket = "expired" | "30" | "60" | "90";

type LicenseAlertRow = {
  citizen_id: string;
  full_name: string;
  position_name: string;
  license_expiry: string | null;
  days_left: number | null;
  bucket: AlertBucket;
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

const baseSubquerySql = `
  SELECT
    p.citizen_id,
    p.first_name,
    p.last_name,
    p.position_name,
    COALESCE(l.next_valid, l.last_valid) AS effective_expiry
  FROM emp_profiles p
  LEFT JOIN (
    SELECT
      citizen_id,
      MIN(CASE WHEN valid_until >= DATE(?) THEN valid_until END) AS next_valid,
      MAX(valid_until) AS last_valid
    FROM emp_licenses
    WHERE status IS NULL OR UPPER(status) = 'ACTIVE'
    GROUP BY citizen_id
  ) l ON p.citizen_id = l.citizen_id
  WHERE p.position_name LIKE '%พยาบาล%'
     OR p.position_name LIKE '%นักเทคนิคการแพทย์%'
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
    asOf, // subquery (next_valid)
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
    asOf,
    bucket,
  ];

  const rows = await query<RowDataPacket[]>(sql, params);
  return (rows as any[]).map((row) => ({
    citizen_id: row.citizen_id,
    full_name: row.full_name?.trim() ? row.full_name.trim() : row.citizen_id,
    position_name: row.position_name,
    license_expiry: row.license_expiry ? String(row.license_expiry) : null,
    days_left: row.days_left !== null ? Number(row.days_left) : null,
    bucket: row.bucket as AlertBucket,
  })) as LicenseAlertRow[];
}

export type { AlertBucket, LicenseAlertRow };
