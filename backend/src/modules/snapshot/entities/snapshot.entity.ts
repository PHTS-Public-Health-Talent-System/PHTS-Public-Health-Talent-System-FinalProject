/**
 * Snapshot Module - Entity Definitions
 *
 * TypeScript interfaces for period snapshots
 */

// ─── Snapshot Type ────────────────────────────────────────────────────────────

export enum SnapshotType {
  PAYOUT = "PAYOUT",
  SUMMARY = "SUMMARY",
}

export enum SnapshotStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  READY = "READY",
  FAILED = "FAILED",
}

// ─── Period with snapshot info ────────────────────────────────────────────────

export interface PeriodWithSnapshot {
  period_id: number;
  period_month: number;
  period_year: number;
  status: string;
  is_locked?: boolean;
  snapshot_status?: SnapshotStatus | null;
  snapshot_ready_at?: Date | null;
  frozen_at: Date | null;
  frozen_by: number | null;
  snapshot_count: number;
}

// ─── pay_snapshots table ──────────────────────────────────────────────────────

export interface Snapshot {
  snapshot_id: number;
  period_id: number;
  snapshot_type: SnapshotType;
  snapshot_data: any;
  record_count: number;
  total_amount: number;
  created_at: Date;
}

// ─── Payout data for report ───────────────────────────────────────────────────

export interface PayoutDataForReport {
  source: "snapshot" | "live";
  data: any[];
  recordCount: number;
  totalAmount: number;
}

// ─── Summary data for report ──────────────────────────────────────────────────

export interface SummaryDataForReport {
  source: "snapshot" | "live";
  data: any;
}

// ─── Department summary ───────────────────────────────────────────────────────

export interface DepartmentSummary {
  department: string;
  count: number;
  amount: number;
}
