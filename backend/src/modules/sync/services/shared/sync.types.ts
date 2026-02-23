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

export type SyncRuntimeStatus = {
  isSyncing: boolean;
  lastResult: { success?: boolean } | null;
};
