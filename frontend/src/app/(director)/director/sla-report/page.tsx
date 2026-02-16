'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ShieldAlert,
  Target,
  Timer,
  Activity,
  FileBarChart,
  type LucideIcon,
} from 'lucide-react';
import {
  usePendingWithSla,
  useSlaConfigs,
  useSlaKpiBacklogAging,
  useSlaKpiByStep,
  useSlaKpiDataQuality,
  useSlaKpiError,
  useSlaKpiOverview,
} from '@/features/sla/hooks';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

// --- Types ---

type SlaConfig = {
  step_no: number;
  role_name: string;
  sla_days: number;
};

type PendingSlaItem = {
  request_id: number;
  request_no: string;
  citizen_id: string;
  first_name?: string | null;
  last_name?: string | null;
  current_step: number;
  step_started_at: string;
  business_days_elapsed: number;
  sla_days: number;
  is_approaching_sla: boolean;
  is_overdue: boolean;
  days_until_sla: number;
  days_overdue: number;
};

type StepKpiRow = {
  step: number;
  role: string;
  total: number;
  median_days: number;
  p90_days: number;
  on_time_rate: number;
};

type BacklogAging = {
  buckets?: Array<{ bucket: string; count: number }>;
};

type KpiOverview = {
  on_time_completion_rate?: number;
  median_lead_time_days?: number;
  throughput_closed?: number;
  rework_rate?: number;
  overdue_backlog_count?: number;
};

type KpiError = {
  error_rate?: number;
  first_pass_yield?: number;
  return_rate?: number;
  rejection_rate?: number;
};

type KpiDataQuality = {
  closed_without_submit?: number;
  closed_without_actions?: number;
  step_missing_enter?: number;
  step_negative_duration?: number;
};

// --- Constants & Helpers ---

const stepLabels: Record<number, string> = {
  1: 'หัวหน้าตึก/หัวหน้างาน',
  2: 'หัวหน้ากลุ่มงาน',
  3: 'เจ้าหน้าที่ พ.ต.ส.',
  4: 'หัวหน้ากลุ่มงานทรัพยากรบุคคล',
  5: 'หัวหน้าการเงิน',
  6: 'ผู้อำนวยการ',
};

function gradeBadge(percentage: number) {
  if (percentage >= 95)
    return {
      label: 'A+ ยอดเยี่ยม',
      className: 'text-emerald-700 border-emerald-200 bg-emerald-50',
    };
  if (percentage >= 85)
    return { label: 'A ดีมาก', className: 'text-blue-700 border-blue-200 bg-blue-50' };
  if (percentage >= 75)
    return { label: 'B ดี', className: 'text-cyan-700 border-cyan-200 bg-cyan-50' };
  if (percentage >= 60)
    return { label: 'C พอใช้', className: 'text-amber-700 border-amber-200 bg-amber-50' };
  return {
    label: 'F ต้องปรับปรุง',
    className: 'text-destructive border-destructive/30 bg-destructive/10',
  };
}

function statusTone(onTimeRate: number) {
  if (onTimeRate >= 90) return 'text-emerald-600';
  if (onTimeRate >= 75) return 'text-amber-600';
  return 'text-destructive';
}

