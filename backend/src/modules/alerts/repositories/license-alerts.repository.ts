/**
 * License Alerts Module - Repository
 *
 * Handles all database operations for license expiry alerts
 */

import { RowDataPacket, PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import {
  AlertBucket,
  LicenseAlertRow,
  LicenseAlertSummary,
  LicenseExpiryRow,
} from '@/modules/alerts/entities/license-alerts.entity.js';
import { positionProfessionCaseSql } from '@/modules/alerts/constants/profession.constants.js';

// SQL fragments for license alert queries
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
    COALESCE(
      ${positionProfessionCaseSql},
      (
        SELECT r.profession_code
        FROM req_eligibility re
        JOIN cfg_payment_rates r ON r.rate_id = re.master_rate_id
        WHERE re.citizen_id = p.citizen_id
        ORDER BY re.is_active DESC, re.effective_date DESC, re.eligibility_id DESC
        LIMIT 1
      )
    ) AS profession_code,
    (
      SELECT l.valid_until
      FROM emp_licenses l
      WHERE l.citizen_id = p.citizen_id
      ORDER BY
        l.valid_until DESC,
        l.valid_from DESC,
        l.license_id DESC
      LIMIT 1
    ) AS effective_expiry
  FROM emp_profiles p
  WHERE EXISTS (
    SELECT 1
    FROM req_eligibility re
    WHERE re.citizen_id = p.citizen_id
      AND re.is_active = 1
  )
`;

export class LicenseAlertsRepository {
  static async getSummary(
    asOf: Date = new Date(),
    conn?: PoolConnection,
  ): Promise<LicenseAlertSummary> {
    const executor = conn ?? db;
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
      asOf, asOf, asOf, asOf, // bucketCase
    ];

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);
    const row = rows[0] as any;

    const summary: LicenseAlertSummary = {
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

  static async getListByBucket(
    bucket: AlertBucket,
    asOf: Date = new Date(),
    conn?: PoolConnection,
  ): Promise<LicenseAlertRow[]> {
    const executor = conn ?? db;
    const sql = `
      SELECT
        citizen_id,
        TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS full_name,
        position_name,
        profession_code,
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
      asOf, asOf, asOf, asOf, // first bucketCase
      asOf, asOf, asOf, asOf, // where bucketCase
      bucket,
    ];

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);

    return (rows as any[]).map((row) => ({
      citizen_id: row.citizen_id,
      full_name: row.full_name?.trim() ? row.full_name.trim() : row.citizen_id,
      position_name: row.position_name,
      license_expiry: row.license_expiry ? String(row.license_expiry) : null,
      days_left: row.days_left !== null ? Number(row.days_left) : null,
      bucket: row.bucket as AlertBucket,
    }));
  }

  static async getAllWithExpiry(
    asOf: Date = new Date(),
    conn?: PoolConnection,
  ): Promise<LicenseExpiryRow[]> {
    const executor = conn ?? db;
    const sql = `
      SELECT
        citizen_id,
        TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS full_name,
        position_name,
        profession_code,
        DATE(effective_expiry) AS effective_expiry,
        DATEDIFF(effective_expiry, DATE(?)) AS days_left
      FROM (
        ${baseSubquerySql}
      ) base
      ORDER BY citizen_id ASC
    `;

    const params = [
      asOf,
    ];

    const [rows] = await executor.query<RowDataPacket[]>(sql, params);

    return (rows as any[]).map((row) => ({
      citizen_id: row.citizen_id,
      full_name: row.full_name?.trim() ? row.full_name.trim() : row.citizen_id,
      position_name: row.position_name,
      effective_expiry: row.effective_expiry ? String(row.effective_expiry) : null,
      days_left: row.days_left !== null ? Number(row.days_left) : null,
    }));
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
