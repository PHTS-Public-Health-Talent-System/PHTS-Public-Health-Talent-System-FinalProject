/**
 * Finance Module - Entity Definitions
 *
 * TypeScript interfaces matching finance-related DB tables
 */

// ─── Payment Status ───────────────────────────────────────────────────────────

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

// ─── Payout with details ──────────────────────────────────────────────────────

export interface PayoutWithDetails {
  payout_id: number;
  period_id: number;
  period_month: number;
  period_year: number;
  citizen_id: string;
  employee_name: string;
  department: string;
  pts_rate_snapshot: number;
  calculated_amount: number;
  retroactive_amount: number;
  total_payable: number;
  payment_status: PaymentStatus;
  paid_at: Date | null;
  paid_by: number | null;
}

// ─── Finance summary ──────────────────────────────────────────────────────────

export interface FinanceSummary {
  period_id: number;
  period_month: number;
  period_year: number;
  period_status: string;
  is_frozen: boolean | number;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
}

// ─── Yearly summary ───────────────────────────────────────────────────────────

export interface YearlySummary {
  period_year: number;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
}

// ─── Finance dashboard ────────────────────────────────────────────────────────

export interface FinanceDashboard {
  currentMonth: FinanceSummary | null;
  yearToDate: YearlySummary | null;
  recentPeriods: FinanceSummary[];
}

// ─── Batch result ─────────────────────────────────────────────────────────────

export interface BatchPaymentResult {
  success: number[];
  failed: Array<{ id: number; reason: string }>;
}
