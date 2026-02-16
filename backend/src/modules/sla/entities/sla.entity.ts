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

export interface SLAKpiOverview {
  from: string;
  to: string;
  total_closed: number;
  on_time_completion_rate: number;
  median_lead_time_days: number;
  throughput_closed: number;
  rework_rate: number;
  overdue_backlog_count: number;
}

export interface SLAKpiByStepRow {
  step: number;
  role: string;
  total: number;
  median_days: number;
  p90_days: number;
  on_time_rate: number;
}

export interface SLAKpiAgingBucket {
  bucket: "0-3" | "4-7" | "8-14" | "15+";
  count: number;
}

export interface SLAKpiDataQuality {
  from: string;
  to: string;
  closed_without_submit: number;
  closed_without_actions: number;
  step_missing_enter: number;
  step_negative_duration: number;
}

export interface SLAKpiErrorCategoryRow {
  category: string;
  count: number;
  ratio: number;
}

export interface SLAKpiErrorByStepRow {
  step: number;
  role: string;
  error_count: number;
}

export interface SLAKpiErrorOverview {
  from: string;
  to: string;
  total_submitted: number;
  total_error_requests: number;
  error_rate: number;
  first_pass_yield: number;
  return_rate: number;
  rejection_rate: number;
  top_categories: SLAKpiErrorCategoryRow[];
  by_step: SLAKpiErrorByStepRow[];
}

// ─── SLA Reminder Result ──────────────────────────────────────────────────────

export interface SLAReminderResult {
  approaching: number;
  overdue: number;
  errors: string[];
}

// ─── Reminder Type ────────────────────────────────────────────────────────────

export type ReminderType = "APPROACHING" | "OVERDUE" | "DAILY_OVERDUE";
