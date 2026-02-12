/**
 * SLA Module - Entity Definitions
 *
 * TypeScript interfaces for SLA tracking
 */

// ─── cfg_sla_rules table ──────────────────────────────────────────────────────

export interface SLAConfig {
  sla_id: number;
  step_no: number;
  role_name: string;
  sla_days: number;
  reminder_before_days: number;
  reminder_after_days: number;
  is_active: boolean;
}

// ─── Request with SLA info ────────────────────────────────────────────────────

export interface RequestSLAInfo {
  request_id: number;
  request_no: string;
  citizen_id: string;
  first_name?: string | null;
  last_name?: string | null;
  current_step: number;
  step_started_at: Date;
  assigned_officer_id: number | null;
  business_days_elapsed: number;
  sla_days: number;
  is_approaching_sla: boolean;
  is_overdue: boolean;
  days_until_sla: number;
  days_overdue: number;
  approver_ids: number[];
}

// ─── SLA Report ───────────────────────────────────────────────────────────────

export interface SLAReport {
  totalPending: number;
  withinSLA: number;
  approachingSLA: number;
  overdueSLA: number;
  byStep: Array<{
    step: number;
    role: string;
    count: number;
    overdue: number;
  }>;
}

// ─── SLA Reminder Result ──────────────────────────────────────────────────────

export interface SLAReminderResult {
  approaching: number;
  overdue: number;
  errors: string[];
}

// ─── Reminder Type ────────────────────────────────────────────────────────────

export type ReminderType = "APPROACHING" | "OVERDUE" | "DAILY_OVERDUE";
