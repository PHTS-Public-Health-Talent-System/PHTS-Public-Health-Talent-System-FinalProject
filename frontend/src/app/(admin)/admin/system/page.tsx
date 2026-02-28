'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Server,
  Database,
  RefreshCw,
  Power,
  Download,
  Activity,
  FileWarning,
  Layers,
  Tag,
  History,
  Clock3,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SyncGovernanceCards,
  useBackupHistory,
  useBackupSchedule,
  useMaintenanceStatus,
  useSyncSchedule,
  useSystemJobStatus,
  useSystemVersionInfo,
  useToggleMaintenance,
  useTriggerBackup,
  useTriggerSync,
  useSyncReconciliation,
  useUpdateBackupSchedule,
  useUpdateSyncSchedule,
} from '@/features/system';
import { Progress } from '@/components/ui/progress';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';

// --- Types ---
type JobStatus = 'RUNNING' | 'IDLE' | 'FAILED' | 'DEGRADED' | 'UNKNOWN';

type JobStatusResponse = {
  partial: boolean;
  errors: Array<{ source: string; message: string }>;
  summary: {
    checked_at?: string;
    dependencies?: {
      mysql?: {
        status: 'IDLE' | 'FAILED';
        latency_ms: number;
        checked_at: string;
        error: string | null;
      };
      redis?: {
        status: 'IDLE' | 'FAILED';
        latency_ms: number;
        checked_at: string;
        lock_present: boolean;
        error: string | null;
      };
      hrms?: {
        status: 'IDLE' | 'FAILED';
        latency_ms: number;
        checked_at: string;
        error: string | null;
      };
    };
    notifications: {
      pending: number;
      processing: number;
      failed: number;
      sent: number;
      total: number;
      oldest_backlog_at?: string | null;
      oldest_backlog_minutes?: number | null;
      failed_last_hour?: number;
      total_last_hour?: number;
      failed_rate_last_hour?: number;
    };
    snapshot: {
      pending: number;
      processing: number;
      failed: number;
      sent: number;
      total: number;
      oldest_backlog_at?: string | null;
      oldest_backlog_minutes?: number | null;
      failed_last_hour?: number;
      total_last_hour?: number;
      failed_rate_last_hour?: number;
    };
    ocr: { pending: number; configured: boolean; worker_enabled: boolean };
    workforce: {
      failed_last_24h: number;
      latest_runs: Array<{
        job_run_id: number;
        job_key: string;
        trigger_source: string;
        status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
        summary_json: unknown | null;
        error_message: string | null;
        started_at: string;
        finished_at: string | null;
        duration_ms: number | null;
      }>;
    };
    payroll: { openPeriods: number };
  };
  jobs: Array<{ key: string; name: string; status: JobStatus; detail?: Record<string, unknown> }>;
};

type VersionResponse = { version?: string; commit?: string; env?: string };
type MaintenanceResponse = { enabled?: boolean };

// --- Helpers ---
const toStatusClass = (status: JobStatus) => {
  if (status === 'IDLE') return 'bg-emerald-500';
  if (status === 'RUNNING') return 'bg-blue-500';
  if (status === 'DEGRADED') return 'bg-amber-500';
  if (status === 'FAILED') return 'bg-red-500';
  return 'bg-muted-foreground';
};

const toThaiServiceName = (key: string, fallbackName: string) => {
  if (key === 'hrms-sync') return 'ซิงก์ข้อมูล HRMS';
  if (key === 'notification-outbox') return 'คิวแจ้งเตือน';
  if (key === 'snapshot-outbox') return 'คิวสร้างสแนปช็อตงวดจ่าย';
  if (key === 'ocr-precheck') return 'คิว OCR ตรวจเอกสาร';
  if (key === 'workforce-compliance') return 'งานกำกับบุคลากร';
  if (key === 'payroll-periods') return 'งวดการจ่ายเงิน';
  if (key === 'mysql') return 'ฐานข้อมูลหลัก (MySQL)';
  if (key === 'redis') return 'แคช/ล็อก (Redis)';
  if (key === 'hrms-source') return 'แหล่งข้อมูล HRMS';
  return fallbackName;
};

