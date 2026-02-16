/**
 * License Alerts Module - Entity Definitions
 *
 * TypeScript interfaces for license expiry alerts
 */

// ─── Alert bucket types ───────────────────────────────────────────────────────

export type AlertBucket = "expired" | "30" | "60" | "90";

// ─── License alert row ────────────────────────────────────────────────────────

export interface LicenseAlertRow {
  citizen_id: string;
  full_name: string;
  position_name: string;
  profession_code?: string | null;
  license_expiry: string | null;
  days_left: number | null;
  bucket: AlertBucket;
}

// ─── License alert summary ────────────────────────────────────────────────────

export interface LicenseAlertSummary {
  expired: number;
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
  total: number;
}

export interface LicenseExpiryRow {
  citizen_id: string;
  full_name: string;
  position_name: string;
  profession_code?: string | null;
  effective_expiry: string | null;
  days_left: number | null;
}
