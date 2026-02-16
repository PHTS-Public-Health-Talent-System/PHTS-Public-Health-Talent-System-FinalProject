/**
 * Entity interfaces matching payroll-related DB tables.
 */

export enum PeriodStatus {
  OPEN = "OPEN",
  WAITING_HR = "WAITING_HR",
  WAITING_HEAD_FINANCE = "WAITING_HEAD_FINANCE",
  WAITING_DIRECTOR = "WAITING_DIRECTOR",
  CLOSED = "CLOSED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

export enum PayResultItemType {
  CURRENT = "CURRENT",
  RETROACTIVE_ADD = "RETROACTIVE_ADD",
  RETROACTIVE_DEDUCT = "RETROACTIVE_DEDUCT",
}

export enum SnapshotType {
  SUMMARY = "SUMMARY",
  DETAIL = "DETAIL",
}

// ─── pay_periods ─────────────────────────────────────────────────────────────

export interface PayPeriod {
  period_id: number;
  period_month: number;
  period_year: number;
  status: PeriodStatus;
  total_amount: number;
  total_headcount: number;
  is_frozen: boolean;
  frozen_at: Date | null;
  frozen_by: number | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by?: number | null;
  created_by_name?: string | null;
}

// ─── pay_results ─────────────────────────────────────────────────────────────

export interface PayResult {
  payout_id: number;
  period_id: number;
  user_id?: number | null;
  citizen_id: string;
  master_rate_id: number | null;
  profession_code?: string | null;
  pts_rate_snapshot: number;
  calculated_amount: number;
  retroactive_amount: number;
  total_payable: number;
  deducted_days: number;
  eligible_days: number;
  payment_status: PaymentStatus;
  remark: string | null;
  created_at: Date;
}

// ─── pay_result_items ────────────────────────────────────────────────────────

export interface PayResultItem {
  item_id: number;
  payout_id: number;
  reference_month: number;
  reference_year: number;
  item_type: PayResultItemType;
  amount: number;
  created_at: Date;
}

// ─── pay_snapshots ───────────────────────────────────────────────────────────

export interface PaySnapshot {
  snapshot_id: number;
  period_id: number;
  snapshot_type: SnapshotType;
  snapshot_data: Record<string, unknown>;
  created_at: Date;
}
