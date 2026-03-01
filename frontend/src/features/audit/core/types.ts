export type AuditEventTypeOption = {
  value: string;
  label: string;
};

export type AuditSummaryRow = {
  event_type: string;
  count: number;
};

export type AuditEventRow = {
  audit_id: number;
  event_type: string;
  entity_type: string;
  entity_id: number | null;
  actor_id: number | null;
  actor_role: string | null;
  actor_name?: string | null;
  ip_address: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
};

export type AuditSearchResult = {
  events: AuditEventRow[];
  total: number;
  page: number;
  limit: number;
};
