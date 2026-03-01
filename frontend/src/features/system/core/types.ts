export type BackupJobStatus = "RUNNING" | "SUCCESS" | "FAILED";
export type BackupTriggerSource = "MANUAL" | "SCHEDULED";

export interface BackupJobRecord {
  job_id: number;
  trigger_source: BackupTriggerSource;
  triggered_by: number | null;
  status: BackupJobStatus;
  backup_file_path: string | null;
  backup_file_size_bytes: number | null;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface BackupTriggerResult {
  enabled: boolean;
  jobId?: number;
  status?: "SUCCESS" | "FAILED";
  output?: string;
}

export interface BackupSchedule {
  hour: number;
  minute: number;
  timezone: string;
}

export type SyncScheduleMode = "DAILY" | "INTERVAL";

export interface SyncSchedule {
  mode: SyncScheduleMode;
  hour: number;
  minute: number;
  interval_minutes: number;
  timezone: string;
}

export type UserSyncAuditAction =
  | "CREATE"
  | "ACTIVATE"
  | "DEACTIVATE"
  | "PASSWORD_FILLED"
  | "DEACTIVATE_MISSING";

export interface UserSyncAuditRecord {
  audit_id: number;
  sync_batch_id: number | null;
  user_id: number | null;
  citizen_id: string;
  action: UserSyncAuditAction;
  before_is_active: number | null;
  after_is_active: number | null;
  reason: string | null;
  created_at: string;
}

export interface SyncReconciliationSummary {
  support: {
    support_view_count: number;
    support_table_count: number;
  };
  users: {
    users_total: number;
    users_active: number | string;
    users_inactive: number | string;
  };
  quality: {
    profile_status_code_null: number | string;
    support_status_code_null: number | string;
  };
}

export type SyncStageGroup = 'CORE' | 'POST';
export type SyncStageStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
export type SyncCoreStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type SyncPostStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
export type SyncOverallStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SUCCESS_WITH_WARNINGS';

export interface SyncBatchStageRun {
  stage_run_id: number;
  batch_id: number;
  stage_key: string;
  stage_group: SyncStageGroup;
  status: SyncStageStatus;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface SyncBatchRecord {
  batch_id: number;
  sync_type: 'FULL' | 'USER';
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  core_status: SyncCoreStatus;
  post_status: SyncPostStatus;
  overall_status: SyncOverallStatus;
  warnings_count: number;
  triggered_by: number | null;
  target_citizen_id: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  total_records: number;
  changed_records: number;
  error_records: number;
  stats_json: unknown | null;
  error_message: string | null;
  created_at: string;
  stages: SyncBatchStageRun[];
}

export interface SyncBatchListResponse {
  rows: SyncBatchRecord[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export type DataIssueSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface DataIssueRecord {
  issue_id: number;
  batch_id: number | null;
  target_table: string;
  source_key: string;
  issue_code: string;
  issue_detail: string | null;
  severity: DataIssueSeverity;
  created_at: string;
}

export interface DataIssueListResponse {
  rows: DataIssueRecord[];
  total: number;
  page: number;
  limit: number;
  target_table_options: string[];
  issue_code_options: string[];
  severity_counts: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

export interface SyncRecordListResponse {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  batch_id: number | null;
  target_table: string;
  table_options: string[];
  table_counts: Record<string, number>;
}

export type SnapshotOutboxFilterStatus =
  | "PENDING"
  | "PROCESSING"
  | "FAILED"
  | "SENT"
  | "DEAD_LETTER";

export interface SnapshotOutboxRecord {
  outbox_id: number;
  period_id: number;
  requested_by: number | null;
  status: string;
  attempts: number;
  last_error: string | null;
  available_at: string;
  created_at: string;
  processed_at: string | null;
}

export interface SnapshotOutboxListResponse {
  rows: SnapshotOutboxRecord[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
