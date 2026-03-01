import redis from '@config/redis.js';
import db from '@config/database.js';
import { OCR_QUEUE_KEY } from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { OcrHttpProvider } from '@/modules/ocr/providers/ocr-http.provider.js';
import { getOcrWorkerEnabled } from '@/modules/ocr/services/ocr-worker.service.js';
import { OpsJobRunsRepository } from '@/modules/system/repositories/ops-job-runs.repository.js';
import { getSyncRuntimeStatus } from '@/modules/sync/services/sync-status.service.js';
import { OpsStatusRepository } from '@/modules/system/repositories/ops-status.repository.js';
import type { SyncRuntimeStatus } from '@/modules/sync/services/shared/sync.types.js';

type JobError = {
  source: 'sync' | 'notifications' | 'payroll' | 'snapshot' | 'ocr' | 'workforce' | 'redis';
  message: string;
};

const WORKFORCE_JOB_KEYS = [
  'sla',
  'leave-report',
  'military-leave',
  'license-auto-cut',
  'retirement-cut',
  'movement-cut',
  'license-alerts',
] as const;

type JobSummary = {
  checked_at: string;
  dependencies: {
    mysql: {
      status: 'IDLE' | 'FAILED';
      latency_ms: number;
      checked_at: string;
      error: string | null;
    };
    redis: {
      status: 'IDLE' | 'FAILED';
      latency_ms: number;
      checked_at: string;
      lock_present: boolean;
      error: string | null;
    };
    hrms: {
      status: 'IDLE' | 'FAILED';
      latency_ms: number;
      checked_at: string;
      error: string | null;
    };
  };
  sync: {
    status: 'RUNNING' | 'IDLE' | 'FAILED' | 'DEGRADED' | 'UNKNOWN';
    isSyncing: boolean;
    lastResult: unknown | null;
  };
  notifications: {
    pending: number;
    processing: number;
    failed: number;
    dead_letter: number;
    sent: number;
    total: number;
    oldest_backlog_at: string | null;
    oldest_backlog_minutes: number | null;
    failed_last_hour: number;
    total_last_hour: number;
    failed_rate_last_hour: number;
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
  snapshot: {
    pending: number;
    processing: number;
    failed: number;
    dead_letter: number;
    sent: number;
    total: number;
    oldest_backlog_at: string | null;
    oldest_backlog_minutes: number | null;
    failed_last_hour: number;
    total_last_hour: number;
    failed_rate_last_hour: number;
    latest: Array<{
      outbox_id: number;
      period_id: number;
      requested_by: number | null;
      status: string;
      attempts: number;
      last_error: string | null;
      available_at: Date;
      created_at: Date;
      processed_at: Date | null;
    }>;
  };
  ocr: {
    pending: number;
    configured: boolean;
    worker_enabled: boolean;
  };
  workforce: {
    failed_last_24h: number;
    latest_runs: Array<{
      job_run_id: number;
      job_key: string;
      trigger_source: string;
      status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
      summary_json: unknown | null;
      error_message: string | null;
      started_at: Date;
      finished_at: Date | null;
      duration_ms: number | null;
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
  const rows = await OpsStatusRepository.countNotificationOutboxByStatus();
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
  (await OpsStatusRepository.findLatestNotificationOutbox(20)) as Array<{
    outbox_id: number;
    status: string;
    attempts: number;
    last_error: string | null;
    available_at: Date;
    created_at: Date;
    processed_at: Date | null;
  }>;

const fetchLatestSnapshotOutbox = async () =>
  (await OpsStatusRepository.findLatestSnapshotOutbox(20)) as Array<{
    outbox_id: number;
    period_id: number;
    requested_by: number | null;
    status: string;
    attempts: number;
    last_error: string | null;
    available_at: Date;
    created_at: Date;
    processed_at: Date | null;
  }>;

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const toMinutesDiff = (value: Date | null, now: Date): number | null => {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 60000));
};

const aggregateCounts = (rows: Array<{ status: string; count: number }>) => {
  const result = {
    PENDING: 0,
    PROCESSING: 0,
    FAILED: 0,
    SENT: 0,
  };
  for (const row of rows) {
    const key = String(row.status || '').toUpperCase() as keyof typeof result;
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] += Number(row.count ?? 0);
    }
  }
  return result;
};

const getNotificationMaxAttempts = (): number => {
  const raw = Number(process.env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS ?? 8);
  if (!Number.isFinite(raw)) return 8;
  return Math.max(1, Math.min(100, Math.floor(raw)));
};

const getSnapshotMaxAttempts = (): number => {
  const raw = Number(process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS ?? 8);
  if (!Number.isFinite(raw)) return 8;
  return Math.max(1, Math.min(100, Math.floor(raw)));
};

