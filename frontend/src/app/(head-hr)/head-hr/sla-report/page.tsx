'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  BarChart3,
  Trophy,
  Activity,
  Target,
  Timer,
  FileX,
  RefreshCcw,
  Undo2,
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
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDate as formatThaiDateValue } from '@/shared/utils/thai-locale';

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

type StepStat = {
  step: number;
  label: string;
  targetDays: number;
  avgDays: number;
  p90Days: number;
  onTime: number;
  total: number;
  pending: number;
};

// --- Constants ---

const stepLabels: Record<number, string> = {
  1: 'หัวหน้าตึก/หัวหน้างาน',
  2: 'หัวหน้ากลุ่มงาน',
  3: 'เจ้าหน้าที่ พ.ต.ส.',
  4: 'หัวหน้ากลุ่มงานทรัพยากรบุคคล',
  5: 'หัวหน้าการเงิน',
  6: 'ผู้อำนวยการ',
};

// --- Helpers ---

const formatDate = (value?: string | null) => {
  return formatThaiDateValue(value);
};

function getStatusColor(onTime: number) {
  if (onTime >= 95) return 'text-emerald-600';
  if (onTime >= 80) return 'text-blue-600';
  if (onTime >= 60) return 'text-amber-600';
  return 'text-destructive';
}

function getProgressColor(onTime: number) {
  if (onTime >= 95) return 'bg-emerald-500';
  if (onTime >= 80) return 'bg-blue-500';
  if (onTime >= 60) return 'bg-amber-500';
  return 'bg-destructive';
}