const toServiceStatusBadge = (key: string, status: JobStatus, detail: Record<string, unknown>) => {
  if (key === 'notification-outbox' || key === 'snapshot-outbox') {
    if (status === 'IDLE') return 'ไม่มีคิวค้าง';
    if (status === 'RUNNING') return 'มีคิวรอประมวลผล';
    if (status === 'DEGRADED') return 'มีรายการล้มเหลว';
    if (status === 'FAILED') return 'ระบบคิวผิดพลาด';
  }
  if (key === 'ocr-precheck') {
    if (status === 'IDLE') return 'พร้อมใช้งาน';
    if (status === 'RUNNING') return 'มีคิวรอตรวจ';
    if (status === 'FAILED') return 'ตั้งค่าไม่พร้อม';
  }
  if (key === 'workforce-compliance') {
    if (status === 'DEGRADED') return 'พบงานล้มเหลว';
    if (status === 'IDLE') return 'ปกติ';
  }
  if (key === 'payroll-periods') {
    if (status === 'RUNNING') return 'มีงวดเปิดอยู่';
    if (status === 'IDLE') return 'ไม่มีงวดเปิด';
  }
  if (key === 'hrms-sync') {
    if (status === 'RUNNING') return 'กำลังซิงก์';
    if (status === 'IDLE') return 'ปกติ';
    if (status === 'FAILED') return 'ซิงก์ล้มเหลว';
  }
  if (status === 'IDLE') return 'พร้อมใช้งาน';
  if (status === 'RUNNING') return 'กำลังทำงาน';
  if (status === 'DEGRADED') return 'มีความเสี่ยง';
  if (status === 'FAILED') return 'ขัดข้อง';
  if (detail.error) return 'มีข้อผิดพลาด';
  return 'ไม่ทราบสถานะ';
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatThaiDateTime(date);
};
const formatBytes = (bytes: number | null) => {
  if (!bytes || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
};

const toQueueProgress = (status: 'failed' | 'running' | 'success', activeCount: number) => {
  if (status === 'failed') return activeCount > 0 ? 100 : 0;
  if (status === 'running') return 100;
  return 0;
};
export default function SystemPage() {
  // --- States ---
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isBackupScheduleDialogOpen, setIsBackupScheduleDialogOpen] = useState(false);
  const [isSyncScheduleDialogOpen, setIsSyncScheduleDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [backupHistoryLimit] = useState(10);
  const [backupHour, setBackupHour] = useState('02');
  const [backupMinute, setBackupMinute] = useState('00');
  const [syncScheduleMode, setSyncScheduleMode] = useState<'DAILY' | 'INTERVAL'>('DAILY');
  const [syncHour, setSyncHour] = useState('02');
  const [syncMinute, setSyncMinute] = useState('00');
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState('60');

  const queryClient = useQueryClient();

  // --- Queries ---
  const { data: backupHistory = [], isLoading: isBackupHistoryLoading } =
    useBackupHistory(backupHistoryLimit);
  const backupScheduleQuery = useBackupSchedule();
  const syncScheduleQuery = useSyncSchedule();
  const reconciliationQuery = useSyncReconciliation();
  const jobsQuery = useSystemJobStatus();
  const versionQuery = useSystemVersionInfo();
  const maintenanceQuery = useMaintenanceStatus();

  // --- Mutations ---
  const triggerBackupMutation = useTriggerBackup();
  const triggerSyncMutation = useTriggerSync();
  const toggleMaintenanceMutation = useToggleMaintenance();
  const updateBackupScheduleMutation = useUpdateBackupSchedule();
  const updateSyncScheduleMutation = useUpdateSyncSchedule();

  // --- Data Processing ---
  const jobStatus = (jobsQuery.data ?? {
    partial: false,
    errors: [],
    summary: {
      notifications: { pending: 0, processing: 0, failed: 0, sent: 0, total: 0 },
      snapshot: { pending: 0, processing: 0, failed: 0, sent: 0, total: 0 },
      ocr: { pending: 0, configured: false, worker_enabled: true },
      workforce: { failed_last_24h: 0, latest_runs: [] },
      payroll: { openPeriods: 0 },
    },
    jobs: [],
  }) as JobStatusResponse;

  const versionInfo = (versionQuery.data ?? {}) as VersionResponse;
  const maintenance = (maintenanceQuery.data ?? {}) as MaintenanceResponse;
  const backupSchedule = backupScheduleQuery.data;
  const syncSchedule = syncScheduleQuery.data;
  const maintenanceEnabled = Boolean(maintenance.enabled);

  const backlogCount =
    Number(jobStatus.summary.notifications.pending ?? 0) +
    Number(jobStatus.summary.notifications.processing ?? 0) +
    Number(jobStatus.summary.notifications.failed ?? 0);
  const snapshotBacklogCount =
    Number(jobStatus.summary.snapshot.pending ?? 0) +
    Number(jobStatus.summary.snapshot.processing ?? 0) +
    Number(jobStatus.summary.snapshot.failed ?? 0);
  const ocrBacklogCount = Number(jobStatus.summary.ocr.pending ?? 0);
  const totalQueueBacklog = backlogCount + snapshotBacklogCount + ocrBacklogCount;

  const failedJobsCount =
    Number(jobStatus.summary.notifications.failed ?? 0) +
    Number(jobStatus.summary.snapshot.failed ?? 0) +
    (jobStatus.summary.ocr.worker_enabled && jobStatus.summary.ocr.configured ? 0 : 1) +
    Number(jobStatus.summary.workforce.failed_last_24h > 0 ? 1 : 0);

  const serviceRows = useMemo(() => {
    return jobStatus.jobs.map((job) => ({
      name: toThaiServiceName(job.key, job.name),
      status: job.status,
      key: job.key,
      detail: job.detail ?? {},
    }));
  }, [jobStatus.jobs]);

  const infrastructureRows = useMemo(
    () => serviceRows.filter((s) => ['mysql', 'redis', 'hrms-source'].includes(s.key)),
    [serviceRows],
  );
  const workflowRows = useMemo(
    () => serviceRows.filter((s) => !['mysql', 'redis', 'hrms-source'].includes(s.key)),
    [serviceRows],
  );

  const syncRows = useMemo(
    () => [
      {
        id: 'notification',
        type: 'คิวแจ้งเตือน',
        status:
          jobStatus.summary.notifications.failed > 0
            ? 'failed'
            : backlogCount > 0
              ? 'running'
              : 'success',
        records: backlogCount,
        details: `${formatThaiNumber(jobStatus.summary.notifications.failed)} ล้มเหลว / ${formatThaiNumber(jobStatus.summary.notifications.pending)} รอส่ง`,
        progress: toQueueProgress(
          jobStatus.summary.notifications.failed > 0
            ? 'failed'
            : backlogCount > 0
              ? 'running'
              : 'success',
          backlogCount,
        ),
        highlight:
          jobStatus.summary.notifications.oldest_backlog_minutes != null
            ? `ค้างเก่าสุด ${formatThaiNumber(jobStatus.summary.notifications.oldest_backlog_minutes)} นาที`
            : null,
      },
      {
        id: 'snapshot',
        type: 'คิวสร้างสแนปช็อต',
        status:
          jobStatus.summary.snapshot.failed > 0
            ? 'failed'
            : snapshotBacklogCount > 0
              ? 'running'
              : 'success',
        records: snapshotBacklogCount,
        details: `${formatThaiNumber(jobStatus.summary.snapshot.failed)} ล้มเหลว / ${formatThaiNumber(jobStatus.summary.snapshot.pending)} รอประมวลผล`,
        progress: toQueueProgress(
          jobStatus.summary.snapshot.failed > 0
            ? 'failed'
            : snapshotBacklogCount > 0
              ? 'running'
              : 'success',
          snapshotBacklogCount,
        ),
        highlight:
          jobStatus.summary.snapshot.oldest_backlog_minutes != null
            ? `ค้างเก่าสุด ${formatThaiNumber(jobStatus.summary.snapshot.oldest_backlog_minutes)} นาที`
            : null,
      },
      {
        id: 'ocr',
        type: 'คิว OCR ตรวจเอกสาร',
        status:
          !jobStatus.summary.ocr.worker_enabled || !jobStatus.summary.ocr.configured
            ? 'failed'
            : ocrBacklogCount > 0
              ? 'running'
              : 'success',
        records: ocrBacklogCount,
        details: jobStatus.summary.ocr.worker_enabled
          ? jobStatus.summary.ocr.configured
            ? 'รายการที่รอตรวจ'
            : 'ยังไม่ได้ตั้งค่า OCR'
          : 'OCR ถูกปิดอยู่',
        progress: toQueueProgress(
          !jobStatus.summary.ocr.worker_enabled || !jobStatus.summary.ocr.configured
            ? 'failed'
            : ocrBacklogCount > 0
              ? 'running'
              : 'success',
          ocrBacklogCount,
        ),
        highlight:
          !jobStatus.summary.ocr.worker_enabled || !jobStatus.summary.ocr.configured
            ? 'ตรวจสอบการตั้งค่า OCR Service'
            : null,
      },
    ],
    [
      jobStatus.summary.notifications,
      jobStatus.summary.snapshot,
      jobStatus.summary.ocr,
      backlogCount,
      snapshotBacklogCount,
      ocrBacklogCount,
    ],
  );

  const attentionItems = useMemo(() => {
    const items: Array<{ title: string; detail: string; tone: 'danger' | 'warn' | 'ok' }> = [];
    if (failedJobsCount > 0)
      items.push({
        title: 'พบงานล้มเหลว',
        detail: `${formatThaiNumber(failedJobsCount)} รายการในคิว/อัตโนมัติ`,
        tone: 'danger',
      });
    if ((jobStatus.summary.notifications.oldest_backlog_minutes ?? 0) >= 30)
      items.push({
        title: 'คิวแจ้งเตือนค้างนาน',
        detail: `เก่าสุด ${formatThaiNumber(Number(jobStatus.summary.notifications.oldest_backlog_minutes ?? 0))} นาที`,
        tone: 'warn',
      });
    if ((jobStatus.summary.snapshot.oldest_backlog_minutes ?? 0) >= 30)
      items.push({
        title: 'คิวสแนปช็อตค้างนาน',
        detail: `เก่าสุด ${formatThaiNumber(Number(jobStatus.summary.snapshot.oldest_backlog_minutes ?? 0))} นาที`,
        tone: 'warn',
      });
    if (!jobStatus.summary.ocr.worker_enabled || !jobStatus.summary.ocr.configured)
      items.push({
        title: 'OCR ไม่พร้อมใช้งาน',
        detail: 'โปรดตั้งค่าและเปิด Worker',
        tone: 'warn',
      });
    if (maintenanceEnabled)
      items.push({
        title: 'ปิดปรับปรุงระบบ',
        detail: 'ผู้ใช้ทั่วไปเข้าใช้งานไม่ได้',
        tone: 'warn',
      });

    if (items.length === 0)
      items.push({
        title: 'ไม่มีประเด็นเร่งด่วน',
        detail: 'บริการหลักและคิวงานทำงานปกติ',
        tone: 'ok',
      });
    return items.slice(0, 3);
  }, [failedJobsCount, jobStatus.summary, maintenanceEnabled]);

  // --- Handlers ---
  const handleMaintenanceSwitch = async (next: boolean) => {
    if (next) return setIsMaintenanceDialogOpen(true);
    try {
      await toggleMaintenanceMutation.mutateAsync({ enabled: false });
      toast.success('ปิดโหมดปิดปรับปรุงแล้ว');
      await queryClient.invalidateQueries({ queryKey: ['system-maintenance'] });
    } catch {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  const handleTriggerBackup = async () => {
    try {
      const result = await triggerBackupMutation.mutateAsync();
      if (!result?.enabled) toast.info('ระบบปิดการสำรองข้อมูลไว้ในการตั้งค่า');
      else if (result?.status === 'SUCCESS') toast.success(`สั่งสำรองข้อมูลสำเร็จ`);
      else toast.warning('เริ่มสำรองข้อมูลเบื้องหลังแล้ว');
      await queryClient.invalidateQueries({ queryKey: ['system-backup-history'] });
      setIsBackupDialogOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'สำรองข้อมูลไม่สำเร็จ'));
    }
  };

  const handleUpdateBackupSchedule = async () => {
    try {
      await updateBackupScheduleMutation.mutateAsync({
        hour: Number(backupHour),
        minute: Number(backupMinute),
      });
      toast.success('อัปเดตเวลาสำรองข้อมูลเรียบร้อยแล้ว');
      setIsBackupScheduleDialogOpen(false);
      backupScheduleQuery.refetch();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'ไม่สามารถอัปเดตเวลาได้'));
    }
  };

  const handleUpdateSyncSchedule = async () => {
    try {
      await updateSyncScheduleMutation.mutateAsync({
        mode: syncScheduleMode,
        hour: syncScheduleMode === 'DAILY' ? Number(syncHour) : undefined,
        minute: syncScheduleMode === 'DAILY' ? Number(syncMinute) : undefined,
        interval_minutes: syncScheduleMode === 'INTERVAL' ? Number(syncIntervalMinutes) : undefined,
        timezone: syncSchedule?.timezone || 'Asia/Bangkok',
      });
      toast.success('อัปเดตเวลาซิงก์ข้อมูลเรียบร้อยแล้ว');
      setIsSyncScheduleDialogOpen(false);
      syncScheduleQuery.refetch();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'ไม่สามารถอัปเดตเวลาได้'));
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Server className="h-6 w-6 text-primary" /> ตั้งค่าและการจัดการระบบ (System Settings)
        </h1>
        <p className="text-muted-foreground mt-1">
          ตรวจสอบสถานะเซิร์ฟเวอร์ การบำรุงรักษา และตั้งค่าการสำรอง/ซิงก์ข้อมูล
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              เวอร์ชันระบบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{versionInfo.version || '-'}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Environment:</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase font-mono">
                    {versionInfo.env || 'Unknown'}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Tag className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'border-border shadow-sm transition-all',
            maintenanceEnabled &&
              'border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20',
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              โหมดปิดปรับปรุง (Maintenance)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={cn(
                    'text-2xl font-bold',
                    maintenanceEnabled ? 'text-destructive' : 'text-emerald-600',
                  )}
                >
                  {maintenanceEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {maintenanceEnabled ? 'จำกัดการเข้าถึงของผู้ใช้' : 'ระบบเปิดใช้งานปกติ'}
                </p>
              </div>
              <Switch
                checked={maintenanceEnabled}
                onCheckedChange={handleMaintenanceSwitch}
                disabled={maintenanceQuery.isLoading || toggleMaintenanceMutation.isPending}
                className={maintenanceEnabled ? 'data-[state=checked]:bg-destructive' : ''}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              คิวงานค้าง (Queue Backlog)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {formatThaiNumber(totalQueueBacklog)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">รวมจากทุกบริการคิว</p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-full',
                  totalQueueBacklog > 100
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                <Layers className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'border-border shadow-sm transition-all',
            failedJobsCount > 0 && 'border-destructive/30 bg-destructive/5',
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              งานที่ล้มเหลว (Failed Jobs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={cn(
                    'text-2xl font-bold',
                    failedJobsCount > 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {formatThaiNumber(failedJobsCount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  รายการที่ไม่สำเร็จ / ต้องการแก้ไข
                </p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-full',
                  failedJobsCount > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                <FileWarning className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attention Banner Area */}
      <Card className="border-border shadow-sm bg-muted/10">
        <CardContent className="p-4 grid gap-3 md:grid-cols-3">
          {attentionItems.map((item) => (
            <div
              key={item.title}
              className={cn(
                'rounded-lg border p-3 flex gap-3 items-start bg-background shadow-sm',
                item.tone === 'danger' && 'border-destructive/40 bg-destructive/5',
                item.tone === 'warn' && 'border-amber-200 bg-amber-50/50',
                item.tone === 'ok' && 'border-emerald-200 bg-emerald-50/50',
              )}
            >
              {item.tone === 'danger' && (
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              )}
              {item.tone === 'warn' && (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              {item.tone === 'ok' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    item.tone === 'danger'
                      ? 'text-destructive'
                      : item.tone === 'warn'
                        ? 'text-amber-700'
                        : 'text-emerald-700',
                  )}
                >
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- Left Column: System Health & Jobs --- */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-muted-foreground" /> สถานะบริการหลัก (Service
                  Health)
                </CardTitle>
                <Badge
                  variant={jobStatus.partial ? 'destructive' : 'outline'}
                  className={
                    !jobStatus.partial ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''
                  }
                >
                  {jobStatus.partial ? 'มีความเสี่ยง' : 'ทำงานปกติ'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Infrastructure Section */}
              <div className="p-5 border-b">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" /> โครงสร้างพื้นฐาน (Infrastructure)
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  {infrastructureRows.map((service) => (
                    <div key={service.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{service.name}</span>
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            service.status === 'FAILED'
                              ? 'bg-red-500 animate-pulse'
                              : 'bg-emerald-500',
                          )}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={cn(
                            service.status === 'FAILED'
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                          )}
                        >
                          {toServiceStatusBadge(service.key, service.status, service.detail)}
                        </span>
                        {'latencyMs' in service.detail && (
                          <span className="font-mono text-muted-foreground">
                            {formatThaiNumber(Number(service.detail.latencyMs ?? 0))}ms
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflows Section */}
              <div className="p-5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Workflow className="h-3.5 w-3.5" /> บริการย่อย (Microservices)
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {workflowRows.map((service) => (
                    <div
                      key={service.key}
                      className="p-3 border rounded-lg bg-card hover:border-primary/20 transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="relative flex h-2.5 w-2.5 items-center justify-center shrink-0">
                            <span
                              className={cn(
                                'absolute inline-flex h-full w-full rounded-full opacity-30',
                                toStatusClass(service.status),
                              )}
                            />
                            <span
                              className={cn(
                                'relative inline-flex rounded-full h-1.5 w-1.5',
                                toStatusClass(service.status),
                              )}
                            />
                          </div>
                          <span className="font-medium text-sm truncate">{service.name}</span>
                        </div>
                        {Boolean((service.detail as { error?: unknown }).error) && (
                          <p className="text-[10px] text-destructive leading-tight line-clamp-2 mt-1">
                            {String((service.detail as { error?: unknown }).error)}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-normal shrink-0',
                          service.status === 'FAILED'
                            ? 'text-destructive border-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {toServiceStatusBadge(service.key, service.status, service.detail)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync Processing Queue */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" /> คิวงานประมวลผล (Processing
                  Queues)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSyncDialogOpen(true)}
                  className="gap-2 h-8 text-xs bg-background"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> ดึงข้อมูล HRMS
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {syncRows.map((row) => (
                <div key={row.id} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <span className="font-medium text-sm block">{row.type}</span>
                      <span className="text-xs text-muted-foreground">{row.details}</span>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        row.status === 'failed' ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {formatThaiNumber(row.records)}{' '}
                      <span className="text-xs text-muted-foreground font-normal">รายการ</span>
                    </span>
                  </div>
                  <Progress
                    value={row.progress}
                    className={cn(
                      'h-2 bg-secondary',
                      row.status === 'failed' && 'bg-destructive/20 [&>div]:bg-destructive',
                      row.status === 'running' && 'bg-blue-100 [&>div]:bg-blue-500 animate-pulse',
                    )}
                  />
                  {row.highlight && (
                    <p className="text-[10px] text-amber-600 font-medium">{row.highlight}</p>
                  )}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground">
                  อัตราส่งแจ้งเตือนล้มเหลว (1 ชม.):{' '}
                  <span className="font-semibold text-foreground">
                    {formatThaiNumber(
                      Number(jobStatus.summary.notifications.failed_rate_last_hour ?? 0),
                    )}
                    %
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  อัตราสร้าง Snapshot ล้มเหลว (1 ชม.):{' '}
                  <span className="font-semibold text-foreground">
                    {formatThaiNumber(
                      Number(jobStatus.summary.snapshot.failed_rate_last_hour ?? 0),
                    )}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync Governance Link Card */}
          <SyncGovernanceCards
            reconciliation={reconciliationQuery.data}
            isFetching={reconciliationQuery.isFetching}
            onRefresh={() => reconciliationQuery.refetch()}
            actionSlot={
              <Button variant="outline" size="sm" asChild className="gap-2 h-8 text-xs">
                <Link href="/admin/system/sync-monitor">
                  <ShieldCheck className="h-3.5 w-3.5" /> ตรวจสอบความสอดคล้อง
                </Link>
              </Button>
            }
          />
        </div>

        {/* --- Right Column: Settings & Schedules --- */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/5">
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4 text-primary" /> เวลาซิงก์ข้อมูลอัตโนมัติ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                  {syncSchedule?.mode === 'INTERVAL'
                    ? 'รอบความถี่'
                    : `เวลาที่ตั้งไว้ (${syncSchedule?.timezone || 'UTC'})`}
                </p>
                <div className="text-3xl font-bold text-foreground font-mono">
                  {syncSchedule
                    ? syncSchedule.mode === 'INTERVAL'
                      ? `ทุก ${syncSchedule.interval_minutes}m`
                      : `${String(syncSchedule.hour).padStart(2, '0')}:${String(syncSchedule.minute).padStart(2, '0')}`
                    : '--:--'}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full text-xs h-9 bg-background"
                onClick={() => {
                  if (syncSchedule) {
                    setSyncScheduleMode(syncSchedule.mode);
                    setSyncHour(String(syncSchedule.hour).padStart(2, '0'));
                    setSyncMinute(String(syncSchedule.minute).padStart(2, '0'));
                    setSyncIntervalMinutes(String(syncSchedule.interval_minutes));
                  }
                  setIsSyncScheduleDialogOpen(true);
                }}
                disabled={syncScheduleQuery.isLoading}
              >
                ปรับเปลี่ยนเวลา
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-primary" /> เวลาสำรองข้อมูลอัตโนมัติ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                  เวลาที่ตั้งไว้ ({backupSchedule?.timezone || 'UTC'})
                </p>
                <div className="text-3xl font-bold text-foreground font-mono">
                  {backupSchedule
                    ? `${String(backupSchedule.hour).padStart(2, '0')}:${String(backupSchedule.minute).padStart(2, '0')}`
                    : '--:--'}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full text-xs h-9 bg-background"
                onClick={() => {
                  if (backupSchedule) {
                    setBackupHour(String(backupSchedule.hour).padStart(2, '0'));
                    setBackupMinute(String(backupSchedule.minute).padStart(2, '0'));
                  }
                  setIsBackupScheduleDialogOpen(true);
                }}
                disabled={backupScheduleQuery.isLoading}
              >
                ปรับเปลี่ยนเวลา
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm flex flex-col min-h-[400px]">
            <CardHeader className="pb-4 border-b bg-muted/5">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base mb-1">
                    <Database className="h-4 w-4 text-muted-foreground" /> ประวัติสำรองข้อมูล
                  </CardTitle>
                  <CardDescription className="text-xs">รายการล่าสุดจากระบบ</CardDescription>
                </div>
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 shadow-sm"
                  onClick={() => setIsBackupDialogOpen(true)}
                  title="สั่งสำรองข้อมูลทันที"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto pr-2">
                {isBackupHistoryLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-md" />
                    ))}
                  </div>
                ) : backupHistory.length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">ยังไม่มีประวัติสำรองข้อมูล</p>
                  </div>
                ) : (
                  /* * Robust Timeline Implementation */
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-5">
                    {backupHistory.slice(0, backupHistoryLimit).map((backup, idx) => (
                      <div key={backup.job_id} className="contents group">
                        {/* Timeline Node */}
                        <div className="relative flex flex-col items-center mt-1">
                          <div
                            className={cn(
                              'h-2.5 w-2.5 rounded-full border-2 border-background z-10',
                              backup.status === 'SUCCESS'
                                ? 'bg-emerald-500'
                                : backup.status === 'RUNNING'
                                  ? 'bg-blue-500 animate-pulse'
                                  : 'bg-destructive',
                            )}
                          />
                          {idx !== backupHistory.slice(0, backupHistoryLimit).length - 1 && (
                            <div className="absolute top-3 bottom-[-20px] w-px bg-border group-hover:bg-border/80 transition-colors" />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex flex-col gap-0.5 pb-1">
                          <span className="text-xs font-semibold text-foreground">
                            {formatDateTime(backup.created_at)}
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {backup.trigger_source === 'SCHEDULED'
                                ? 'อัตโนมัติ'
                                : 'ผู้ใช้งานสั่ง'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {backup.status !== 'SUCCESS' && (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px] h-4 px-1.5 font-normal"
                                >
                                  {backup.status}
                                </Badge>
                              )}
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 rounded">
                                {formatBytes(backup.backup_file_size_bytes)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}

      {/* Maintenance Dialog */}
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto bg-destructive/10 p-4 rounded-full mb-3">
              <Power className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center text-lg">ยืนยันการตั้งค่าโหมดปรับปรุง</DialogTitle>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-sm mt-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              เมื่อเปิดใช้งาน ผู้ใช้ทั่วไปจะถูกตัดออกจากระบบทันที
              โปรดตรวจสอบให้แน่ใจว่าไม่มีคิวประมวลผลเงินเดือนกำลังทำงานอยู่
            </p>
          </div>
          <DialogFooter className="sm:justify-center gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsMaintenanceDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await toggleMaintenanceMutation.mutateAsync({ enabled: true });
                  toast.success('ระบบเข้าสู่โหมดปิดปรับปรุงแล้ว');
                  setIsMaintenanceDialogOpen(false);
                } catch {
                  toast.error('เกิดข้อผิดพลาด');
                }
              }}
              disabled={toggleMaintenanceMutation.isPending}
              className="w-full sm:w-auto"
            >
              เปิดโหมดปรับปรุง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Dialog */}
      <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" /> เริ่มสำรองข้อมูลระบบ
            </DialogTitle>
            <DialogDescription>
              การสำรองข้อมูลจะทำในเบื้องหลังและอาจใช้เวลา 1-3 นาที
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsBackupDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleTriggerBackup} disabled={triggerBackupMutation.isPending}>
              {triggerBackupMutation.isPending ? 'กำลังเริ่ม...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Dialog */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>ดึงข้อมูลจาก HRMS ทันที</DialogTitle>
            <DialogDescription>
              อัปเดตข้อมูลบุคลากร โครงสร้าง และสิทธิ์การเข้าถึงจากระบบกลาง
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <div className="bg-blue-50 text-blue-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <RefreshCw
                className={cn('h-5 w-5', triggerSyncMutation.isPending && 'animate-spin-slow')}
              />
            </div>
            <p className="text-sm text-muted-foreground">งานจะถูกส่งเข้าคิวและทำงานในเบื้องหลัง</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={async () => {
                try {
                  await triggerSyncMutation.mutateAsync();
                  toast.success('ส่งคำสั่งซิงก์ข้อมูลแล้ว');
                  setIsSyncDialogOpen(false);
                } catch {
                  toast.error('ไม่สามารถเริ่มการซิงก์ได้');
                }
              }}
              disabled={triggerSyncMutation.isPending}
            >
              เริ่มการซิงก์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Schedule Dialog */}
      <Dialog open={isBackupScheduleDialogOpen} onOpenChange={setIsBackupScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>ตั้งเวลาสำรองข้อมูลอัตโนมัติ</DialogTitle>
            <DialogDescription>รัน 1 ครั้งต่อวัน (24 ชม.)</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="space-y-1.5 text-center">
              <Label className="text-xs text-muted-foreground">ชั่วโมง</Label>
              <Select value={backupHour} onValueChange={setBackupHour}>
                <SelectTrigger className="w-20 h-12 text-xl font-bold font-mono bg-muted/50 justify-center">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const val = String(i).padStart(2, '0');
                    return (
                      <SelectItem key={val} value={val} className="text-base font-mono">
                        {val}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="text-2xl font-bold text-muted-foreground mt-4">:</div>
            <div className="space-y-1.5 text-center">
              <Label className="text-xs text-muted-foreground">นาที</Label>
              <Select value={backupMinute} onValueChange={setBackupMinute}>
                <SelectTrigger className="w-20 h-12 text-xl font-bold font-mono bg-muted/50 justify-center">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const val = String(i * 5).padStart(2, '0');
                    return (
                      <SelectItem key={val} value={val} className="text-base font-mono">
                        {val}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBackupScheduleDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleUpdateBackupSchedule}
              disabled={updateBackupScheduleMutation.isPending}
            >
              บันทึกเวลา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Schedule Dialog */}
      <Dialog open={isSyncScheduleDialogOpen} onOpenChange={setIsSyncScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>ตั้งเวลาซิงก์ข้อมูลอัตโนมัติ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">รูปแบบ</Label>
              <Select
                value={syncScheduleMode}
                onValueChange={(value) => setSyncScheduleMode(value as 'DAILY' | 'INTERVAL')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">รันเวลาเดิมทุกวัน</SelectItem>
                  <SelectItem value="INTERVAL">รันตามความถี่ (Interval)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {syncScheduleMode === 'DAILY' ? (
              <div className="flex items-center justify-center gap-4 bg-muted/20 p-4 rounded-lg border">
                <div className="space-y-1.5 text-center">
                  <Label className="text-xs text-muted-foreground">ชั่วโมง</Label>
                  <Select value={syncHour} onValueChange={setSyncHour}>
                    <SelectTrigger className="w-20 h-12 text-xl font-bold font-mono bg-background justify-center">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {Array.from({ length: 24 }).map((_, i) => {
                        const val = String(i).padStart(2, '0');
                        return (
                          <SelectItem key={val} value={val}>
                            {val}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-2xl font-bold text-muted-foreground mt-4">:</div>
                <div className="space-y-1.5 text-center">
                  <Label className="text-xs text-muted-foreground">นาที</Label>
                  <Select value={syncMinute} onValueChange={setSyncMinute}>
                    <SelectTrigger className="w-20 h-12 text-xl font-bold font-mono bg-background justify-center">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const val = String(i * 5).padStart(2, '0');
                        return (
                          <SelectItem key={val} value={val}>
                            {val}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2 bg-muted/20 p-4 rounded-lg border">
                <Label className="text-xs">ความถี่</Label>
                <Select value={syncIntervalMinutes} onValueChange={setSyncIntervalMinutes}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">ทุก 15 นาที</SelectItem>
                    <SelectItem value="30">ทุก 30 นาที</SelectItem>
                    <SelectItem value="60">ทุก 1 ชั่วโมง</SelectItem>
                    <SelectItem value="120">ทุก 2 ชั่วโมง</SelectItem>
                    <SelectItem value="180">ทุก 3 ชั่วโมง</SelectItem>
                    <SelectItem value="360">ทุก 6 ชั่วโมง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncScheduleDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleUpdateSyncSchedule}
              disabled={updateSyncScheduleMutation.isPending}
            >
              บันทึกเวลา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
