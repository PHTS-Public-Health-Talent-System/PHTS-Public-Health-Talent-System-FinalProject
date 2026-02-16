import { query } from '@config/database.js';
import redis from '@config/redis.js';
import { SyncService } from '@/modules/system/services/syncService.js';

type JobError = {
  source: 'sync' | 'notifications' | 'payroll' | 'redis';
  message: string;
};

type JobSummary = {
  sync: {
    status: 'RUNNING' | 'IDLE' | 'FAILED' | 'UNKNOWN';
    isSyncing: boolean;
    lastResult: unknown | null;
  };
  notifications: {
    pending: number;
    processing: number;
    failed: number;
    sent: number;
    total: number;
    latest: Array<{
      outbox_id: number;
      status: string;
      attempts: number;
      last_error: string | null;
      available_at: Date;
      created_at: Date;
      processed_at: Date | null;
    }>;
  };
  payroll: {
    openPeriods: number;
    latestOpen: Array<{
      period_id: number;
      period_year: number;
      period_month: number;
      status: string;
      is_frozen: number;
      updated_at: Date;
    }>;
  };
};

type JobStatusPayload = {
  partial: boolean;
  errors: JobError[];
  summary: JobSummary;
  jobs: Array<{
    key: string;
    name: string;
    status: 'RUNNING' | 'IDLE' | 'FAILED' | 'DEGRADED' | 'UNKNOWN';
    detail?: Record<string, unknown>;
  }>;
};

const countOutboxByStatus = async () => {
  const rows = (await query(
    `SELECT status, COUNT(*) as count
     FROM ntf_outbox
     GROUP BY status`,
  )) as Array<{ status: string; count: number }>;
  const summary = {
    PENDING: 0,
    PROCESSING: 0,
    FAILED: 0,
    SENT: 0,
  };
  for (const row of rows) {
    const key = row.status as keyof typeof summary;
    if (summary[key] !== undefined) {
      summary[key] = Number(row.count);
    }
  }
  return summary;
};

const fetchLatestOutbox = async () =>
  (await query(
    `SELECT outbox_id, status, attempts, last_error, available_at, created_at, processed_at
     FROM ntf_outbox
     ORDER BY created_at DESC
     LIMIT 20`,
  )) as Array<{
    outbox_id: number;
    status: string;
    attempts: number;
    last_error: string | null;
    available_at: Date;
    created_at: Date;
    processed_at: Date | null;
  }>;

const fetchPayrollOpenPeriods = async () => {
  const [countRow] = (await query(
    "SELECT COUNT(*) as count FROM pay_periods WHERE status <> 'CLOSED'",
  )) as Array<{ count: number }>;
  const latest = (await query(
    `SELECT period_id, period_year, period_month, status, is_frozen, updated_at
     FROM pay_periods
     WHERE status <> 'CLOSED'
     ORDER BY period_year DESC, period_month DESC
     LIMIT 5`,
  )) as Array<{
    period_id: number;
    period_year: number;
    period_month: number;
    status: string;
    is_frozen: number;
    updated_at: Date;
  }>;

  return { count: Number(countRow?.count ?? 0), latest };
};

const buildSyncStatus = (syncStatus: {
  isSyncing: boolean;
  lastResult: { success?: boolean } | null;
}): 'RUNNING' | 'IDLE' | 'FAILED' | 'UNKNOWN' => {
  if (syncStatus.isSyncing) return 'RUNNING';
  if (syncStatus.lastResult && syncStatus.lastResult.success === false) {
    return 'FAILED';
  }
  if (syncStatus.lastResult) return 'IDLE';
  return 'UNKNOWN';
};

const buildNotificationStatus = (summary: {
  pending: number;
  processing: number;
  failed: number;
}): 'DEGRADED' | 'RUNNING' | 'IDLE' => {
  if (summary.failed > 0) return 'DEGRADED';
  if (summary.pending > 0 || summary.processing > 0) return 'RUNNING';
  return 'IDLE';
};

export const getJobStatus = async (): Promise<JobStatusPayload> => {
  const errors: JobError[] = [];
  let partial = false;

  let syncStatus = { isSyncing: false, lastResult: null as unknown | null };
  let notifications = {
    pending: 0,
    processing: 0,
    failed: 0,
    sent: 0,
    total: 0,
    latest: [] as JobSummary['notifications']['latest'],
  };
  let payroll = {
    openPeriods: 0,
    latestOpen: [] as JobSummary['payroll']['latestOpen'],
  };

  try {
    syncStatus = await SyncService.getLastSyncStatus();
  } catch (err) {
    partial = true;
    errors.push({
      source: 'sync',
      message: err instanceof Error ? err.message : 'Failed to load sync status',
    });
  }

  try {
    const [summary, latest] = await Promise.all([countOutboxByStatus(), fetchLatestOutbox()]);
    notifications = {
      pending: summary.PENDING,
      processing: summary.PROCESSING,
      failed: summary.FAILED,
      sent: summary.SENT,
      total: summary.PENDING + summary.PROCESSING + summary.FAILED + summary.SENT,
      latest,
    };
  } catch (err) {
    partial = true;
    errors.push({
      source: 'notifications',
      message: err instanceof Error ? err.message : 'Failed to load outbox status',
    });
  }

  try {
    const result = await fetchPayrollOpenPeriods();
    payroll = {
      openPeriods: result.count,
      latestOpen: result.latest,
    };
  } catch (err) {
    partial = true;
    errors.push({
      source: 'payroll',
      message: err instanceof Error ? err.message : 'Failed to load payroll status',
    });
  }

  let redisPing: string | null = null;
  try {
    redisPing = await redis.get('system:sync:lock');
  } catch (err) {
    partial = true;
    errors.push({
      source: 'redis',
      message: err instanceof Error ? err.message : 'Failed to query redis health',
    });
  }

  const summary: JobSummary = {
    sync: {
      status: buildSyncStatus(syncStatus as any),
      isSyncing: syncStatus.isSyncing,
      lastResult: syncStatus.lastResult,
    },
    notifications,
    payroll,
  };

  const jobs: JobStatusPayload['jobs'] = [
    {
      key: 'hrms-sync',
      name: 'HRMS Sync',
      status: summary.sync.status,
      detail: {
        isSyncing: summary.sync.isSyncing,
        lastResult: summary.sync.lastResult,
        lockPresent: Boolean(redisPing),
      },
    },
    {
      key: 'notification-outbox',
      name: 'Notification Outbox',
      status: buildNotificationStatus(notifications),
      detail: {
        counts: {
          pending: notifications.pending,
          processing: notifications.processing,
          failed: notifications.failed,
          sent: notifications.sent,
          total: notifications.total,
        },
      },
    },
    {
      key: 'payroll-periods',
      name: 'Payroll Periods',
      status: payroll.openPeriods > 0 ? 'RUNNING' : 'IDLE',
      detail: {
        openPeriods: payroll.openPeriods,
        latestOpen: payroll.latestOpen,
      },
    },
  ];

  return {
    partial,
    errors,
    summary,
    jobs,
  };
};
