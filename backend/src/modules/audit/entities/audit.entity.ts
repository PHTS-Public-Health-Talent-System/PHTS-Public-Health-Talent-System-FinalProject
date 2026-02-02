/**
 * Audit Module - Entity Definitions
 *
 * TypeScript interfaces matching audit-related DB tables
 */

// ─── Audit Event Types ────────────────────────────────────────────────────────

export enum AuditEventType {
  // Authentication
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",

  // Request workflow
  REQUEST_CREATE = "REQUEST_CREATE",
  REQUEST_APPROVE = "REQUEST_APPROVE",
  REQUEST_REJECT = "REQUEST_REJECT",
  REQUEST_RETURN = "REQUEST_RETURN",
  REQUEST_REASSIGN = "REQUEST_REASSIGN",

  // Period workflow
  PERIOD_CREATE = "PERIOD_CREATE",
  PERIOD_APPROVE = "PERIOD_APPROVE",
  PERIOD_CLOSE = "PERIOD_CLOSE",
  PERIOD_FREEZE = "PERIOD_FREEZE",
  PERIOD_REJECT = "PERIOD_REJECT",
  PERIOD_ITEM_ADD = "PERIOD_ITEM_ADD",
  PERIOD_ITEM_REMOVE = "PERIOD_ITEM_REMOVE",
  PERIOD_SUBMIT = "PERIOD_SUBMIT",

  // Finance
  PAYOUT_MARK_PAID = "PAYOUT_MARK_PAID",
  PAYOUT_CANCEL = "PAYOUT_CANCEL",

  // User management
  USER_CREATE = "USER_CREATE",
  USER_UPDATE = "USER_UPDATE",
  USER_ROLE_CHANGE = "USER_ROLE_CHANGE",
  USER_DISABLE = "USER_DISABLE",

  // Master data
  MASTER_RATE_UPDATE = "MASTER_RATE_UPDATE",
  HOLIDAY_UPDATE = "HOLIDAY_UPDATE",


  // Snapshot
  SNAPSHOT_FREEZE = "SNAPSHOT_FREEZE",
  SNAPSHOT_UNFREEZE = "SNAPSHOT_UNFREEZE",

  // System
  DATA_SYNC = "DATA_SYNC",
  DATA_EXPORT = "DATA_EXPORT",

  // Access review
  ACCESS_REVIEW_CREATE = "ACCESS_REVIEW_CREATE",
  ACCESS_REVIEW_COMPLETE = "ACCESS_REVIEW_COMPLETE",

  // Other
  OTHER = "OTHER",
}

// ─── audit_logs table ─────────────────────────────────────────────────────────

export interface AuditEvent {
  audit_id: number;
  event_type: AuditEventType;
  entity_type: string;
  entity_id: number | null;
  actor_id: number | null;
  actor_role: string | null;
  action_detail: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  actor_name?: string | null;
}

// ─── Create audit event input ─────────────────────────────────────────────────

export interface CreateAuditEventInput {
  eventType: AuditEventType;
  entityType: string;
  entityId?: number | null;
  actorId?: number | null;
  actorRole?: string | null;
  actionDetail?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ─── Search filter ────────────────────────────────────────────────────────────

export interface AuditSearchFilter {
  eventType?: AuditEventType | AuditEventType[];
  entityType?: string;
  entityId?: number;
  actorId?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Search result ────────────────────────────────────────────────────────────

export interface AuditSearchResult {
  events: AuditEvent[];
  total: number;
  page: number;
  limit: number;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface AuditSummaryItem {
  event_type: string;
  count: number;
}
