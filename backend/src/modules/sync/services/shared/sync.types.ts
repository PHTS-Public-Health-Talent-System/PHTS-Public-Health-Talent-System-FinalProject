export type SyncStats = {
  users: { added: number; updated: number; skipped: number };
  employees: { upserted: number; skipped: number };
  support_employees: { upserted: number; skipped: number };
  support_cleanup: { candidates: number; deleted: number; dry_run: boolean };
  signatures: { added: number; skipped: number };
  licenses: { upserted: number };
  quotas: { upserted: number };
  leaves: { upserted: number; skipped: number };
  movements: { added: number };
  roles: { updated: number; skipped: number; missing: number };
  quality_gates: { status_code_total: number; status_code_null: number; threshold_pct: number };
};

export type SyncCoreStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type SyncPostStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
export type SyncOverallStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SUCCESS_WITH_WARNINGS';
export type SyncStageGroup = 'CORE' | 'POST';
export type SyncStageStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export type SyncStageKey =
  | 'sync-employee-profiles'
  | 'sync-support-staff'
  | 'sync-users'
  | 'sync-signatures'
  | 'sync-licenses-quotas'
  | 'sync-leaves'
  | 'sync-movements'
  | 'sync-special-position-scopes'
  | 'assign-roles'
  | 'refresh-access-review';

export type SyncStageRun = {
  stage_run_id?: number;
  batch_id: number;
  stage_key: SyncStageKey;
  stage_group: SyncStageGroup;
  status: SyncStageStatus;
  error_message?: string | null;
  started_at?: string | Date | null;
  finished_at?: string | Date | null;
  duration_ms?: number | null;
};

export type SyncPipelineSummary = {
  core_status: SyncCoreStatus;
  post_status: SyncPostStatus;
  overall_status: SyncOverallStatus;
  warnings_count: number;
  stages: SyncStageRun[];
};

export type SyncRuntimeStatus = {
  isSyncing: boolean;
  lastResult: Record<string, unknown> | null;
};