function calculateGrade(percentage: number) {
  if (percentage >= 95)
    return {
      grade: 'A+',
      label: 'ยอดเยี่ยม',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    };
  if (percentage >= 85)
    return { grade: 'A', label: 'ดีมาก', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  if (percentage >= 75)
    return { grade: 'B', label: 'ดี', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' };
  if (percentage >= 60)
    return { grade: 'C', label: 'พอใช้', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  return {
    grade: 'F',
    label: 'ต้องปรับปรุง',
    color: 'text-destructive bg-destructive/10 border-destructive/20',
  };
}

export default function HeadHRSLAReportPage() {
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
    const toDateStr = (value: Date) => value.toISOString().slice(0, 10);
    return { start: toDateStr(start), end: toDateStr(end) };
  }, [range]);

  const pendingQuery = usePendingWithSla(rangeDates);
  const configsQuery = useSlaConfigs();
  const kpiOverviewQuery = useSlaKpiOverview(rangeDates);
  const kpiByStepQuery = useSlaKpiByStep(rangeDates);
  const kpiBacklogAgingQuery = useSlaKpiBacklogAging({ as_of: rangeDates.end });
  const kpiDataQualityQuery = useSlaKpiDataQuality(rangeDates);
  const kpiErrorQuery = useSlaKpiError(rangeDates);

  const configMap = useMemo(() => {
    const configs = (configsQuery.data ?? []) as SlaConfig[];
    const map = new Map<number, SlaConfig>();
    configs.forEach((config) => map.set(config.step_no, config));
    return map;
  }, [configsQuery.data]);

  const pendingItems = (pendingQuery.data ?? []) as PendingSlaItem[];
  const filteredPending = pendingItems;

  const slaSteps = useMemo<StepStat[]>(() => {
    const rows = ((kpiByStepQuery.data as { rows?: Array<Record<string, unknown>> } | undefined)
      ?.rows ?? []) as Array<{
      step: number;
      role: string;
      total: number;
      median_days: number;
      p90_days: number;
      on_time_rate: number;
    }>;
    return Object.entries(stepLabels).map(([stepKey, fallbackLabel]) => {
      const step = Number(stepKey);
      const row = rows.find((item) => item.step === step);
      const config = configMap.get(step);
      return {
        step,
        label: fallbackLabel || row?.role || `Step ${step}`,
        targetDays: config?.sla_days ?? 0,
        avgDays: Number(row?.median_days ?? 0),
        p90Days: Number(row?.p90_days ?? 0),
        onTime: Number(row?.on_time_rate ?? 0),
        total: Number(row?.total ?? 0),
        pending: Number(row?.total ?? 0),
      };
    });
  }, [configMap, kpiByStepQuery.data]);

  const totalPending = filteredPending.length;
  const kpiOverview = (kpiOverviewQuery.data ?? {}) as {
    on_time_completion_rate?: number;
    median_lead_time_days?: number;
    throughput_closed?: number;
    rework_rate?: number;
    overdue_backlog_count?: number;
  };
  const backlogAging = (kpiBacklogAgingQuery.data ?? {}) as {
    buckets?: Array<{ bucket: string; count: number }>;
  };
  const dataQuality = (kpiDataQualityQuery.data ?? {}) as {
    closed_without_submit?: number;
    closed_without_actions?: number;
    step_missing_enter?: number;
    step_negative_duration?: number;
  };
  const kpiError = (kpiErrorQuery.data ?? {}) as {
    error_rate?: number;
    first_pass_yield?: number;
    return_rate?: number;
    rejection_rate?: number;
    top_categories?: Array<{ category: string; count: number; ratio: number }>;
    by_step?: Array<{ step: number; role: string; error_count: number }>;
  };
  const overdueCount =
    typeof kpiOverview.overdue_backlog_count === 'number'
      ? kpiOverview.overdue_backlog_count
      : filteredPending.filter((item) => item.is_overdue).length;
  const overallOnTime = Number(kpiOverview.on_time_completion_rate ?? 0);

  // KPI Calculations
  const kpiGrade = calculateGrade(overallOnTime);
  const worstStep = [...slaSteps].sort((a, b) => a.onTime - b.onTime)[0];
  const bestStep = [...slaSteps].sort((a, b) => b.onTime - a.onTime)[0];

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
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">รายงานตัวชี้วัดและกำหนดเวลา</h1>
          <p className="text-muted-foreground mt-1">
            วิเคราะห์ประสิทธิภาพ (Efficiency) และคุณภาพ (Quality) ของกระบวนการอนุมัติ
          </p>
        </div>
        <div>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[180px] bg-background">
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
      </div>

      {/* KPI Highlights: Health / Workload / Bottleneck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Overall Health */}
        <Card className="border-border shadow-sm relative overflow-hidden">
          <div className={`absolute top-0 right-0 p-3 opacity-10`}>
            <Trophy className={`w-24 h-24 ${kpiGrade.color.split(' ')[0]}`} />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> ประสิทธิภาพรวม (Efficiency)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className={`text-5xl font-bold ${kpiGrade.color.split(' ')[0]}`}>
                {kpiGrade.grade}
              </div>
              <div className="mb-2">
                <Badge variant="outline" className={`font-normal ${kpiGrade.color}`}>
                  {kpiGrade.label}
                </Badge>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">สำเร็จตามกำหนดเวลา</span>
                <span className="font-medium">{overallOnTime}%</span>
              </div>
              <Progress
                value={overallOnTime}
                className={`h-2 ${getProgressColor(overallOnTime).replace('bg-', 'text-')}`}
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. Workload & Speed */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> ปริมาณงาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{totalPending}</div>
                <p className="text-xs text-muted-foreground">รายการรออนุมัติ</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">{overdueCount}</div>
                <p className="text-xs text-muted-foreground">เกินกำหนดเวลา</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="w-4 h-4" />
              <span>ระยะเวลาดำเนินการเฉลี่ย: </span>
              <span className="font-semibold text-foreground">
                {Number(kpiOverview.median_lead_time_days ?? 0).toFixed(1)} วัน
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground flex justify-between">
              <span>ปิดงานแล้ว: {Number(kpiOverview.throughput_closed ?? 0)}</span>
              <span>ต้องแก้งาน: {Number(kpiOverview.rework_rate ?? 0)}%</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Bottleneck */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" /> จุดที่ต้องปรับปรุง
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {worstStep ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">ช้าที่สุด:</span>
                  <span className="font-semibold text-destructive text-right truncate w-32">
                    {worstStep.label}
                  </span>
                </div>
                <Progress value={worstStep.onTime} className="h-2 bg-destructive/20" />
                <p className="text-xs text-muted-foreground text-right">
                  ตรงเวลา: {worstStep.onTime}%
                </p>
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                ข้อมูลไม่เพียงพอ
              </div>
            )}

            {bestStep && bestStep.step !== worstStep?.step && (
              <div className="pt-2 border-t border-border/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">เร็วที่สุด:</span>
                  <span className="font-semibold text-emerald-600 text-right truncate w-32">
                    {bestStep.label}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality & Errors Section (New) */}
      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            คุณภาพข้อมูลและความผิดพลาด
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">ผ่านตั้งแต่ครั้งแรก</p>
              <p className="text-2xl font-bold text-emerald-600">
                {Number(kpiError.first_pass_yield ?? 0)}%
              </p>
              <p className="text-xs text-muted-foreground">ผ่านในครั้งเดียว</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">อัตราส่งกลับ</p>
              <p className="text-2xl font-bold text-amber-600">
                {Number(kpiError.return_rate ?? 0)}%
              </p>
              <p className="text-xs text-muted-foreground">ถูกส่งกลับแก้ไข</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">อัตราปฏิเสธ</p>
              <p className="text-2xl font-bold text-destructive">
                {Number(kpiError.rejection_rate ?? 0)}%
              </p>
              <p className="text-xs text-muted-foreground">ถูกปฏิเสธคำขอ</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">อัตราความผิดพลาดรวม</p>
              <p className="text-2xl font-bold text-foreground">
                {Number(kpiError.error_rate ?? 0)}%
              </p>
              <p className="text-xs text-muted-foreground">อัตราความผิดพลาดรวม</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Error Categories */}
            <div className="rounded-xl border bg-background p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileX className="w-4 h-4 text-destructive" /> สาเหตุความผิดพลาดสูงสุด
              </h4>
              {(kpiError.top_categories ?? []).length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  ไม่พบข้อมูลความผิดพลาด
                </div>
              ) : (
                <div className="space-y-3">
                  {(kpiError.top_categories ?? []).slice(0, 5).map((row) => (
                    <div key={row.category} className="flex items-center justify-between text-sm">
                      <span
                        className="text-muted-foreground truncate max-w-[200px]"
                        title={row.category}
                      >
                        {row.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-destructive"
                            style={{ width: `${row.ratio}%` }}
                          />
                        </div>
                        <span className="font-medium text-xs w-8 text-right">{row.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Errors by Step */}
            <div className="rounded-xl border bg-background p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-amber-600" /> ขั้นตอนที่มีการแก้ไขบ่อย
              </h4>
              {(kpiError.by_step ?? []).length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">ไม่พบข้อมูล</div>
              ) : (
                <div className="space-y-3">
                  {(kpiError.by_step ?? []).map((row) => (
                    <div
                      key={`${row.step}-${row.role}`}
                      className="flex items-center justify-between text-sm border-b border-dashed border-border/50 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-muted-foreground">
                        ขั้นตอน {row.step}: {stepLabels[row.step] || row.role}
                      </span>
                      <Badge variant="secondary" className="font-normal">
                        {row.error_count} ครั้ง
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SLA Detail Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            ประสิทธิภาพรายขั้นตอน
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/5">
                <TableHead className="w-[50px] text-center">ขั้นตอน</TableHead>
                <TableHead>ขั้นตอนการทำงาน</TableHead>
                <TableHead className="text-center">เป้าหมายกำหนดเวลา</TableHead>
                <TableHead className="text-center">เวลาเฉลี่ย</TableHead>
                <TableHead className="text-center">ค่าร้อยละ 90</TableHead>
                <TableHead className="text-right">จำนวนงาน</TableHead>
                <TableHead className="text-right">ประสิทธิภาพ (ตรงเวลา)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slaSteps.map((step) => (
                <TableRow key={step.step} className="hover:bg-muted/20">
                  <TableCell className="text-center font-medium text-muted-foreground">
                    {step.step}
                  </TableCell>
                  <TableCell className="font-medium">{step.label}</TableCell>
                  <TableCell className="text-center text-sm">{step.targetDays} วัน</TableCell>
                  <TableCell className="text-center text-sm">
                    <span
                      className={
                        step.avgDays > step.targetDays
                          ? 'text-destructive font-semibold'
                          : 'text-emerald-600'
                      }
                    >
                      {step.avgDays.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {step.p90Days.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {step.total}{' '}
                    <span className="text-xs text-muted-foreground">(รอ {step.pending})</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${getStatusColor(step.onTime)}`}>
                      {step.onTime}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(step.onTime)}`}
                        style={{ width: `${step.onTime}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Critical Items Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            รายการที่ต้องเร่งดำเนินการ (Critical List)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-auto max-h-[400px]">
            {filteredPending.filter((i) => i.is_overdue || i.is_approaching_sla).length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                ยอดเยี่ยม! ไม่มีรายการที่เกินกำหนดหรือต้องเฝ้าระวัง
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-background sticky top-0">
                  <TableRow>
                    <TableHead className="w-[120px]">รหัสคำขอ</TableHead>
                    <TableHead>ชื่อ-สกุล</TableHead>
                    <TableHead>ขั้นตอนปัจจุบัน</TableHead>
                    <TableHead className="text-center">วันที่เริ่ม</TableHead>
                    <TableHead className="text-center">ใช้เวลา</TableHead>
                    <TableHead className="text-right">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPending
                    .filter((i) => i.is_overdue || i.is_approaching_sla)
                    .sort((a, b) => b.business_days_elapsed - a.business_days_elapsed)
                    .map((item) => (
                      <TableRow key={item.request_id} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-sm">{item.request_no}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {[item.first_name, item.last_name].filter(Boolean).join(' ')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {stepLabels[item.current_step]}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatDate(item.step_started_at)}
                        </TableCell>
                        <TableCell className="text-center text-sm font-semibold">
                          {item.business_days_elapsed} วัน
                        </TableCell>
                        <TableCell className="text-right">
                          {item.is_overdue ? (
                            <Badge variant="destructive" className="text-[10px]">
                              เกินกำหนด {Math.abs(item.days_overdue)} วัน
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-amber-200 text-amber-700 bg-amber-50"
                            >
                              เหลือ {item.days_until_sla} วัน
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="border-t px-4 py-2 bg-muted/20">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span>
                Aging Backlog:{' '}
                {(backlogAging.buckets ?? []).map((b) => `${b.bucket}วัน(${b.count})`).join(' | ')}
              </span>
              <span className="flex items-center gap-1">
                <Undo2 className="w-3 h-3" /> Closed w/o submit:{' '}
                {Number(dataQuality.closed_without_submit ?? 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
