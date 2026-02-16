'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Clock,
  CheckCircle2,
  TrendingUp,
  Download,
  CreditCard,
  Coins,
  Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/page-header';
import { DataTableCard } from '@/components/data-table-card';
import { QuickActions } from '@/components/quick-actions';
import { useFinanceDashboard } from '@/features/finance/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  formatThaiCurrency,
  formatThaiMonthYear,
  formatThaiNumber,
  toBuddhistYear,
} from '@/shared/utils/thai-locale';

type FinanceSummary = {
  period_id: number;
  period_month: number;
  period_year: number;
  period_status: string;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
};

type FinanceYearly = {
  period_year: number;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
};

type FinanceDashboard = {
  currentMonth: FinanceSummary | null;
  yearToDate: FinanceYearly | null;
  recentPeriods: FinanceSummary[];
};

type StatCardProps = {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  href: string;
};

const quickActions = [
  { label: 'จัดการจ่ายเงิน', href: '/finance-officer/payouts', icon: CreditCard },
  { label: 'สรุปรายปี', href: '/finance-officer/yearly-summary', icon: TrendingUp },
  { label: 'ดาวน์โหลดรายงาน', href: '/finance-officer/reports', icon: Download },
];

const toPeriodCode = (month: number, year: number) => {
  return `PAY-${String(month).padStart(2, '0')}/${toBuddhistYear(year)}`;
};

// Helper Component for Stats
const StatCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  colorClass,
  bgClass,
  href,
}: StatCardProps) => (
  <Link href={href} className="block transition-transform hover:-translate-y-1">
    <Card className="border-border h-full cursor-pointer shadow-sm hover:shadow-md">
      <CardContent className="flex items-start justify-between p-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</div>
          {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
        </div>
        <div
          className={`rounded-xl p-3 ${bgClass} ${colorClass.replace('text-', 'bg-').replace('text-', 'bg-').split(' ')[0]}/10`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default function FinanceOfficerDashboardPage() {
  const { data, isLoading } = useFinanceDashboard();

  const dashboard = useMemo<FinanceDashboard>(() => {
    if (!data || typeof data !== 'object') {
      return { currentMonth: null, yearToDate: null, recentPeriods: [] };
    }
    const payload = data as Partial<FinanceDashboard>;
    return {
      currentMonth: payload.currentMonth ?? null,
      yearToDate: payload.yearToDate ?? null,
      recentPeriods: Array.isArray(payload.recentPeriods) ? payload.recentPeriods : [],
    };
  }, [data]);

  const current = dashboard.currentMonth;
  const yearToDate = dashboard.yearToDate;
  const recentPeriods = dashboard.recentPeriods.slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
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
    <div className="space-y-8 p-6 pb-20 lg:p-8">
      <PageHeader
        title="แดชบอร์ด (การเงิน)"
        description="ภาพรวมสถานะการจ่ายเงิน พ.ต.ส. และยอดคงค้าง"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="ยอดคงค้าง (เดือนล่าสุด)"
          value={formatThaiCurrency(Number(current?.pending_amount ?? 0))}
          subtext={`${current?.pending_count ?? 0} รายการที่ต้องจ่าย`}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          href={
            current ? `/finance-officer/payouts/${current.period_id}` : '/finance-officer/payouts'
          }
        />
        <StatCard
          title="จ่ายแล้ว (เดือนล่าสุด)"
          value={formatThaiCurrency(Number(current?.paid_amount ?? 0))}
          subtext={`${current?.paid_count ?? 0} รายการที่โอนแล้ว`}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
          href={
            current ? `/finance-officer/payouts/${current.period_id}` : '/finance-officer/payouts'
          }
        />
        <StatCard
          title="ยอดรวมทั้งปี (สะสมถึงปัจจุบัน)"
          value={`${(Number(yearToDate?.total_amount ?? 0) / 1_000_000).toFixed(2)}M`}
          subtext={`ปีงบประมาณ ${yearToDate ? toBuddhistYear(yearToDate.period_year) : '-'}`}
          icon={Coins}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          href="/finance-officer/yearly-summary"
        />
        <StatCard
          title="คงค้างสะสมทั้งปี"
          value={formatThaiCurrency(Number(yearToDate?.pending_amount ?? 0))}
          subtext="รวมทุกเดือนที่ยังไม่จ่าย"
          icon={Wallet}
          colorClass="text-destructive"
          bgClass="bg-destructive/10"
          href="/finance-officer/yearly-summary"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataTableCard
            title="รอบการจ่ายเงินล่าสุด"
            viewAllHref="/finance-officer/payouts"
            action={
              <Button size="sm" variant="ghost" asChild className="h-8 text-xs">
                <Link href="/finance-officer/payouts">ดูทั้งหมด</Link>
              </Button>
            }
          >
            <div className="divide-y divide-border/50">
              {recentPeriods.length > 0 ? (
                recentPeriods.map((period) => {
                  const hasPending = Number(period.pending_amount ?? 0) > 0;
                  return (
                    <Link
                      key={period.period_id}
                      href={`/finance-officer/payouts/${period.period_id}`}
                      className="group flex items-center justify-between p-4 transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors group-hover:bg-background">
                            {toPeriodCode(period.period_month, period.period_year)}
                          </span>
                          {hasPending ? (
                            <Badge
                              variant="outline"
                              className="h-5 border-amber-200 bg-amber-50 px-1.5 text-[10px] font-normal text-amber-700"
                            >
                              รอดำเนินการจ่าย
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="h-5 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-normal text-emerald-700"
                            >
                              จ่ายครบแล้ว
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {formatThaiMonthYear(period.period_month, period.period_year)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          ผู้รับเงิน {formatThaiNumber(Number(period.total_employees ?? 0))} คน
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-sm text-foreground">
                          {formatThaiCurrency(Number(period.total_amount ?? 0))}
                        </p>
                        {hasPending && (
                          <p className="mt-0.5 text-[10px] text-destructive">
                            ค้างจ่าย {formatThaiCurrency(Number(period.pending_amount))}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  ไม่พบข้อมูลรอบจ่าย
                </div>
              )}
            </div>
          </DataTableCard>
        </div>

        <div className="space-y-6">
          <Card className="border-border bg-card flex h-full flex-col shadow-sm">
            <CardContent className="flex flex-1 flex-col justify-center p-6">
              <div className="mb-6 text-center">
                <div className="mb-3 inline-flex rounded-full bg-primary/10 p-3 text-primary">
                  <Banknote className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-semibold">
                  สรุปภาพรวมปี {yearToDate ? toBuddhistYear(yearToDate.period_year) : '-'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">ข้อมูลสะสมตั้งแต่ต้นปีงบประมาณ</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-dashed border-border/50 pb-2 text-sm">
                  <span className="text-muted-foreground">ยอดอนุมัติรวม</span>
                  <span className="font-medium">
                    {formatThaiCurrency(Number(yearToDate?.total_amount ?? 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-border/50 pb-2 text-sm">
                  <span className="font-medium text-emerald-600">เบิกจ่ายแล้ว</span>
                  <span className="font-bold text-emerald-600">
                    {formatThaiCurrency(Number(yearToDate?.paid_amount ?? 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-destructive">คงเหลือเบิกจ่าย</span>
                  <span className="font-bold text-destructive">
                    {formatThaiCurrency(Number(yearToDate?.pending_amount ?? 0))}
                  </span>
                </div>
              </div>

              <div className="mt-8">
                <Button className="w-full" asChild>
                  <Link href="/finance-officer/yearly-summary">ดูรายงานฉบับเต็ม</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <QuickActions actions={quickActions} />
      </div>
    </div>
  );
}
