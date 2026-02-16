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
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCards, type StatItem } from '@/components/stat-cards';
import { DataTableCard } from '@/components/data-table-card';
import { QuickActions } from '@/components/quick-actions';
import { useMaintenanceStatus, useSearchUsers, useSystemJobStatus } from '@/features/system/hooks';
import { useAccessReviewCycles } from '@/features/access-review/hooks';
import { useAuditSummary } from '@/features/audit/hooks';
import { useAllAnnouncements } from '@/features/announcement/hooks';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';

// --- Types ---
type AuditSummaryRow = { event_type: string; count: number };
type AccessCycle = {
  cycle_id: number;
  status: string;
  due_date: string;
  total_users: number;
  reviewed_users: number;
};

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
  const cyclesQuery = useAccessReviewCycles();
  const auditSummaryQuery = useAuditSummary();
  const announcementsQuery = useAllAnnouncements();
  const jobsQuery = useSystemJobStatus();
  const maintenanceQuery = useMaintenanceStatus();

  // --- Data Processing ---
  const userResult = usersQuery.data || { total: 0, active_total: 0 };
  const cycles = (cyclesQuery.data ?? []) as AccessCycle[];
  const auditSummary = (auditSummaryQuery.data ?? []) as AuditSummaryRow[];
  const announcements = announcementsQuery.data ?? [];

  const jobsData = (jobsQuery.data ?? {
    summary: { notifications: { pending: 0, processing: 0, failed: 0 } },
    jobs: [],
  }) as JobStatusResponse;

  const maintenanceData = maintenanceQuery.data as { enabled?: boolean } | undefined;

  // Derived State
  const activeCycle = cycles[0];
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
        title: 'ทบทวนสิทธิ์',
        value: activeCycle
          ? `${Math.round((activeCycle.reviewed_users / (activeCycle.total_users || 1)) * 100)}%`
          : 'ไม่มีข้อมูล',
        description: activeCycle ? `รอบที่ #${activeCycle.cycle_id}` : 'ไม่มีรอบตรวจสอบ',
        icon: Shield,
        href: '/admin/access-review',
        color: activeCycle ? 'warning' : 'primary',
        trend: activeCycle?.due_date
          ? `ครบกำหนด ${formatThaiDate(activeCycle.due_date)}`
          : '-',
        trendUp: false,
      },
      {
        title: 'บันทึกการใช้งาน',
        value: formatThaiNumber(totalAuditCount),
        description: 'กิจกรรมในระบบ',
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
      activeCycle,
      totalAuditCount,
      pendingJobs,
      failedJobs,
      hasServiceFailure,
    ],
  );

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <PageHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        description="ภาพรวมระบบ ความปลอดภัย และการจัดการผู้ใช้งาน"
      />

      {/* Stats Overview */}
      <StatCards stats={stats} />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 1. System Health Status */}
        <DataTableCard
          title="สถานะระบบ"
          icon={Server}
          viewAllHref="/admin/system"
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            {/* Service Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${hasServiceFailure ? 'bg-red-100' : 'bg-emerald-100'}`}
                >
                  {hasServiceFailure ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">สถานะบริการหลัก</p>
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
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${maintenanceEnabled ? 'bg-amber-100' : 'bg-secondary'}`}
                >
                  <Settings
                    className={`h-4 w-4 ${maintenanceEnabled ? 'text-amber-600' : 'text-muted-foreground'}`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">โหมดปิดปรับปรุง</p>
                  <p className="text-xs text-muted-foreground">ปิดปรับปรุงระบบ</p>
                </div>
              </div>
              <Badge variant={maintenanceEnabled ? 'default' : 'secondary'}>
                {maintenanceEnabled ? 'เปิดใช้งาน' : 'ปิด'}
              </Badge>
            </div>

            {/* Job Queue */}
            <div className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">สถานะคิวงานระบบ</span>
                <span className="font-medium">{pendingJobs} รายการ</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-secondary/50 p-1.5 rounded">
                  <span className="block font-bold text-amber-600">
                    {jobsData.summary.notifications.pending}
                  </span>
                  <span className="text-muted-foreground">รอ</span>
                </div>
                <div className="bg-secondary/50 p-1.5 rounded">
                  <span className="block font-bold text-blue-600">
                    {jobsData.summary.notifications.processing}
                  </span>
                  <span className="text-muted-foreground">กำลังทำ</span>
                </div>
                <div className="bg-secondary/50 p-1.5 rounded">
                  <span className="block font-bold text-red-600">
                    {jobsData.summary.notifications.failed}
                  </span>
                  <span className="text-muted-foreground">ล้มเหลว</span>
                </div>
              </div>
            </div>
          </div>
        </DataTableCard>

        {/* 2. Access Review Status */}
        <DataTableCard
          title="รอบการตรวจสอบสิทธิ์"
          icon={Shield}
          viewAllHref="/admin/access-review"
          className="lg:col-span-1"
        >
          {activeCycle ? (
            <div className="flex flex-col h-full justify-center space-y-6 py-2">
              <div className="text-center">
                <Badge
                  variant="outline"
                  className="mb-2 bg-primary/5 text-primary border-primary/20"
                >
                  รอบที่: {activeCycle.cycle_id}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  ครบกำหนด:{' '}
                  {formatThaiDate(activeCycle.due_date, { dateStyle: 'medium' })}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>ความคืบหน้า</span>
                  <span className="font-medium">
                    {activeCycle.reviewed_users} / {activeCycle.total_users} คน
                  </span>
                </div>
                <Progress
                  value={(activeCycle.reviewed_users / (activeCycle.total_users || 1)) * 100}
                  className="h-2"
                />
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex gap-3 items-start">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-semibold">สถานะ: {activeCycle.status}</p>
                  <p className="mt-1">กรุณาติดตามหัวหน้างานให้ดำเนินการก่อนวันครบกำหนด</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Shield className="h-12 w-12 opacity-20 mb-2" />
              <p>ขณะนี้ไม่มีรอบการตรวจสอบที่เปิดอยู่</p>
            </div>
          )}
        </DataTableCard>

        {/* 3. Announcements */}
        <DataTableCard
          title="ประกาศล่าสุด"
          icon={Megaphone}
          viewAllHref="/admin/announcements"
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            {announcements.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-start gap-3 group">
                <div
                  className={`mt-1 h-2 w-2 rounded-full shrink-0 ${item.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal">
                      {item.is_active ? 'กำลังแสดง' : 'ฉบับร่าง'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.created_at ? formatThaiDate(item.created_at) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                ยังไม่มีรายการประกาศ
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