// Progress Card Component
function ProgressCard({
  title,
  value,
  description,
  icon: Icon,
  toneClass = 'text-primary',
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  toneClass?: string;
}) {
  return (
    <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div
            className={`rounded-xl p-2.5 ${toneClass.replace('text-', 'bg-').replace('text-', 'bg-').split(' ')[0]}/10`}
          >
            <Icon className={`h-5 w-5 ${toneClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DirectorSlaReportPage() {
  const [range, setRange] = useState('current');

  const rangeDates = useMemo(() => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (range === 'last30') {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
    } else if (range === 'last90') {
      start = new Date(now);
      start.setDate(start.getDate() - 90);
    } else if (range === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    }
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const toDate = (value: Date) => value.toISOString().slice(0, 10);
    return { start: toDate(start), end: toDate(end) };
  }, [range]);

  const pendingQuery = usePendingWithSla(rangeDates);
  const configsQuery = useSlaConfigs();
  const kpiOverviewQuery = useSlaKpiOverview(rangeDates);
  const kpiByStepQuery = useSlaKpiByStep(rangeDates);
  const kpiBacklogAgingQuery = useSlaKpiBacklogAging({ as_of: rangeDates.end });
  const kpiDataQualityQuery = useSlaKpiDataQuality(rangeDates);
  const kpiErrorQuery = useSlaKpiError(rangeDates);

  const pendingItems = useMemo(
    () => (pendingQuery.data ?? []) as PendingSlaItem[],
    [pendingQuery.data],
  );
  const configs = useMemo(() => (configsQuery.data ?? []) as SlaConfig[], [configsQuery.data]);
  const overview = (kpiOverviewQuery.data ?? {}) as KpiOverview;
  const byStepRows = useMemo(
    () => ((kpiByStepQuery.data as { rows?: unknown } | undefined)?.rows ?? []) as StepKpiRow[],
    [kpiByStepQuery.data],
  );
  const backlogAging = (kpiBacklogAgingQuery.data ?? {}) as BacklogAging;
  const dataQuality = (kpiDataQualityQuery.data ?? {}) as KpiDataQuality;
  const errorKpi = (kpiErrorQuery.data ?? {}) as KpiError;

  const configMap = useMemo(() => {
    const map = new Map<number, SlaConfig>();
    for (const config of configs) {
      map.set(config.step_no, config);
    }
    return map;
  }, [configs]);

  const directorQueue = useMemo(
    () => pendingItems.filter((item) => item.current_step === 6),
    [pendingItems],
  );

  const directorCritical = useMemo(
    () =>
      [...directorQueue]
        .filter((item) => item.is_overdue || item.is_approaching_sla)
        .sort(
          (a, b) =>
            b.days_overdue - a.days_overdue || b.business_days_elapsed - a.business_days_elapsed,
        )
        .slice(0, 8),
    [directorQueue],
  );

  const stepKpis = useMemo(
    () =>
      Object.entries(stepLabels).map(([step, label]) => {
        const stepNo = Number(step);
        const row = byStepRows.find((item) => item.step === stepNo);
        return {
          step: stepNo,
          label,
          targetDays: configMap.get(stepNo)?.sla_days ?? 0,
          medianDays: Number(row?.median_days ?? 0),
          p90Days: Number(row?.p90_days ?? 0),
          onTimeRate: Number(row?.on_time_rate ?? 0),
          total: Number(row?.total ?? 0),
        };
      }),
    [byStepRows, configMap],
  );

  const stepWithData = stepKpis.filter((item) => item.total > 0);
  const bestStep = stepWithData.length
    ? [...stepWithData].sort((a, b) => b.onTimeRate - a.onTimeRate)[0]
    : null;
  const worstStep = stepWithData.length
    ? [...stepWithData].sort((a, b) => a.onTimeRate - b.onTimeRate)[0]
    : null;

  const onTimeRate = Number(overview.on_time_completion_rate ?? 0);
  const grade = gradeBadge(onTimeRate);
  const overdueBacklog = Number(
    overview.overdue_backlog_count ?? pendingItems.filter((item) => item.is_overdue).length,
  );
  const backlogBuckets = backlogAging.buckets ?? [];
  const backlogTotal = backlogBuckets.reduce((sum, item) => sum + Number(item.count ?? 0), 0);

  const isLoading =
    pendingQuery.isLoading ||
    configsQuery.isLoading ||
    kpiOverviewQuery.isLoading ||
    kpiByStepQuery.isLoading ||
    kpiBacklogAgingQuery.isLoading ||
    kpiDataQualityQuery.isLoading ||
    kpiErrorQuery.isLoading;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">แดชบอร์ดผู้บริหาร</h1>
          <p className="mt-1 text-muted-foreground">
            ภาพรวมประสิทธิภาพระบบอนุมัติ พ.ต.ส. และความเสี่ยงที่ต้องจับตามอง
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[180px] bg-background shadow-sm">
            <SelectValue placeholder="เลือกช่วงเวลา" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">เดือนปัจจุบัน</SelectItem>
            <SelectItem value="last30">30 วันล่าสุด</SelectItem>
            <SelectItem value="last90">90 วันล่าสุด</SelectItem>
            <SelectItem value="year">ทั้งปี</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {/* Overall Score Card */}
        <Card className="border-border shadow-sm xl:col-span-1 relative overflow-hidden bg-gradient-to-br from-background to-secondary/20">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  คะแนนประสิทธิภาพ
                </p>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-end gap-3 mt-1">
                <span className="text-4xl font-bold text-foreground">{onTimeRate.toFixed(0)}%</span>
                <span className="text-sm text-muted-foreground mb-1.5">ตรงเวลา</span>
              </div>
            </div>
            <div>
              <Progress value={onTimeRate} className="h-1.5 bg-secondary mb-3" />
              <Badge
                variant="outline"
                className={`font-normal w-full justify-center ${grade.className}`}
              >
                {grade.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <ProgressCard
          title="งานรออนุมัติ (ผู้บริหาร)"
          value={formatThaiNumber(directorQueue.length)}
          description="เฉพาะขั้นผู้อำนวยการ"
          icon={Clock3}
          toneClass="text-blue-600"
        />
        <ProgressCard
          title="ความเสี่ยง (เกินกำหนด)"
          value={formatThaiNumber(overdueBacklog)}
          description="รายการที่เกินกำหนดเวลาทั้งระบบ"
          icon={ShieldAlert}
          toneClass="text-destructive"
        />
        <ProgressCard
          title="ผ่านตั้งแต่ครั้งแรก"
          value={`${Number(errorKpi.first_pass_yield ?? 0).toFixed(1)}%`}
          description="อนุมัติผ่านในครั้งเดียว"
          icon={Target}
          toneClass="text-emerald-600"
        />
        <ProgressCard
          title="อัตราคำขอผิดพลาด"
          value={`${Number(errorKpi.error_rate ?? 0).toFixed(1)}%`}
          description="ต้องแก้ไข / ตีกลับ"
          icon={CircleAlert}
          toneClass="text-amber-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Critical Items List */}
        <Card className="border-border shadow-sm lg:col-span-2 flex flex-col h-full">
          <CardHeader className="border-b bg-muted/10 py-4 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-full text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    รายการเร่งด่วน (ผู้บริหาร)
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    งานในคิวผู้อำนวยการที่ใกล้ครบกำหนดหรือเกินกำหนด
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-normal">
                {directorCritical.length} รายการ
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            {directorCritical.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-500/20 mb-4" />
                <p className="font-medium text-foreground">ไม่มีรายการเร่งด่วน</p>
                <p className="text-sm">งานทั้งหมดอยู่ในสถานะปกติ</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0">
                  <TableRow>
                    <TableHead className="w-[120px]">เลขที่คำขอ</TableHead>
                    <TableHead>ผู้ยื่นคำขอ</TableHead>
                    <TableHead className="text-center">รอมาแล้ว</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-right w-[100px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directorCritical.map((item) => {
                    const fullName =
                      `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || '-';
                    return (
                      <TableRow key={item.request_id} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-xs">{item.request_no}</TableCell>
                        <TableCell className="font-medium text-sm">{fullName}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {item.business_days_elapsed}/{item.sla_days} วันทำการ
                        </TableCell>
                        <TableCell className="text-center">
                          {item.is_overdue ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px] h-5 px-1.5 font-normal"
                            >
                              +{item.days_overdue} วัน
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] h-5 px-1.5 font-normal"
                            >
                              ใกล้ครบกำหนด
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={`/director/requests/${item.request_id}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Data Quality & Backlog Health */}
        <Card className="border-border shadow-sm flex flex-col h-full">
          <CardHeader className="border-b bg-muted/10 py-4 px-6">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              คุณภาพของระบบ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Backlog Aging */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">อายุงานค้าง</p>
                <span className="text-xs text-muted-foreground">{backlogTotal} รายการ</span>
              </div>
              <div className="space-y-3">
                {backlogBuckets.map((bucket) => {
                  const count = Number(bucket.count ?? 0);
                  const ratio = backlogTotal > 0 ? (count / backlogTotal) * 100 : 0;
                  return (
                    <div key={bucket.bucket}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{bucket.bucket} วัน</span>
                        <span className="font-medium text-foreground">{count}</span>
                      </div>
                      <Progress value={ratio} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-dashed my-2"></div>

            {/* Data Quality Indicators */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-muted-foreground" />
                ความสมบูรณ์ของข้อมูล
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border bg-background p-2.5">
                  <p className="text-muted-foreground mb-1">งานที่ขาดการดำเนินการ</p>
                  <p
                    className={`text-lg font-bold ${dataQuality.closed_without_actions ? 'text-destructive' : 'text-foreground'}`}
                  >
                    {Number(dataQuality.closed_without_actions ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-2.5">
                  <p className="text-muted-foreground mb-1">ระยะเวลาติดลบ</p>
                  <p
                    className={`text-lg font-bold ${dataQuality.step_negative_duration ? 'text-destructive' : 'text-foreground'}`}
                  >
                    {Number(dataQuality.step_negative_duration ?? 0)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 text-center">
                *ข้อมูลที่ไม่สมบูรณ์อาจส่งผลต่อความแม่นยำของรายงาน KPI
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table: Step Performance */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Timer className="h-5 w-5 text-muted-foreground" />
                ประสิทธิภาพรายขั้นตอน
              </CardTitle>
              <CardDescription className="mt-1">
                วิเคราะห์ระยะเวลาดำเนินการจริงเทียบกับเป้าหมายกำหนดเวลา ในแต่ละขั้นตอน
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[50px] text-center text-xs uppercase text-muted-foreground font-semibold">
                    ขั้นตอน
                  </TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-semibold">
                    ขั้นตอนการทำงาน
                  </TableHead>
                  <TableHead className="text-center text-xs uppercase text-muted-foreground font-semibold">
                    เป้าหมาย (วัน)
                  </TableHead>
                  <TableHead className="text-center text-xs uppercase text-muted-foreground font-semibold">
                    ค่ามัธยฐาน (วัน)
                  </TableHead>
                  <TableHead className="text-center text-xs uppercase text-muted-foreground font-semibold">
                    P90 (วัน)
                  </TableHead>
                  <TableHead className="text-center text-xs uppercase text-muted-foreground font-semibold">
                    ตรงเวลา %
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase text-muted-foreground font-semibold">
                    ปริมาณงาน
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stepKpis.map((row) => (
                  <TableRow key={row.step} className="hover:bg-muted/20">
                    <TableCell className="text-center font-medium text-muted-foreground">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs">
                        {row.step}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.label}</TableCell>
                    <TableCell className="text-center text-sm">{row.targetDays}</TableCell>
                    <TableCell className="text-center text-sm">
                      <span
                        className={
                          row.medianDays > row.targetDays ? 'text-destructive font-medium' : ''
                        }
                      >
                        {row.medianDays.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {row.p90Days.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`font-normal ${statusTone(row.onTimeRate)} bg-background`}
                      >
                        {row.onTimeRate.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatThaiNumber(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 border-t bg-muted/5 p-4 text-sm md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border bg-background p-3 shadow-sm">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                ผลงานดีที่สุด
              </span>
              <span className="font-semibold text-emerald-600">
                {bestStep ? `${bestStep.label} (${bestStep.onTimeRate.toFixed(0)}%)` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3 shadow-sm">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                คอขวดกระบวนการ
              </span>
              <span className="font-semibold text-destructive">
                {worstStep ? `${worstStep.label} (${worstStep.onTimeRate.toFixed(0)}%)` : '-'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
