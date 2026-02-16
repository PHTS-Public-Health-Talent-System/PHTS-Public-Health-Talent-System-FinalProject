'use client';

import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useBackupHistory,
  useMaintenanceStatus,
  useSystemJobStatus,
  useSystemVersionInfo,
  useToggleMaintenance,
  useTriggerBackup,
  useTriggerSync,
} from '@/features/system';
import { Progress } from '@/components/ui/progress';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';

// --- Types ---
type JobStatus = 'RUNNING' | 'IDLE' | 'FAILED' | 'DEGRADED' | 'UNKNOWN';

type JobStatusResponse = {
  partial: boolean;
  errors: Array<{ source: string; message: string }>;
  summary: {
    notifications: {
      pending: number;
      processing: number;
      failed: number;
      sent: number;
      total: number;
    };
    payroll: {
      openPeriods: number;
    };
  };
  jobs: Array<{
    key: string;
    name: string;
    status: JobStatus;
    detail?: Record<string, unknown>;
  }>;
};

type VersionResponse = {
  version?: string;
  commit?: string;
  env?: string;
};

type MaintenanceResponse = {
  enabled?: boolean;
};

// --- Helpers ---
const toStatusClass = (status: JobStatus) => {
  if (status === 'IDLE') return 'bg-emerald-500';
  if (status === 'RUNNING') return 'bg-blue-500';
  if (status === 'DEGRADED') return 'bg-amber-500';
  if (status === 'FAILED') return 'bg-red-500';
  return 'bg-muted-foreground';
};

