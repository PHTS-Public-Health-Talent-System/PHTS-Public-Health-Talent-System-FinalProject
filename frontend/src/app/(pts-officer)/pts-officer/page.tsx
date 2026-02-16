'use client';
export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import {
  FileCheck,
  Users,
  Calculator,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEligibilityList, usePendingApprovals } from '@/features/request/hooks';
import { useLicenseAlertsList, useLicenseAlertsSummary } from '@/features/license-alerts/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import { usePeriods } from '@/features/payroll/hooks';
import type { PayPeriod } from '@/features/payroll/api';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';

// --- Helpers & Types ---

const thaiMonths = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function formatPeriodLabel(period: PayPeriod | null) {
  if (!period) return '-';
  const monthName = thaiMonths[(period.period_month ?? 1) - 1] ?? '-';
  const yearNum = period.period_year ?? 0;
  const thaiYear = yearNum > 2400 ? yearNum : yearNum + 543;
  return `${monthName} ${thaiYear}`;
}

type LicenseAlertRow = {
  full_name?: string;
  license_expiry?: string | null;
  days_left?: number | null;
  profession_code?: string;
};

function parseSubmissionData(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
          รออนุมัติ
        </Badge>
      );
    case 'approved':
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
          อนุมัติแล้ว
        </Badge>
      );
    case 'returned':
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
          แก้ไข
        </Badge>
      );
    case 'rejected':
      return (
        <Badge
          variant="outline"
          className="bg-destructive/10 text-destructive border-destructive/20"
        >
          ไม่อนุมัติ
        </Badge>
      );
    default:
      return null;
  }
}

function mapRequestStatusForBadge(request: RequestWithDetails) {
  if (request.status === 'PENDING') return 'pending';
  if (request.status === 'APPROVED') return 'approved';
  if (request.status === 'RETURNED') return 'returned';
  if (request.status === 'REJECTED') return 'rejected';
  return 'pending';
}

// --- Components ---