const timed = async <T>(fn: () => Promise<T>) => {
  const startedAt = Date.now();
  const value = await fn();
  return {
    value,
    latencyMs: Date.now() - startedAt,
  };
};

const checkMysqlDependency = async () => {
  const checkedAt = new Date().toISOString();
  try {
    const result = await timed(async () => {
      await db.query('SELECT 1 AS ok');
    });
    return {
      status: 'IDLE' as const,
      latency_ms: result.latencyMs,
      checked_at: checkedAt,
      error: null,
    };
  } catch (error) {
    return {
      status: 'FAILED' as const,
      latency_ms: 0,
      checked_at: checkedAt,
      error: error instanceof Error ? error.message : 'mysql_check_failed',
    };
  }
};

const checkHrmsDependency = async () => {
  const checkedAt = new Date().toISOString();
  try {
    const result = await timed(async () => {
      await db.query(
        'SELECT CAST(id AS CHAR CHARACTER SET utf8mb4) AS citizen_id FROM hrms_databases.tb_ap_index_view LIMIT 1',
      );
    });
    return {
      status: 'IDLE' as const,
      latency_ms: result.latencyMs,
      checked_at: checkedAt,
      error: null,
    };
  } catch (error) {
    return {
      status: 'FAILED' as const,
      latency_ms: 0,
      checked_at: checkedAt,
      error: error instanceof Error ? error.message : 'hrms_check_failed',
    };
  }
};

