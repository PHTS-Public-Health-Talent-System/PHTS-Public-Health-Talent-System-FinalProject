'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Banknote,
  FileSignature,
  FileCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePendingApprovals } from '@/features/request/hooks';
import { usePendingWithSla, useSlaKpiOverview } from '@/features/sla/hooks';
import { usePeriods } from '@/features/payroll/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import type { PayPeriod } from '@/features/payroll/api';
import {
  formatThaiDate,
  formatThaiMonthYear,
  formatThaiNumber,
} from '@/shared/utils/thai-locale';

type PendingItem = {
  id: number;
  displayId: string;
  name: string;
  position: string;
  department: string;
  amount: number;
  date: string;
  slaStatus: 'normal' | 'warning' | 'danger';
};

type PendingSlaItem = {
  request_id: number;
  is_approaching_sla: boolean;
  is_overdue: boolean;
};

const formatMoney = (amount: number) => `${formatThaiNumber(amount)} บาท`;

const formatDate = (value?: string | Date | null) => formatThaiDate(value);

const parseSubmission = (value: RequestWithDetails['submission_data']) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
};

const textFromSubmission = (submission: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = submission[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

type StatCardProps = {
  title: string;
  value: number;
  subtext: string;
  href: string;
  colorClass: string;
  bgClass: string;
  icon: typeof FileSignature;
};

const StatCard = ({ title, value, subtext, href, colorClass, bgClass, icon: Icon }: StatCardProps) => (
  <Link href={href} className="block transition-transform hover:-translate-y-1">
    <Card className="h-full cursor-pointer border-border shadow-sm hover:shadow-md">
      <CardContent className="flex items-start justify-between p-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-2 text-3xl font-bold">{value}</div>
          <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
        </div>
        <div className={`rounded-xl p-3 ${bgClass} ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default function DirectorDashboardPage() {
  const pendingQuery = usePendingApprovals();
  const pendingSlaQuery = usePendingWithSla();
  const periodsQuery = usePeriods();

  const currentMonthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const toDate = (value: Date) => value.toISOString().slice(0, 10);
    return { from: toDate(start), to: toDate(end) };
  }, []);
  const kpiOverviewQuery = useSlaKpiOverview({ from: currentMonthRange.from, to: currentMonthRange.to });

  const slaMap = useMemo(() => {
    const map = new Map<number, PendingSlaItem>();
    const rows = (pendingSlaQuery.data ?? []) as PendingSlaItem[];
    for (const row of rows) {
      map.set(row.request_id, row);
    }
    return map;
  }, [pendingSlaQuery.data]);

  const pendingRequests = useMemo<PendingItem[]>(() => {
    const rows = (pendingQuery.data ?? []) as RequestWithDetails[];
    return rows
      .filter((request) => request.current_step === 6)
      .map((request) => {
        const submission = parseSubmission(request.submission_data);
        const firstName = textFromSubmission(submission, ['first_name', 'firstName']);
        const lastName = textFromSubmission(submission, ['last_name', 'lastName']);
        const position = textFromSubmission(submission, ['position_name', 'positionName']) || '-';
        const department =
          textFromSubmission(submission, ['sub_department', 'subDepartment', 'department']) ||
          request.current_department ||
          '-';
        const name = `${firstName} ${lastName}`.trim() || request.citizen_id;
        const sla = slaMap.get(request.request_id);
        const slaStatus: PendingItem['slaStatus'] = sla?.is_overdue
          ? 'danger'
          : sla?.is_approaching_sla
            ? 'warning'
            : 'normal';
        return {
          id: request.request_id,
          displayId: request.request_no ?? `REQ-${request.request_id}`,
          name,
          position,
          department,
          amount: Number(request.requested_amount ?? 0),
          date: formatDate(request.created_at),
          slaStatus,
        };
      })
      .sort((a, b) => b.id - a.id);
  }, [pendingQuery.data, slaMap]);

  const pendingPayrolls = useMemo(() => {
    const periods = (periodsQuery.data ?? []) as PayPeriod[];
    return periods
      .filter((period) => period.status === 'WAITING_DIRECTOR')
      .slice(0, 4)
      .map((period) => ({
        id: period.period_id,
        month: formatThaiMonthYear(period.period_month, period.period_year),
        totalAmount: Number(period.total_amount ?? 0),
        totalPersons: Number(period.total_headcount ?? 0),
      }));
  }, [periodsQuery.data]);

  const stats = useMemo(() => {
    const slaOverdue = pendingRequests.filter((item) => item.slaStatus === 'danger').length;
    const approvedMonth = Number(
      ((kpiOverviewQuery.data as { throughput_closed?: number } | undefined)?.throughput_closed ?? 0),
    );
    return {
      pendingRequests: pendingRequests.length,
      pendingPayrolls: pendingPayrolls.length,
      slaOverdue,
      approvedMonth,
    };
  }, [kpiOverviewQuery.data, pendingPayrolls.length, pendingRequests]);

  const isLoading =
    pendingQuery.isLoading ||
    pendingSlaQuery.isLoading ||
    periodsQuery.isLoading ||
    kpiOverviewQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="h-20 w-1/3 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">แดชบอร์ด (ผู้บริหาร)</h1>
        <p className="text-muted-foreground">
          ภาพรวมคำขอและรอบจ่ายเงินที่รออนุมัติขั้นสุดท้ายของผู้บริหาร
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="คำขอรออนุมัติ"
          value={stats.pendingRequests}
          subtext="รอลงนามผู้บริหาร"
          icon={FileSignature}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          href="/director/requests"
        />
        <StatCard
          title="รอบจ่ายรออนุมัติ"
          value={stats.pendingPayrolls}
          subtext="รอตัดสินใจรอบจ่าย"
          icon={Calculator}
          colorClass="text-purple-600"
          bgClass="bg-purple-50"
          href="/director/payroll"
        />
        <StatCard
          title="เกินกำหนดเวลา"
          value={stats.slaOverdue}
          subtext="อยู่ในคิวผู้บริหาร"
          icon={AlertTriangle}
          colorClass="text-destructive"
          bgClass="bg-destructive/10"
          href="/director/requests?status=overdue"
        />
        <StatCard
          title="ปิดงานเดือนนี้"
          value={stats.approvedMonth}
          subtext="จากตัวชี้วัดการปิดงาน"
          icon={TrendingUp}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
          href="/director/sla-report"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="flex h-full flex-col border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="h-5 w-5 text-muted-foreground" />
                คำขอล่าสุดที่รออนุมัติ
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/director/requests">ดูทั้งหมด</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="divide-y divide-border/50">
                {pendingRequests.length > 0 ? (
                  pendingRequests.slice(0, 5).map((request) => (
                    <Link
                      key={request.id}
                      href={`/director/requests/${request.id}`}
                      className="group flex items-center justify-between p-4 transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground transition-colors group-hover:bg-background">
                            {request.displayId}
                          </span>
                          {request.slaStatus === 'danger' && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                              เกินกำหนด
                            </Badge>
                          )}
                          {request.slaStatus === 'warning' && (
                            <Badge
                              variant="outline"
                              className="h-5 border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700"
                            >
                              เตือนใกล้เกินกำหนดเวลา
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {request.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {request.position} • {request.department}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums text-sm font-semibold text-foreground">
                          {formatMoney(request.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{request.date}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    ไม่มีรายการรออนุมัติ
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden border-border shadow-sm">
            <CardHeader className="border-b bg-secondary/20 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Banknote className="h-5 w-5 text-purple-600" />
                รอบจ่ายรออนุมัติ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {pendingPayrolls.length > 0 ? (
                  pendingPayrolls.map((payroll) => (
                    <Link
                      key={payroll.id}
                      href={`/director/payroll/${payroll.id}`}
                      className="block p-4 transition-colors hover:bg-secondary/40"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-foreground">{payroll.month}</span>
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-[10px] text-amber-700"
                        >
                          รออนุมัติ
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{formatThaiNumber(payroll.totalPersons)} รายการ</span>
                        <span className="font-medium text-foreground">
                          {formatMoney(payroll.totalAmount)}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">ไม่พบรอบจ่ายค้าง</div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/director/requests"
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-secondary/50"
            >
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 transition-colors group-hover:bg-blue-200">
                <FileCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">อนุมัติคำขอ</span>
            </Link>
            <Link
              href="/director/payroll"
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-secondary/50"
            >
              <div className="rounded-full bg-purple-100 p-2 text-purple-600 transition-colors group-hover:bg-purple-200">
                <Calculator className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">อนุมัติรอบจ่าย</span>
            </Link>
            <Link
              href="/director/sla-report"
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-secondary/50"
            >
              <div className="rounded-full bg-amber-100 p-2 text-amber-600 transition-colors group-hover:bg-amber-200">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">รายงานกำหนดเวลา</span>
            </Link>
            <Link
              href="/director/requests?batch=true"
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-secondary/50"
            >
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 transition-colors group-hover:bg-emerald-200">
                <CheckCircle className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">อนุมัติแบบกลุ่ม</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