type StatCardProps = {
  title: string;
  value: React.ReactNode;
  subtext?: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  href: string;
};

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, bgClass, href }: StatCardProps) => (
  <Link href={href} className="block transition-transform hover:-translate-y-1">
    <Card className="border-border shadow-sm hover:shadow-md cursor-pointer h-full">
      <CardContent className="p-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-3xl font-bold mt-2">{value}</div>
          {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${bgClass} ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default function DashboardPage() {
  const { data: approvalsData, isLoading: approvalsLoading } = usePendingApprovals();
  const { data: eligibilityData } = useEligibilityList(true);
  const { data: alertsData, isLoading: alertsLoading } = useLicenseAlertsList({
    bucket: '30',
    limit: 5,
  });
  const { data: alertsSummary } = useLicenseAlertsSummary();
  const { data: periodsData } = usePeriods();

  const latestPeriod = useMemo(() => {
    if (!Array.isArray(periodsData) || periodsData.length === 0) return null;
    const sorted = [...periodsData].sort((a, b) => {
      const yearDiff = (b.period_year ?? 0) - (a.period_year ?? 0);
      if (yearDiff !== 0) return yearDiff;
      return (b.period_month ?? 0) - (a.period_month ?? 0);
    });
    return sorted[0];
  }, [periodsData]);

  const approvals = useMemo<RequestWithDetails[]>(() => {
    if (!approvalsData || !Array.isArray(approvalsData)) return [];
    return approvalsData as RequestWithDetails[];
  }, [approvalsData]);

  const alertRows = useMemo<LicenseAlertRow[]>(() => {
    if (!alertsData || !Array.isArray(alertsData)) return [];
    return alertsData as LicenseAlertRow[];
  }, [alertsData]);

  const recentRequests = useMemo(() => {
    if (approvals.length === 0) return [];
    return approvals.slice(0, 5).map((req) => ({
      id: req.request_id,
      displayNo: req.request_no || String(req.request_id),
      name: (() => {
        const submission = parseSubmissionData(req.submission_data);
        const title = pickString(submission, ['title']);
        const firstName =
          req.requester?.first_name || pickString(submission, ['first_name', 'firstName']);
        const lastName =
          req.requester?.last_name || pickString(submission, ['last_name', 'lastName']);
        return [title, firstName, lastName].filter(Boolean).join(' ').trim() || '-';
      })(),
      position: (() => {
        const submission = parseSubmissionData(req.submission_data);
        return (
          req.requester?.position ||
          pickString(submission, ['position_name', 'positionName']) ||
          req.current_department ||
          '-'
        );
      })(),
      status: mapRequestStatusForBadge(req),
      amount: Number(req.requested_amount) || 0,
      date: req.created_at ? formatThaiDate(req.created_at) : '-',
    }));
  }, [approvals]);

  const alerts = useMemo(() => {
    if (alertRows.length === 0) return [];
    return alertRows.map((alert) => ({
      name: alert.full_name || '-',
      expiry: alert.license_expiry ? formatThaiDate(alert.license_expiry) : '-',
      daysLeft: alert.days_left ?? 0,
      profession: alert.profession_code || '-',
    }));
  }, [alertRows]);

  const isLoading = approvalsLoading || alertsLoading;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-20 w-1/3 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Derived Stats
  const pendingCount = approvals.filter((r) => r.status === 'PENDING').length;
  const allowanceCount = Array.isArray(eligibilityData) ? eligibilityData.length : 0;
  const periodLabel = formatPeriodLabel(latestPeriod);
  const expiringCount = (alertsSummary?.expiring_30 ?? 0) + (alertsSummary?.expired ?? 0);

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">แดชบอร์ด</h1>
        <p className="text-muted-foreground">ภาพรวมระบบและการแจ้งเตือนสำหรับเจ้าหน้าที่ พ.ต.ส.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="คำขอรออนุมัติ"
          value={pendingCount}
          subtext="รายการที่ต้องดำเนินการ"
          icon={FileCheck}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          href="/pts-officer/requests"
        />
        <StatCard
          title="ผู้มีสิทธิ์รับเงิน"
          value={allowanceCount}
          subtext="คน (รอบปัจจุบัน)"
          icon={Users}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
          href="/pts-officer/allowance-list"
        />
        <StatCard
          title="รอบจ่ายเงิน"
          value={latestPeriod?.status === 'OPEN' ? 'กำลังดำเนิน' : 'ปิดงวดแล้ว'}
          subtext={periodLabel}
          icon={Calculator}
          colorClass="text-purple-600"
          bgClass="bg-purple-50"
          href="/pts-officer/payroll"
        />
        <StatCard
          title="แจ้งเตือนใบอนุญาต"
          value={expiringCount}
          subtext="ใกล้หมด/หมดอายุ"
          icon={AlertTriangle}
          colorClass={expiringCount > 0 ? 'text-destructive' : 'text-amber-500'}
          bgClass={expiringCount > 0 ? 'bg-destructive/10' : 'bg-amber-50'}
          href="/pts-officer/alerts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Requests */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                คำขอล่าสุด
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/pts-officer/requests">ดูทั้งหมด</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-1">
                {recentRequests.length > 0 ? (
                  recentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 font-medium text-xs">
                          {req.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                            {req.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{req.position}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium tabular-nums">
                            {formatThaiNumber(req.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{req.date}</p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    ไม่มีรายการคำขอล่าสุด
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Alerts & Quick Links */}
        <div className="space-y-6">
          {/* Alerts Widget */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                แจ้งเตือนด่วน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.length > 0 ? (
                  alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-md bg-amber-500/5 border border-amber-200/50"
                    >
                      <div
                        className={`mt-0.5 h-2 w-2 rounded-full ${alert.daysLeft <= 0 ? 'bg-destructive' : 'bg-amber-500'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{alert.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ใบอนุญาตหมด: {alert.expiry} (
                          {alert.daysLeft > 0 ? `เหลือ ${alert.daysLeft} วัน` : 'หมดอายุแล้ว'})
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    ไม่พบการแจ้งเตือนวิกฤต
                  </div>
                )}
                <Button variant="outline" className="w-full text-xs h-8" asChild>
                  <Link href="/pts-officer/alerts">ดูรายการแจ้งเตือนทั้งหมด</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/pts-officer/payroll"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2"
            >
              <Calculator className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">คำนวณเงิน</span>
            </Link>
            <Link
              href="/pts-officer/allowance-list"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2"
            >
              <Users className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">รายชื่อผู้มีสิทธิ์</span>
            </Link>
            <Link
              href="/pts-officer/reports"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2"
            >
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">รายงานสรุป</span>
            </Link>
            <Link
              href="/pts-officer/settings"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2"
            >
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">ตั้งค่าระบบ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