const fetchPayrollOpenPeriods = async () => {
  const [count, latest] = await Promise.all([
    OpsStatusRepository.countOpenPayrollPeriods(),
    OpsStatusRepository.findLatestOpenPayrollPeriods(5),
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
  lastResult: Record<string, unknown> | null;
}): 'RUNNING' | 'IDLE' | 'FAILED' | 'DEGRADED' | 'UNKNOWN' => {
  const lastResult = syncStatus.lastResult;
  if (syncStatus.isSyncing) return 'RUNNING';
  if (lastResult?.success === false) {
    return 'FAILED';
  }
  const overallStatus = String(lastResult?.overall_status ?? '').toUpperCase();
  const warningsCount = Number(lastResult?.warnings_count ?? 0);
  const warnings = Array.isArray(lastResult?.warnings) ? lastResult.warnings.length : 0;
  if (overallStatus === 'SUCCESS_WITH_WARNINGS' || warningsCount > 0 || warnings > 0) {
    return 'DEGRADED';
  }
  if (lastResult) return 'IDLE';
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

const buildSnapshotStatus = (summary: {
  pending: number;
  processing: number;
  failed: number;
}): 'DEGRADED' | 'RUNNING' | 'IDLE' => {
  if (summary.failed > 0) return 'DEGRADED';
  if (summary.pending > 0 || summary.processing > 0) return 'RUNNING';
  return 'IDLE';
};

const buildOcrStatus = (summary: {
  pending: number;
  configured: boolean;
  worker_enabled: boolean;
}): 'FAILED' | 'RUNNING' | 'IDLE' => {
  if (!summary.worker_enabled) return 'FAILED';
  if (!summary.configured) return summary.pending > 0 ? 'FAILED' : 'IDLE';
  if (summary.pending > 0) return 'RUNNING';
  return 'IDLE';
};

export const getJobStatus = async (): Promise<JobStatusPayload> => {
  const errors: JobError[] = [];
  let partial = false;
  const now = new Date();

  let syncStatus: SyncRuntimeStatus = { isSyncing: false, lastResult: null };
  let notifications = {
    pending: 0,
    processing: 0,
    failed: 0,
    dead_letter: 0,
    sent: 0,
    total: 0,
    oldest_backlog_at: null as string | null,
    oldest_backlog_minutes: null as number | null,
    failed_last_hour: 0,
    total_last_hour: 0,
    failed_rate_last_hour: 0,
    latest: [] as JobSummary['notifications']['latest'],
  };
  let payroll = {
    openPeriods: 0,
    latestOpen: [] as JobSummary['payroll']['latestOpen'],
  };
  let snapshot = {
    pending: 0,
    processing: 0,
    failed: 0,
    dead_letter: 0,
    sent: 0,
    total: 0,
    oldest_backlog_at: null as string | null,
    oldest_backlog_minutes: null as number | null,
    failed_last_hour: 0,
    total_last_hour: 0,
    failed_rate_last_hour: 0,
    latest: [] as JobSummary['snapshot']['latest'],
  };
  let ocr = {
    pending: 0,
    configured: false,
    worker_enabled: getOcrWorkerEnabled(),
  };
  let workforce = {
    failed_last_24h: 0,
    latest_runs: [] as JobSummary['workforce']['latest_runs'],
  };
  const notificationMaxAttempts = getNotificationMaxAttempts();
  const snapshotMaxAttempts = getSnapshotMaxAttempts();
  const dependencies: JobSummary['dependencies'] = {
    mysql: {
      status: 'IDLE',
      latency_ms: 0,
      checked_at: now.toISOString(),
      error: null,
    },
    redis: {
      status: 'IDLE',
      latency_ms: 0,
      checked_at: now.toISOString(),
      lock_present: false,
      error: null,
    },
    hrms: {
      status: 'IDLE',
      latency_ms: 0,
      checked_at: now.toISOString(),
      error: null,
    },
  };

  const [mysqlDependency, hrmsDependency] = await Promise.all([
    checkMysqlDependency(),
    checkHrmsDependency(),
  ]);
  dependencies.mysql = mysqlDependency;
  dependencies.hrms = hrmsDependency;
  if (mysqlDependency.status === 'FAILED') {
    partial = true;
    errors.push({
      source: 'payroll',
      message: mysqlDependency.error || 'MySQL health check failed',
    });
  }
  if (hrmsDependency.status === 'FAILED') {
    partial = true;
    errors.push({
      source: 'sync',
      message: hrmsDependency.error || 'HRMS source health check failed',
    });
  }

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
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const [summary, latest, oldestBacklogAt, hourlyRows, deadLetters] = await Promise.all([
      countOutboxByStatus(),
      fetchLatestOutbox(),
      OpsStatusRepository.findOldestNotificationBacklogAt(notificationMaxAttempts),
      OpsStatusRepository.countNotificationOutboxByStatusSince(oneHourAgo),
      OpsStatusRepository.countNotificationOutboxDeadLetters(notificationMaxAttempts),
    ]);
    const retryableFailed = Math.max(0, summary.FAILED - deadLetters);
    const hourly = aggregateCounts(hourlyRows);
    const totalLastHour = hourly.PENDING + hourly.PROCESSING + hourly.FAILED + hourly.SENT;
    notifications = {
      pending: summary.PENDING,
      processing: summary.PROCESSING,
      failed: retryableFailed,
      dead_letter: deadLetters,
      sent: summary.SENT,
      total: summary.PENDING + summary.PROCESSING + retryableFailed + summary.SENT,
      oldest_backlog_at: toIso(oldestBacklogAt),
      oldest_backlog_minutes: toMinutesDiff(oldestBacklogAt, now),
      failed_last_hour: hourly.FAILED,
      total_last_hour: totalLastHour,
      failed_rate_last_hour: totalLastHour > 0 ? Math.round((hourly.FAILED / totalLastHour) * 100) : 0,
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

  try {
    const queueLength = await redis.llen(OCR_QUEUE_KEY);
    ocr = {
      pending: Number(queueLength ?? 0),
      configured: Boolean(OcrHttpProvider.getServiceBase()),
      worker_enabled: getOcrWorkerEnabled(),
    };
  } catch (err) {
    partial = true;
    errors.push({
      source: 'ocr',
      message: err instanceof Error ? err.message : 'Failed to load OCR queue status',
    });
  }

  try {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [latestRuns, failedLast24h] = await Promise.all([
      OpsJobRunsRepository.findLatestRunsByJobKeys([...WORKFORCE_JOB_KEYS]),
      OpsJobRunsRepository.countFailedRunsSince([...WORKFORCE_JOB_KEYS], since),
    ]);
    workforce = {
      latest_runs: latestRuns,
      failed_last_24h: failedLast24h,
    };
  } catch (err) {
    partial = true;
    errors.push({
      source: 'workforce',
      message: err instanceof Error ? err.message : 'Failed to load workforce job status',
    });
  }

  try {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const [summary, latest, oldestBacklogAt, hourlyRows, deadLetters] = await Promise.all([
      OpsStatusRepository.countSnapshotOutboxByStatus(),
      fetchLatestSnapshotOutbox(),
      OpsStatusRepository.findOldestSnapshotBacklogAt(snapshotMaxAttempts),
      OpsStatusRepository.countSnapshotOutboxByStatusSince(oneHourAgo),
      OpsStatusRepository.countSnapshotOutboxDeadLetters(snapshotMaxAttempts),
    ]);
    const counts = aggregateCounts(summary);
    const retryableFailed = Math.max(0, counts.FAILED - deadLetters);
    const hourly = aggregateCounts(hourlyRows);
    const totalLastHour = hourly.PENDING + hourly.PROCESSING + hourly.FAILED + hourly.SENT;
    snapshot = {
      pending: counts.PENDING,
      processing: counts.PROCESSING,
      failed: retryableFailed,
      dead_letter: deadLetters,
      sent: counts.SENT,
      total: counts.PENDING + counts.PROCESSING + retryableFailed + counts.SENT,
      oldest_backlog_at: toIso(oldestBacklogAt),
      oldest_backlog_minutes: toMinutesDiff(oldestBacklogAt, now),
      failed_last_hour: hourly.FAILED,
      total_last_hour: totalLastHour,
      failed_rate_last_hour: totalLastHour > 0 ? Math.round((hourly.FAILED / totalLastHour) * 100) : 0,
      latest,
    };
  } catch (err) {
    partial = true;
    errors.push({
      source: 'snapshot',
      message: err instanceof Error ? err.message : 'Failed to load snapshot outbox status',
    });
  }

  let redisPing: string | null = null;
  const redisCheckedAt = new Date().toISOString();
  const redisStartedAt = Date.now();
  try {
    redisPing = await redis.get('system:sync:lock');
  } catch (err) {
    partial = true;
    errors.push({
      source: 'redis',
      message: err instanceof Error ? err.message : 'Failed to query redis health',
    });
  }
  dependencies.redis = {
    status: errors.some((item) => item.source === 'redis') ? 'FAILED' : 'IDLE',
    latency_ms: Date.now() - redisStartedAt,
    checked_at: redisCheckedAt,
    lock_present: Boolean(redisPing),
    error: errors.find((item) => item.source === 'redis')?.message ?? null,
  };

  const summary: JobSummary = {
    checked_at: now.toISOString(),
    dependencies,
    sync: {
      status: buildSyncStatus(syncStatus),
      isSyncing: syncStatus.isSyncing,
      lastResult: syncStatus.lastResult,
    },
    notifications,
    payroll,
    snapshot,
    ocr,
    workforce,
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
      key: 'mysql',
      name: 'MySQL',
      status: dependencies.mysql.status,
      detail: {
        latencyMs: dependencies.mysql.latency_ms,
        checkedAt: dependencies.mysql.checked_at,
        error: dependencies.mysql.error,
      },
    },
    {
      key: 'redis',
      name: 'Redis',
      status: dependencies.redis.status,
      detail: {
        latencyMs: dependencies.redis.latency_ms,
        checkedAt: dependencies.redis.checked_at,
        lockPresent: dependencies.redis.lock_present,
        error: dependencies.redis.error,
      },
    },
    {
      key: 'hrms-source',
      name: 'HRMS Source',
      status: dependencies.hrms.status,
      detail: {
        latencyMs: dependencies.hrms.latency_ms,
        checkedAt: dependencies.hrms.checked_at,
        error: dependencies.hrms.error,
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
          deadLetter: notifications.dead_letter,
          sent: notifications.sent,
          total: notifications.total,
          oldestBacklogAt: notifications.oldest_backlog_at,
          oldestBacklogMinutes: notifications.oldest_backlog_minutes,
          failedLastHour: notifications.failed_last_hour,
          totalLastHour: notifications.total_last_hour,
          failedRateLastHour: notifications.failed_rate_last_hour,
        },
      },
    },
    {
      key: 'snapshot-outbox',
      name: 'Payroll Snapshot Queue',
      status: buildSnapshotStatus(snapshot),
      detail: {
        counts: {
          pending: snapshot.pending,
          processing: snapshot.processing,
          failed: snapshot.failed,
          deadLetter: snapshot.dead_letter,
          sent: snapshot.sent,
          total: snapshot.total,
          oldestBacklogAt: snapshot.oldest_backlog_at,
          oldestBacklogMinutes: snapshot.oldest_backlog_minutes,
          failedLastHour: snapshot.failed_last_hour,
          totalLastHour: snapshot.total_last_hour,
          failedRateLastHour: snapshot.failed_rate_last_hour,
        },
        latest: snapshot.latest,
      },
    },
    {
      key: 'ocr-precheck',
      name: 'OCR Precheck',
      status: buildOcrStatus(ocr),
      detail: {
        pending: ocr.pending,
        configured: ocr.configured,
        workerEnabled: ocr.worker_enabled,
        queueKey: OCR_QUEUE_KEY,
      },
    },
    {
      key: 'workforce-compliance',
      name: 'Workforce Compliance Jobs',
      status:
        workforce.latest_runs.some((row) => row.status === 'FAILED')
          ? 'DEGRADED'
          : 'IDLE',
      detail: {
        failedLast24h: workforce.failed_last_24h,
        latestRuns: workforce.latest_runs,
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
