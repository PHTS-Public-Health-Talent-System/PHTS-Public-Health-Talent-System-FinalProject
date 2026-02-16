'use client';

import {
  FileCheck,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  UserCheck,
  Banknote,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHeadHrDashboard } from '@/features/dashboard/hooks';
import type {
  HeadHrPendingPayroll,
  HeadHrPendingRequest,
  HeadHrDashboardStats,
} from '@/features/dashboard/api';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

// --- Helper Functions ---

const formatMoney = (amount: number) => `${formatThaiNumber(amount)} บาท`;

// --- Components ---

type StatCardProps = {
  title: string;
  value: number;
  subtext: string;
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

export default function HeadHRDashboardPage() {
  const { data: dashboard, isLoading } = useHeadHrDashboard();

  const pendingRequests: HeadHrPendingRequest[] = dashboard?.pending_requests ?? [];
  const pendingPayrolls: HeadHrPendingPayroll[] = dashboard?.pending_payrolls ?? [];
  const statsData: HeadHrDashboardStats = dashboard?.stats ?? {
    pending_requests: 0,
    pending_payrolls: 0,
    approved_month: 0,
    sla_overdue: 0,
  };

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

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">แดชบอร์ด (หัวหน้า HR)</h1>
        <p className="text-muted-foreground">ภาพรวมคำขอและรอบจ่ายเงินที่รอการอนุมัติ</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="คำขอรออนุมัติ"
          value={statsData.pending_requests}
          subtext="ต้องตรวจสอบ"
          icon={FileCheck}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          href="/head-hr/requests"
        />
        <StatCard
          title="รอบจ่ายรออนุมัติ"
          value={statsData.pending_payrolls}
          subtext="รอบเดือนปัจจุบัน"
          icon={Calculator}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          href="/head-hr/payroll"
        />
        <StatCard
          title="อนุมัติแล้ว (เดือนนี้)"
          value={statsData.approved_month}
          subtext="คำขอที่อนุมัติแล้ว"
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
          href="/head-hr/requests?status=approved"
        />
        <StatCard
          title="เกินกำหนดเวลา"
          value={statsData.sla_overdue}
          subtext="คำขอที่ล่าช้า"
          icon={AlertTriangle}
          colorClass="text-destructive"
          bgClass="bg-destructive/10"
          href="/head-hr/requests?status=overdue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Pending Requests */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                คำขอล่าสุดที่รออนุมัติ
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/head-hr/requests">ดูทั้งหมด</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="divide-y divide-border/50">
                {pendingRequests.length > 0 ? (
                  pendingRequests.map((request) => (
                    <Link
                      key={request.id}
                      href={`/head-hr/requests/${request.id}`}
                      className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors group"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded group-hover:bg-background transition-colors">
                            {request.id}
                          </span>
                          {request.sla_status === 'danger' && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                              เกินกำหนด
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                          {request.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{request.position}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm tabular-nums text-foreground">
                          {formatMoney(request.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{request.date}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    ไม่มีรายการรออนุมัติ
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Payrolls & Quick Actions */}
        <div className="space-y-6">
          {/* Pending Payrolls Widget */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-secondary/20 border-b">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Banknote className="h-5 w-5 text-blue-600" />
                รอบจ่ายรออนุมัติ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {pendingPayrolls.length > 0 ? (
                  pendingPayrolls.map((payroll) => (
                    <Link
                      key={payroll.id}
                      href={`/head-hr/payroll/${payroll.id}`}
                      className="block p-4 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-foreground">{payroll.month}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-200 text-amber-700 bg-amber-50"
                        >
                          รออนุมัติ
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{payroll.totalPersons} รายการ</span>
                        <span className="font-medium text-foreground">
                          {formatMoney(payroll.totalAmount)}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    ไม่พบรอบจ่ายค้าง
                  </div>
                )}
              </div>
              {pendingPayrolls.length > 0 && (
                <div className="p-2 bg-muted/10 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs h-8" asChild>
                    <Link href="/head-hr/payroll">จัดการรอบจ่ายทั้งหมด</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/head-hr/requests"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2 group"
            >
              <div className="p-2 rounded-full bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors">
                <UserCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">อนุมัติคำขอ</span>
            </Link>
            <Link
              href="/head-hr/payroll"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2 group"
            >
              <div className="p-2 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
                <Calculator className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">อนุมัติรอบจ่าย</span>
            </Link>
            <Link
              href="/head-hr/sla-report"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2 group"
            >
              <div className="p-2 rounded-full bg-purple-100 text-purple-600 group-hover:bg-purple-200 transition-colors">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">รายงานกำหนดเวลา</span>
            </Link>
            <Link
              href="/head-hr/reports"
              className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2 group"
            >
              <div className="p-2 rounded-full bg-slate-100 text-slate-600 group-hover:bg-slate-200 transition-colors">
                <ArrowRight className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">รายงานอื่นๆ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
