/**
 * Access Review Module - Entity Definitions
 *
 * TypeScript interfaces for post-sync access review
 */

// ─── Review cycle status ──────────────────────────────────────────────────────

export enum ReviewCycleStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  OVERDUE = "OVERDUE",
}

// ─── Review result ────────────────────────────────────────────────────────────

export enum ReviewResult {
  KEEP = "KEEP",
  DISABLE = "DISABLE",
  PENDING = "PENDING",
}

// ─── audit_review_cycles table ────────────────────────────────────────────────

export interface ReviewCycle {
  cycle_id: number;
  quarter: number;
  year: number;
  status: ReviewCycleStatus;
  start_date: Date;
  due_date: Date;
  opened_at?: Date | null;
  expires_at?: Date | null;
  sync_source?: 'SYNC' | null;
  cycle_code?: string | null;
  completed_at: Date | null;
  completed_by: number | null;
  total_users: number;
  reviewed_users: number;
  disabled_users: number;
}

// ─── audit_review_items table ─────────────────────────────────────────────────

export interface ReviewItem {
  item_id: number;
  cycle_id: number;
  user_id: number;
  citizen_id: string;
  user_name: string;
  current_role: string;
  employee_status: string | null;
  last_login_at: Date | null;
  review_result: ReviewResult;
  reviewed_at: Date | null;
  reviewed_by: number | null;
  review_note: string | null;
  auto_disabled: boolean;
}

// ─── access_review_queue table ────────────────────────────────────────────────

export enum AccessReviewQueueStatus {
  OPEN = "OPEN",
  IN_REVIEW = "IN_REVIEW",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED",
}

export enum AccessReviewReasonCode {
  NEW_USER = "NEW_USER",
  ROLE_MISMATCH = "ROLE_MISMATCH",
  PROFILE_CHANGED = "PROFILE_CHANGED",
  INACTIVE_BUT_ACTIVE = "INACTIVE_BUT_ACTIVE",
}

export interface AccessReviewQueueItem {
  queue_id: number;
  user_id: number;
  reason_code: AccessReviewReasonCode;
  status: AccessReviewQueueStatus;
  source_batch_id: number | null;
  last_seen_batch_id: number | null;
  first_detected_at: Date;
  last_detected_at: Date;
  opened_at: Date;
  resolved_at: Date | null;
  resolved_by: number | null;
  payload_json: Record<string, unknown> | null;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AccessReviewQueueEvent {
  event_id: number;
  queue_id: number;
  event_type: string;
  batch_id: number | null;
  actor_id: number | null;
  event_payload: Record<string, unknown> | null;
  created_at: Date;
}

