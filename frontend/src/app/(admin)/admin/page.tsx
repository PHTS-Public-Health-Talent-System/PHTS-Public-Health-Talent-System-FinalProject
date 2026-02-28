'use client';

import { useMemo } from 'react';
import {
  Users,
  Shield,
  FileText,
  Megaphone,
  Activity,
  RefreshCw,
  Settings,
  Server,
  AlertTriangle,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCards, type StatItem } from '@/components/stat-cards';
import { DataTableCard } from '@/components/data-table-card';
import { QuickActions } from '@/components/quick-actions';
import { useMaintenanceStatus, useSearchUsers, useSystemJobStatus } from '@/features/system/hooks';
import { useAccessReviewQueue } from '@/features/access-review/hooks';
import { useAuditSummary } from '@/features/audit/hooks';
import { useAllAnnouncements } from '@/features/announcement/hooks';
import { Badge } from '@/components/ui/badge';
import { formatThaiDate, formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';

// --- Types ---
type AuditSummaryRow = { event_type: string; count: number };

type JobStatusResponse = {
  partial: boolean;
  summary: {
    notifications: {
      pending: number;
      processing: number;
      failed: number;
    };
  };
  jobs: Array<{ status: 'RUNNING' | 'IDLE' | 'FAILED' | 'DEGRADED' | 'UNKNOWN' }>;
};

// --- Config ---
const quickActions = [
  { label: 'จัดการผู้ใช้', href: '/admin/users', icon: Users },
  { label: 'ตรวจสอบสิทธิ์ผู้ใช้งาน', href: '/admin/access-review', icon: Shield },
  { label: 'ซิงค์ข้อมูล HRMS', href: '/admin/system', icon: RefreshCw },
  { label: 'ตั้งค่าระบบ', href: '/admin/system', icon: Settings },
];

export default function AdminDashboardPage() {
  // --- Data Fetching ---
  const usersQuery = useSearchUsers({ q: '', page: '1', limit: '1' });
  const queueSummaryQuery = useAccessReviewQueue({ page: 1, limit: 1 });
  const auditSummaryQuery = useAuditSummary();
  const announcementsQuery = useAllAnnouncements();
  const jobsQuery = useSystemJobStatus();
  const maintenanceQuery = useMaintenanceStatus();

  // --- Data Processing ---
  const userResult = usersQuery.data || { total: 0, active_total: 0 };
  const auditSummary = (auditSummaryQuery.data ?? []) as AuditSummaryRow[];
  const announcements = announcementsQuery.data ?? [];

  const jobsData = (jobsQuery.data ?? {
    summary: { notifications: { pending: 0, processing: 0, failed: 0 } },
    jobs: [],
  }) as JobStatusResponse;

  const maintenanceData = maintenanceQuery.data as { enabled?: boolean } | undefined;

  // Derived State
  const accessReviewSummary = queueSummaryQuery.data?.summary ?? {
    open_count: 0,
    in_review_count: 0,
    resolved_count: 0,
    dismissed_count: 0,
  };
  const latestQueueItem = queueSummaryQuery.data?.rows?.[0];
  const openReviewCount = Number(accessReviewSummary.open_count ?? 0);
  const inReviewCount = Number(accessReviewSummary.in_review_count ?? 0);
  const resolvedReviewCount = Number(accessReviewSummary.resolved_count ?? 0);
  const reviewNeedsAction = openReviewCount + inReviewCount > 0;

  const totalAuditCount = auditSummary.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
  const totalUsers = Number(userResult.total ?? 0);
  const activeUsers = Number(userResult.active_total ?? 0);

  const pendingJobs =
    Number(jobsData.summary.notifications.pending ?? 0) +
    Number(jobsData.summary.notifications.processing ?? 0);
  const failedJobs = Number(jobsData.summary.notifications.failed ?? 0);

  const maintenanceEnabled = Boolean(maintenanceData?.enabled);
  const hasServiceFailure = jobsData.jobs.some((job) => job.status === 'FAILED');

  // Stats Configuration
  const stats: StatItem[] = useMemo(
    () => [
      {
        title: 'ผู้ใช้งานทั้งหมด',
        value: formatThaiNumber(totalUsers),
        description: `ใช้งานอยู่: ${formatThaiNumber(activeUsers)}`,
        icon: Users,
        href: '/admin/users',
        color: 'blue',
        trend: 'ข้อมูลล่าสุด',
        trendUp: true,
      },
      {
        title: 'คิวตรวจสิทธิ์',
        value: formatThaiNumber(openReviewCount),
        description: `ค้างตรวจ: ${formatThaiNumber(openReviewCount)} | กำลังตรวจ: ${formatThaiNumber(
          inReviewCount,
        )}`,
        icon: Shield,
        href: '/admin/access-review',
        color: reviewNeedsAction ? 'warning' : 'success',
        trend: reviewNeedsAction ? 'มีรายการต้องติดตาม' : 'ไม่มีคิวค้างตรวจ',
        trendUp: !reviewNeedsAction,
      },
      {
        title: 'บันทึกการใช้งาน',
        value: formatThaiNumber(totalAuditCount),
        description: 'กิจกรรมในระบบทั้งหมด',
        icon: FileText,
        href: '/admin/audit-logs',
        color: 'primary',
        trend: 'อัปเดตทันที',
        trendUp: true,
      },
      {
        title: 'งานระบบ',
        value: formatThaiNumber(pendingJobs),
        description: failedJobs > 0 ? `${failedJobs} รายการล้มเหลว` : 'งานที่ค้างในคิว',
        icon: Activity,
        href: '/admin/system',
        color: failedJobs > 0 ? 'destructive' : 'success',
        trend: hasServiceFailure ? 'บริการมีปัญหา' : 'บริการปกติ',
        trendUp: !hasServiceFailure && failedJobs === 0,
        showTrendIcon: true,
      },
    ],
    [
      totalUsers,
      activeUsers,
      openReviewCount,
      inReviewCount,
      reviewNeedsAction,
      totalAuditCount,
      pendingJobs,
      failedJobs,
      hasServiceFailure,
    ],
  );

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        description="ภาพรวมระบบ ความปลอดภัย และการจัดการผู้ใช้งาน"
      />

      {/* Stats Overview */}
      <StatCards stats={stats} />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* 1. System Health Status */}
        <DataTableCard
          title="สถานะระบบ"
          icon={Server}
          viewAllHref="/admin/system"
          className="lg:col-span-1 h-full"
        >
          <div className="divide-y divide-border/50 flex flex-col h-full">
            {/* Service Status */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'p-2 rounded-full',
                    hasServiceFailure ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
                  )}
                >
                  {hasServiceFailure ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">บริการหลัก</p>
                  <p className="text-xs text-muted-foreground">
                    {hasServiceFailure ? 'มีบางบริการขัดข้อง' : 'ทำงานปกติ'}
                  </p>
                </div>
              </div>
              <Badge
                variant={hasServiceFailure ? 'destructive' : 'outline'}
                className={
                  !hasServiceFailure ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''
                }
              >
                {hasServiceFailure ? 'เสื่อมประสิทธิภาพ' : 'ออนไลน์'}
              </Badge>
            </div>

            {/* Maintenance Mode */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'p-2 rounded-full',
                    maintenanceEnabled
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">โหมดปิดปรับปรุง</p>
                  <p className="text-xs text-muted-foreground">จำกัดการเข้าถึง</p>
                </div>
              </div>
              <Badge
                variant={maintenanceEnabled ? 'default' : 'secondary'}
                className={maintenanceEnabled ? 'bg-amber-500 hover:bg-amber-600' : ''}
              >
                {maintenanceEnabled ? 'เปิดใช้งาน' : 'ปิด'}
              </Badge>
            </div>

            {/* Job Queue - Refactored for cleaner look */}
            <div className="py-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-foreground">คิวงานระบบ</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {pendingJobs} รายการ
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex-1 border rounded-md p-2 flex flex-col items-center">
                  <span className="font-semibold text-amber-600 font-mono text-base">
                    {jobsData.summary.notifications.pending}
                  </span>
                  <span className="text-muted-foreground mt-0.5">รอ (Pending)</span>
                </div>
                <div className="flex-1 border rounded-md p-2 flex flex-col items-center">
                  <span className="font-semibold text-blue-600 font-mono text-base">
                    {jobsData.summary.notifications.processing}
                  </span>
                  <span className="text-muted-foreground mt-0.5">กำลังทำ (Proc.)</span>
                </div>
                <div className="flex-1 border rounded-md p-2 flex flex-col items-center">
                  <span
                    className={cn(
                      'font-semibold font-mono text-base',
                      failedJobs > 0 ? 'text-red-600' : 'text-muted-foreground',
                    )}
                  >
                    {failedJobs}
                  </span>
                  <span className="text-muted-foreground mt-0.5">ล้มเหลว (Failed)</span>
                </div>
              </div>
            </div>
          </div>
        </DataTableCard>

        {/* 2. Access Review Queue Summary */}
        <DataTableCard
          title="คิวตรวจสอบสิทธิ์"
          icon={Shield}
          viewAllHref="/admin/access-review"
          className="lg:col-span-1 h-full"
        >
          {queueSummaryQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <p className="text-sm">กำลังโหลดข้อมูลคิวตรวจสิทธิ์...</p>
            </div>
          ) : (
            <div className="flex flex-col h-full justify-between gap-4 py-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md border bg-amber-50/40 p-3">
                  <p className="text-muted-foreground">ค้างตรวจ</p>
                  <p className="mt-1 text-base font-semibold text-amber-700">
                    {formatThaiNumber(openReviewCount)}
                  </p>
                </div>
                <div className="rounded-md border bg-blue-50/40 p-3">
                  <p className="text-muted-foreground">กำลังตรวจ</p>
                  <p className="mt-1 text-base font-semibold text-blue-700">
                    {formatThaiNumber(inReviewCount)}
                  </p>
                </div>
                <div className="rounded-md border bg-emerald-50/40 p-3">
                  <p className="text-muted-foreground">ปิดแล้ว</p>
                  <p className="mt-1 text-base font-semibold text-emerald-700">
                    {formatThaiNumber(resolvedReviewCount)}
                  </p>
                </div>
              </div>

              {reviewNeedsAction ? (
                <div className="rounded-lg bg-amber-50/60 border border-amber-200 p-3 flex gap-3 items-start">
                  <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <p className="font-semibold">
                      มีคิวที่ต้องตัดสินใจ {formatThaiNumber(openReviewCount + inReviewCount)} รายการ
                    </p>
                    <p className="mt-0.5 text-amber-800/80">
                      {latestQueueItem?.last_detected_at
                        ? `ตรวจพบล่าสุด ${formatThaiDateTime(latestQueueItem.last_detected_at, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}${latestQueueItem.last_seen_batch_id ? ` (Batch #${latestQueueItem.last_seen_batch_id})` : ''}`
                        : 'กรุณาเข้าไปตรวจสอบและปิดคิวค้างในหน้าตรวจสอบสิทธิ์'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                  <Shield className="h-10 w-10 opacity-20 mb-3" />
                  <p className="text-sm">ไม่มีคิวค้างตรวจสิทธิ์ในตอนนี้</p>
                </div>
              )}
            </div>
          )}
        </DataTableCard>

        {/* 3. Announcements */}
        <DataTableCard
          title="ประกาศล่าสุด"
          icon={Megaphone}
          viewAllHref="/admin/announcements"
          className="lg:col-span-1 h-full"
        >
          <div className="flex flex-col h-full">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-12">
                <Inbox className="h-10 w-10 opacity-20 mb-3" />
                <p className="text-sm">ยังไม่มีรายการประกาศในระบบ</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {announcements.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-3.5 group">
                    <div
                      className={cn(
                        'mt-1.5 h-2 w-2 rounded-full shrink-0',
                        item.is_active
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                          : 'bg-muted-foreground/30',
                      )}
                    />
                    <div className="flex-1 space-y-1.5">
                      <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2 text-foreground">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1.5 font-normal bg-muted text-muted-foreground"
                        >
                          {item.is_active ? 'แสดงผล' : 'ฉบับร่าง'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {item.created_at
                            ? formatThaiDate(item.created_at, { day: 'numeric', month: 'short' })
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DataTableCard>
      </div>

      {/* Quick Actions */}
      <QuickActions actions={quickActions} />
    </div>
  );
}
