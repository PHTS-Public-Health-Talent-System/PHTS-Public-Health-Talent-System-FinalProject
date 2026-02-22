import redis from '@config/redis.js';
import { getSyncRuntimeStatus } from '@/modules/system/sync/services/sync-status.service.js';
import { SystemRepository } from '@/modules/system/repositories/system.repository.js';

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
      snapshot_status: string;
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
  const rows = await SystemRepository.countNotificationOutboxByStatus();
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
  (await SystemRepository.findLatestNotificationOutbox(20)) as Array<{
    outbox_id: number;
    status: string;
    attempts: number;
    last_error: string | null;
    available_at: Date;
    created_at: Date;
    processed_at: Date | null;
  }>;

const fetchPayrollOpenPeriods = async () => {
  const [count, latest] = await Promise.all([
    SystemRepository.countOpenPayrollPeriods(),
    SystemRepository.findLatestOpenPayrollPeriods(5),
  ]);
  return { count, latest } as {
    count: number;
    latest: Array<{
      period_id: number;
      period_year: number;
      period_month: number;
      status: string;
      snapshot_status: string;
      updated_at: Date;
    }>;
  };
};

const buildSyncStatus = (syncStatus: {
  isSyncing: boolean;
  lastResult: { success?: boolean } | null;
}): 'RUNNING' | 'IDLE' | 'FAILED' | 'UNKNOWN' => {
  if (syncStatus.isSyncing) return 'RUNNING';
  if (syncStatus.lastResult?.success === false) {
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
    syncStatus = await getSyncRuntimeStatus();
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
