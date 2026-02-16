'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // ต้องมี Input component
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Banknote, BriefcaseMedical, Search, LayoutGrid, ArrowRight, type LucideIcon } from 'lucide-react';
import { useEligibilitySummary } from '@/features/request/hooks';
import { resolveProfessionLabel } from './utils';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';

export default function AllowanceListPage() {
  const { data: summary, isLoading } = useEligibilitySummary(true);
  const [searchTerm, setSearchTerm] = useState('');

  const professionSummaries = useMemo(() => {
    const rows = summary?.by_profession ?? [];
    return rows
      .map((row) => ({
        code: row.profession_code,
        label: resolveProfessionLabel(row.profession_code, row.profession_code),
        count: row.people_count,
        amount: row.total_rate_amount,
      }))
      .sort((a, b) => b.count - a.count);
  }, [summary?.by_profession]);

  const filteredProfessions = useMemo(() => {
    if (!searchTerm) return professionSummaries;
    const lowerTerm = searchTerm.toLowerCase();
    return professionSummaries.filter(
      (p) => p.label.toLowerCase().includes(lowerTerm) || p.code.toLowerCase().includes(lowerTerm),
    );
  }, [professionSummaries, searchTerm]);

  const totalPeople = summary?.total_people ?? 0;
  const totalAmount = summary?.total_rate_amount ?? 0;
  const updatedAt = summary?.updated_at
    ? formatThaiDateTime(summary.updated_at)
    : null;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            ตรวจสอบสิทธิ์ค่าตอบแทน
          </h1>
          <p className="mt-2 text-muted-foreground">
            เลือกวิชาชีพที่ต้องการตรวจสอบรายชื่อและสถานะผู้มีสิทธิ์ (พ.ต.ส.)
          </p>
          {updatedAt && (
            <div className="mt-2 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              อัปเดตล่าสุด: {updatedAt}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="ผู้มีสิทธิ์ทั้งหมด"
          value={`${formatThaiNumber(totalPeople)} คน`}
          icon={Users}
          className="bg-blue-50/50 border-blue-100"
          iconColor="text-blue-600"
        />
        <SummaryCard
          title="ยอดรวม/เดือน"
          value={`${formatThaiNumber(totalAmount)} บาท`}
          icon={Banknote}
          className="bg-emerald-50/50 border-emerald-100"
          iconColor="text-emerald-600"
        />
        <SummaryCard
          title="จำนวนวิชาชีพ"
          value={`${professionSummaries.length} สาขา`}
          icon={BriefcaseMedical}
          className="bg-purple-50/50 border-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-muted-foreground" />
            รายการวิชาชีพ
          </h2>
          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหาวิชาชีพ..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* "ALL" Card - Highlighted */}
          {!searchTerm && (
            <Link
              href="/pts-officer/allowance-list/profession/all"
              className="group relative flex flex-col justify-between rounded-xl border-2 border-primary/20 bg-primary/5 p-5 transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    Overview
                  </span>
                  <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-lg font-bold text-foreground">ทุกวิชาชีพ (รวม)</p>
              </div>
              <div className="mt-4 pt-4 border-t border-primary/10 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">รวมทั้งหมด</span>
                <span className="font-semibold text-primary">
                  {formatThaiNumber(totalPeople)} คน
                </span>
              </div>
            </Link>
          )}

          {/* Profession List */}
          {filteredProfessions.map((profession) => (
            <Link
              key={profession.code}
              href={`/pts-officer/allowance-list/profession/${profession.code}`}
              className="group flex flex-col justify-between rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                    {profession.code}
                  </Badge>
                  <Badge variant="secondary" className="bg-secondary/50">
                    {profession.count} คน
                  </Badge>
                </div>
                <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {profession.label}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-dashed flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ยอดรวม</span>
                <span className="font-medium tabular-nums">
                  {formatThaiNumber(profession.amount)}
                  <span className="text-xs text-muted-foreground ml-1">บ.</span>
                </span>
              </div>
            </Link>
          ))}

          {filteredProfessions.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
              ไม่พบวิชาชีพที่ค้นหา &quot;{searchTerm}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

type SummaryCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  className?: string;
  iconColor?: string;
};

function SummaryCard({ title, value, icon: Icon, className, iconColor }: SummaryCardProps) {
  return (
    <Card className={`border-none shadow-sm ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={`p-3 rounded-full bg-white/60 ${iconColor ?? ''}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-[300px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