const toStatusBadge = (status: JobStatus) => {
  if (status === 'IDLE') return 'ออนไลน์';
  if (status === 'RUNNING') return 'กำลังทำงาน';
  if (status === 'DEGRADED') return 'มีความเสี่ยง';
  if (status === 'FAILED') return 'ผิดพลาด';
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

export default function SystemPage() {
  // --- State ---
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // --- Data Fetching ---
  const { data: backupHistory = [], isLoading: isBackupHistoryLoading } = useBackupHistory(5); // Limit to 5 for cleaner UI
  const jobsQuery = useSystemJobStatus();
  const versionQuery = useSystemVersionInfo();
  const maintenanceQuery = useMaintenanceStatus();

  // --- Mutations ---
  const triggerBackupMutation = useTriggerBackup();
  const triggerSyncMutation = useTriggerSync();
  const toggleMaintenanceMutation = useToggleMaintenance();

  // --- Data Processing ---
  const jobStatus = (jobsQuery.data ?? {
    partial: false,
    errors: [],
    summary: {
      notifications: { pending: 0, processing: 0, failed: 0, sent: 0, total: 0 },
      payroll: { openPeriods: 0 },
    },
    jobs: [],
  }) as JobStatusResponse;

  const versionInfo = (versionQuery.data ?? {}) as VersionResponse;
  const maintenance = (maintenanceQuery.data ?? {}) as MaintenanceResponse;
  const maintenanceEnabled = Boolean(maintenance.enabled);

  const backlogCount =
    Number(jobStatus.summary.notifications.pending ?? 0) +
    Number(jobStatus.summary.notifications.processing ?? 0) +
    Number(jobStatus.summary.notifications.failed ?? 0);

  const serviceRows = useMemo(() => {
    return jobStatus.jobs.map((job) => ({
      name: job.name,
      status: job.status,
      key: job.key,
      detail: job.detail ?? {},
    }));
  }, [jobStatus.jobs]);

  const syncRows = useMemo(
    () => [
      {
        id: 'notification',
        type: 'คิวแจ้งเตือน (Notifications Queue)',
        status:
          jobStatus.summary.notifications.failed > 0
            ? 'failed'
            : backlogCount > 0
              ? 'running'
              : 'success',
        records: backlogCount,
        details: `${jobStatus.summary.notifications.failed} Failed / ${jobStatus.summary.notifications.pending} Pending`,
      },
      {
        id: 'payroll',
        type: 'งวดการจ่ายเงิน (Open Payroll Periods)',
        status: jobStatus.summary.payroll.openPeriods > 0 ? 'running' : 'success',
        records: Number(jobStatus.summary.payroll.openPeriods ?? 0),
        details: 'งวดที่ยังไม่ได้ปิด',
      },
    ],
    [jobStatus.summary.notifications, jobStatus.summary.payroll.openPeriods, backlogCount],
  );

  // --- Handlers ---
  const handleMaintenanceSwitch = async (next: boolean) => {
    if (next) {
      setIsMaintenanceDialogOpen(true);
      return;
    }
    try {
      await toggleMaintenanceMutation.mutateAsync({ enabled: false });
      toast.success('ปิดโหมดปิดปรับปรุงแล้ว ผู้ใช้สามารถเข้าใช้งานได้ตามปกติ');
      await queryClient.invalidateQueries({ queryKey: ['system-maintenance'] });
    } catch {
      toast.error('ไม่สามารถปิดโหมดปิดปรับปรุงได้');
    }
  };

  const handleTriggerBackup = async () => {
    try {
      const result = await triggerBackupMutation.mutateAsync();
      if (!result?.enabled) {
        toast.info('ระบบปิดการสำรองข้อมูลไว้ในการตั้งค่า');
      } else if (result?.status === 'SUCCESS') {
        toast.success(`สำรองข้อมูลสำเร็จ (Job #${result.jobId ?? '-'})`);
      } else {
        toast.warning(`เริ่มสำรองข้อมูลแล้วแต่ยังไม่เสร็จสมบูรณ์ (Job #${result?.jobId ?? '-'})`);
      }
      await queryClient.invalidateQueries({ queryKey: ['system-backup-history'] });
      setIsBackupDialogOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'สำรองข้อมูลไม่สำเร็จ'));
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" /> ตั้งค่าระบบ
          </h1>
          <p className="text-muted-foreground mt-1">
            จัดการสถานะเซิร์ฟเวอร์ การบำรุงรักษา และการสำรองข้อมูล
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSyncDialogOpen(true)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> ซิงก์ข้อมูล HRMS
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsBackupDialogOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> สำรองข้อมูลทันที
          </Button>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Version Info */}
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
                  <span>สภาพแวดล้อม:</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {versionInfo.env || 'ไม่ระบุ'}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Tag className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Status */}
        <Card
          className={`border-border shadow-sm ${maintenanceEnabled ? 'border-destructive/50 bg-destructive/5' : ''}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              โหมดปิดปรับปรุง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={`text-2xl font-bold ${maintenanceEnabled ? 'text-destructive' : 'text-emerald-600'}`}
                >
                  {maintenanceEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {maintenanceEnabled ? 'ผู้ใช้ทั่วไปเข้าไม่ได้' : 'ระบบเปิดใช้งานปกติ'}
                </p>
              </div>
              <Switch
                checked={maintenanceEnabled}
                onCheckedChange={handleMaintenanceSwitch}
                disabled={maintenanceQuery.isLoading || toggleMaintenanceMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* Job Queue Status */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">คิวงานระบบ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatThaiNumber(backlogCount)}</div>
                <p className="text-xs text-muted-foreground mt-1">งานที่ค้างในระบบ</p>
              </div>
              <div
                className={`p-3 rounded-full ${backlogCount > 100 ? 'bg-amber-100' : 'bg-secondary'}`}
              >
                <Layers
                  className={`h-5 w-5 ${backlogCount > 100 ? 'text-amber-600' : 'text-muted-foreground'}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Failed Jobs */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">งานที่ล้มเหลว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={`text-2xl font-bold ${jobStatus.summary.notifications.failed > 0 ? 'text-destructive' : 'text-foreground'}`}
                >
                  {formatThaiNumber(jobStatus.summary.notifications.failed)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">งานที่ล้มเหลว</p>
              </div>
              <div
                className={`p-3 rounded-full ${jobStatus.summary.notifications.failed > 0 ? 'bg-destructive/10' : 'bg-secondary'}`}
              >
                <FileWarning
                  className={`h-5 w-5 ${jobStatus.summary.notifications.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Services & Sync Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Status */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" /> สถานะบริการ
                  </CardTitle>
                  <CardDescription>สถานะการทำงานของบริการย่อยในระบบ</CardDescription>
                </div>
                <Badge
                  variant={jobStatus.partial ? 'destructive' : 'outline'}
                  className={
                    !jobStatus.partial ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''
                  }
                >
                  {jobStatus.partial ? 'มีความเสี่ยง' : 'ปกติ'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {serviceRows.map((service) => (
                <div
                  key={service.key}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${toStatusClass(service.status)} ring-2 ring-opacity-20 ring-current`}
                    />
                    <span className="font-medium text-sm">{service.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {toStatusBadge(service.status)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sync & Queue Status */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-muted-foreground" /> งานประมวลผล (Background
                Jobs)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {syncRows.map((row) => (
                <div key={row.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{row.type}</span>
                    <span
                      className={
                        row.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                      }
                    >
                      {formatThaiNumber(row.records)} รายการ
                    </span>
                  </div>
                  <Progress
                    value={row.records > 0 ? 100 : 0}
                    className={`h-2 ${row.status === 'failed' ? 'bg-destructive/20 [&>div]:bg-destructive' : row.status === 'running' ? 'bg-blue-100 [&>div]:bg-blue-500 animate-pulse' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">{row.details}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Backup History */}
        <div className="lg:col-span-1">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" /> ประวัติการสำรองข้อมูล
              </CardTitle>
              <CardDescription>5 รายการล่าสุด</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                {isBackupHistoryLoading ? (
                  <p className="text-sm text-center text-muted-foreground py-8">
                    กำลังโหลดข้อมูล...
                  </p>
                ) : backupHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">ยังไม่มีประวัติการสำรองข้อมูล</p>
                  </div>
                ) : (
                  <div className="relative border-l border-muted ml-3 space-y-6 py-2">
                    {backupHistory.map((backup) => (
                      <div key={backup.job_id} className="relative pl-6">
                        <div
                          className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background ${
                            backup.status === 'SUCCESS'
                              ? 'bg-emerald-500'
                              : backup.status === 'RUNNING'
                                ? 'bg-blue-500'
                                : 'bg-destructive'
                          }`}
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium leading-none">
                            {formatDateTime(backup.created_at)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {backup.trigger_source === 'SCHEDULED'
                              ? 'สำรองข้อมูลอัตโนมัติ'
                              : 'สำรองข้อมูลด้วยตนเอง'}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal">
                              {formatBytes(backup.backup_file_size_bytes)}
                            </Badge>
                            {backup.status !== 'SUCCESS' && (
                              <span className="text-[10px] text-destructive uppercase font-bold">
                                {backup.status}
                              </span>
                            )}
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
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto bg-destructive/10 p-3 rounded-full mb-3">
              <Power className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">ยืนยันการเปิดโหมดปรับปรุง?</DialogTitle>
            <DialogDescription className="text-center">
              เมื่อเปิดใช้งาน ผู้ใช้งานทั่วไปจะไม่สามารถเข้าสู่ระบบได้จนกว่าคุณจะปิดโหมดนี้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setIsMaintenanceDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await toggleMaintenanceMutation.mutateAsync({ enabled: true });
                  toast.success('ระบบเข้าสู่โหมดปิดปรับปรุงแล้ว');
                  await queryClient.invalidateQueries({ queryKey: ['system-maintenance'] });
                  setIsMaintenanceDialogOpen(false);
                } catch {
                  toast.error('เกิดข้อผิดพลาดในการเปิดโหมดปรับปรุง');
                }
              }}
              disabled={toggleMaintenanceMutation.isPending}
            >
              ยืนยันเปิดโหมดปรับปรุง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สำรองข้อมูล</DialogTitle>
            <DialogDescription>
              การสำรองข้อมูลอาจใช้เวลาสักครู่ ระบบจะทำงานในเบื้องหลัง
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/50 p-4 rounded-lg text-sm border border-border">
            <p className="font-medium mb-1">สิ่งที่จะถูกสำรอง:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>ฐานข้อมูลผู้ใช้และสิทธิ์</li>
              <li>ประวัติการทำธุรกรรม</li>
              <li>การตั้งค่าระบบ</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBackupDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleTriggerBackup} disabled={triggerBackupMutation.isPending}>
              {triggerBackupMutation.isPending ? 'กำลังเริ่ม...' : 'เริ่มสำรองข้อมูล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ซิงค์ข้อมูล HRMS</DialogTitle>
            <DialogDescription>
              ดึงข้อมูลพนักงานล่าสุดจากระบบ HRMS เพื่ออัปเดตฐานข้อมูล
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin-slow" />
            <p className="text-sm text-muted-foreground">
              กระบวนการนี้จะทำงานในเบื้องหลัง คุณสามารถปิดหน้าต่างนี้ได้
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={async () => {
                try {
                  await triggerSyncMutation.mutateAsync();
                  toast.success('ส่งคำสั่งซิงค์ข้อมูลแล้ว');
                  setIsSyncDialogOpen(false);
                } catch {
                  toast.error('ไม่สามารถเริ่มการซิงค์ได้');
                }
              }}
              disabled={triggerSyncMutation.isPending}
            >
              ยืนยันการซิงค์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
