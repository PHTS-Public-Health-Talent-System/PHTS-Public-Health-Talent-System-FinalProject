import type { SyncStats } from '@/modules/sync/services/shared/sync.types.js';

export const createSyncStats = (): SyncStats => ({
  users: { added: 0, updated: 0, skipped: 0 },
  employees: { upserted: 0, skipped: 0 },
  support_employees: { upserted: 0, skipped: 0 },
  support_cleanup: { candidates: 0, deleted: 0, dry_run: false },
  signatures: { added: 0, skipped: 0 },
  licenses: { upserted: 0 },
  quotas: { upserted: 0 },
  leaves: { upserted: 0, skipped: 0 },
  movements: { added: 0 },
  roles: { updated: 0, skipped: 0, missing: 0 },
  quality_gates: { status_code_total: 0, status_code_null: 0, threshold_pct: 0 },
});
