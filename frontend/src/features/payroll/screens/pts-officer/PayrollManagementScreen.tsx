'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Send,
  Calendar,
  Users,
  Banknote,
  AlertCircle,
  ChevronRight,
  Calculator,
  CheckCircle2,
  ArrowRight,
  Circle,
} from 'lucide-react';
import { ThaiYearPicker } from '@/components/thai-date-field';
import { ConfirmActionDialog } from '@/components/common';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { usePeriodReadiness } from '@/features/snapshot/hooks';
import {
  useCalculatePeriod,
  useCreatePeriod,
  useDeletePeriod,
  usePeriodPayouts,
  usePeriods,
  useSubmitToHR,
} from '@/features/payroll/hooks';
import type { PayPeriod, PeriodPayoutRow } from '@/features/payroll/api';
import { getSnapshotStatusUi, normalizeSnapshotStatus } from '@/features/payroll/domain/snapshot';
import { usePayrollReviewProgress } from '@/features/payroll/hooks';
import { normalizeProfessionCode, resolveProfessionLabel } from '@/shared/constants/profession';
import { formatThaiNumber, toBuddhistYear } from '@/shared/utils/thai-locale';
import {
  asPayPeriodStatus,
  formatThaiDate,
  getThaiMonthName,
  PAY_PERIOD_STATUS_CONFIG,
  PAY_PERIOD_STATUS_STEPS,
} from '@/features/payroll/domain';
import { cn } from '@/lib/utils';

// ... (Types and Helper functions remain unchanged)
type PayPeriodUiModel = {
  id: string;
  label: string;
  month: string;
  year: string;
  status: ReturnType<typeof asPayPeriodStatus>;
  totalPersons: number;
  totalAmount: number;
  createdAt: string;
  snapshotStatus: string;
};

function toAdYear(yearNum: number): number {
  return yearNum > 2400 ? yearNum - 543 : yearNum;
}

function toPayPeriodUiModel(period: PayPeriod): PayPeriodUiModel {
  const monthName = getThaiMonthName(period.period_month ?? 1);
  const yearNum = period.period_year ?? 0;
  const thaiYear = formatThaiNumber(toBuddhistYear(yearNum), { useGrouping: false });
  return {
    id: String(period.period_id),
    label: `${monthName} ${thaiYear}`,
    month: monthName,
    year: String(thaiYear),
    status: asPayPeriodStatus(period.status),
    totalPersons: Number(period.total_headcount ?? 0),
    totalAmount: Number(period.total_amount ?? 0),
    createdAt: formatThaiDate(period.created_at ?? undefined),
    snapshotStatus: String(period.snapshot_status ?? ''),
  };
}

export function PayrollManagementScreen() {
  const periodsQuery = usePeriods();
  const createPeriod = useCreatePeriod();
  const calculatePeriod = useCalculatePeriod();
  const submitToHR = useSubmitToHR();
  const deletePeriod = useDeletePeriod();

  const currentBuddhistYear = new Date().getFullYear() + 543;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createMonth, setCreateMonth] = useState('01');
  const [createYear, setCreateYear] = useState(currentBuddhistYear);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const periods = useMemo<PayPeriodUiModel[]>(() => {
    const data = (periodsQuery.data ?? []) as PayPeriod[];
    return [...data]
      .sort((a, b) => {
        const yearDiff = toAdYear(b.period_year ?? 0) - toAdYear(a.period_year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return (b.period_month ?? 0) - (a.period_month ?? 0);
      })
      .map((period) => toPayPeriodUiModel(period));
  }, [periodsQuery.data]);

  const currentPeriod = useMemo(() => {
    if (!periods.length) return null;
    if (!selectedPeriodId) return periods[0];
    return periods.find((period) => period.id === selectedPeriodId) ?? periods[0];
  }, [periods, selectedPeriodId]);

  const { data: payoutsData } = usePeriodPayouts(currentPeriod?.id);
  const readinessQuery = usePeriodReadiness(currentPeriod?.id);
  const { reviewedCodes } = usePayrollReviewProgress(currentPeriod?.id ?? '');
  const readiness = (readinessQuery.data ?? {}) as {
    is_ready?: boolean;
    snapshot_status?: string;
    snapshot_ready_at?: string | null;
  };
  const effectiveSnapshotStatus = normalizeSnapshotStatus(
    readiness.snapshot_status ?? currentPeriod?.snapshotStatus,
  );
  const snapshotUi = getSnapshotStatusUi(effectiveSnapshotStatus);
  const professionProgress = useMemo(() => {
    const rows = (payoutsData ?? []) as PeriodPayoutRow[];
    const totals = new Map<string, { label: string; count: number; amount: number }>();
    rows.forEach((row) => {
      const code = normalizeProfessionCode(row.profession_code);
      if (!code) return;
      const current = totals.get(code) ?? {
        label: resolveProfessionLabel(code, code),
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += Number(row.total_payable ?? 0);
      totals.set(code, current);
    });

    const reviewedSet = new Set((reviewedCodes ?? []).map((item) => normalizeProfessionCode(item)));
    const items = Array.from(totals.entries())
      .map(([code, data]) => ({
        code,
        label: data.label,
        count: data.count,
        amount: data.amount,
        reviewed: reviewedSet.has(code),
      }))
      .sort((a, b) => {
        // Sort: Unreviewed first, then by name
        if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1;
        return a.label.localeCompare(b.label, 'th');
      });

    return {
      items,
      total: items.length,
      reviewed: items.filter((item) => item.reviewed).length,
    };
  }, [payoutsData, reviewedCodes]);

  const canSubmit =
    !!currentPeriod &&
    currentPeriod.status === 'OPEN' &&
    professionProgress.total > 0 &&
    professionProgress.total === professionProgress.reviewed;

  const currentStepIndex = useMemo(() => {
    if (!currentPeriod) return 0;
    return PAY_PERIOD_STATUS_STEPS.findIndex((step) => step.id === currentPeriod.status);
  }, [currentPeriod]);

  // ... (Handlers remain unchanged)
  const handleCreatePeriod = async () => {
    const year = createYear > 2400 ? createYear - 543 : createYear;
    const month = Number.parseInt(createMonth);
    try {
      await createPeriod.mutateAsync({ year, month });
      toast.success('สร้างรอบจ่ายเงินเรียบร้อย');
      setIsCreateDialogOpen(false);
      periodsQuery.refetch();
    } catch {
      toast.error('ไม่สามารถสร้างรอบจ่ายเงินได้');
    }
  };

  const handleCalculate = async () => {
    if (!currentPeriod) return;
    try {
      await calculatePeriod.mutateAsync(currentPeriod.id);
      toast.success('คำนวณรอบเรียบร้อย');
      periodsQuery.refetch();
    } catch {
      toast.error('ไม่สามารถคำนวณรอบได้');
    }
  };

  const handleSubmitToHR = async () => {
    if (!currentPeriod) return;
    if (!canSubmit) {
      toast.error('ต้องยืนยันตรวจครบทุกวิชาชีพก่อนส่ง HR');
      return;
    }
    try {
      await submitToHR.mutateAsync(currentPeriod.id);
      toast.success('ส่งให้ HR อนุมัติเรียบร้อย');
      periodsQuery.refetch();
    } catch (error) {
      const apiError = error as AxiosError<{ error?: string }>;
      const message = apiError.response?.data?.error ?? 'ไม่สามารถส่งให้ HR อนุมัติได้';
      toast.error(message);
    }
  };

  const handleDeletePeriod = async () => {
    if (!currentPeriod) return;
    try {
      await deletePeriod.mutateAsync(currentPeriod.id);
      toast.success('ลบรอบจ่ายเงินเรียบร้อย');
      setSelectedPeriodId('');
      periodsQuery.refetch();
    } catch (error) {
      const apiError = error as AxiosError<{ error?: string }>;
      const message = apiError.response?.data?.error ?? 'ไม่สามารถลบรอบจ่ายเงินได้';
      toast.error(message);
    }
  };

  // UX Fix: Loading State
  if (periodsQuery.isLoading) {
    return (
      <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="col-span-2 h-96" />
          <Skeleton className="col-span-1 h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* 1. Header & Context Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-5 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการรอบจ่ายเงิน</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            คำนวณ ตรวจสอบ และตั้งเบิกค่าตอบแทนพิเศษ (พ.ต.ส.) ประจำเดือน
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider ml-1">
              รอบที่กำลังทำงาน
            </label>
            <Select
              value={currentPeriod?.id ?? ''}
              onValueChange={(value) => setSelectedPeriodId(value)}
            >
              <SelectTrigger className="w-[220px] bg-background">
                <Calendar className="mr-2 h-4 w-4 text-primary" />
                <SelectValue placeholder="เลือกงวด" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id} className="font-medium">
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-10 bg-border hidden sm:block mx-1" />

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm mt-5 sm:mt-0">
                <Plus className="mr-2 h-4 w-4" /> สร้างรอบใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>สร้างรอบจ่ายเงินใหม่</DialogTitle>
                <DialogDescription>
                  เลือกเดือนและปีสำหรับดึงข้อมูลเพื่อสร้างรอบคำนวณใหม่
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">เดือน</label>
                  <Select value={createMonth} onValueChange={setCreateMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเดือน" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, index) => {
                        const monthNo = index + 1;
                        return (
                          <SelectItem key={String(monthNo)} value={`${monthNo}`.padStart(2, '0')}>
                            {getThaiMonthName(monthNo)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">ปี พ.ศ.</label>
                  <ThaiYearPicker
                    value={createYear}
                    onChange={setCreateYear}
                    minYear={currentBuddhistYear - 10}
                    maxYear={currentBuddhistYear + 3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <ConfirmActionDialog
                  trigger={<Button disabled={createPeriod.isPending}>สร้างรอบ</Button>}
                  title="ยืนยันการสร้างรอบจ่ายเงิน"
                  description={
                    <span>
                      จะสร้างรอบจ่ายเงินใหม่สำหรับ{' '}
                      <b>{getThaiMonthName(Number.parseInt(createMonth))}</b> ปี{' '}
                      <b>{formatThaiNumber(createYear)}</b>
                    </span>
                  }
                  confirmText="ยืนยันสร้างรอบ"
                  onConfirm={handleCreatePeriod}
                  disabled={createPeriod.isPending}
                />
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {currentPeriod?.status === 'OPEN' ? (
            <ConfirmActionDialog
              trigger={
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 mt-5 sm:mt-0"
                  disabled={deletePeriod.isPending}
                >
                  ลบรอบนี้
                </Button>
              }
              title="ยืนยันการลบรอบจ่ายเงิน (ถาวร)"
              description={
                <span>
                  จะลบรอบ <b>{currentPeriod.label}</b> และข้อมูลคำนวณทั้งหมดของงวดนี้ออกจากระบบ
                  <br />
                  <br />
                  <span className="text-destructive font-medium">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </span>
                </span>
              }
              confirmText="ลบถาวร"
              variant="destructive"
              onConfirm={handleDeletePeriod}
              disabled={deletePeriod.isPending}
            />
          ) : null}
        </div>
      </div>

      {/* 2. Stats Dashboard */}
      {currentPeriod ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border shadow-sm bg-muted/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl shrink-0">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  รอบปัจจุบัน
                </p>
                <p className="text-xl font-bold text-foreground leading-tight">
                  {currentPeriod.month} {currentPeriod.year}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl shrink-0">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  จำนวนผู้รับเงิน
                </p>
                <p className="text-xl font-bold text-foreground leading-tight">
                  {formatThaiNumber(currentPeriod.totalPersons)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">คน</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl shrink-0">
                <Banknote className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  ยอดรวมสุทธิ
                </p>
                <p className="text-xl font-bold text-emerald-600 leading-tight">
                  {formatThaiNumber(currentPeriod.totalAmount)}{' '}
                  <span className="text-sm font-normal text-emerald-600/70">บาท</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="p-3 bg-slate-500/10 rounded-xl shrink-0">
                <AlertCircle className="h-6 w-6 text-slate-600" />
              </div>
              <div className="space-y-2 w-full">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    สถานะรอบ
                  </p>
                  <Badge
                    variant="outline"
                    className={PAY_PERIOD_STATUS_CONFIG[currentPeriod.status].className}
                  >
                    {PAY_PERIOD_STATUS_CONFIG[currentPeriod.status].label}
                  </Badge>
                </div>
                <div className="flex justify-between items-center pt-1 border-t">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    ข้อมูลรายงาน
                  </p>
                  <Badge
                    variant="secondary"
                    className={cn('text-[10px] px-1.5 py-0', snapshotUi.className)}
                  >
                    {snapshotUi.label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-muted/10">
          <Calendar className="h-10 w-10 mx-auto opacity-20 mb-3" />
          <p className="font-medium text-foreground">ยังไม่มีข้อมูลรอบจ่ายเงิน</p>
          <p className="text-sm mt-1">กรุณาสร้างรอบใหม่เพื่อเริ่มต้นการทำงาน</p>
        </div>
      )}

      {currentPeriod && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 3. Main Workflow & Action Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-border flex flex-col h-full">
              <CardHeader className="pb-4 border-b bg-muted/5">
                <CardTitle className="text-lg">ขั้นตอนการทำงาน</CardTitle>
                <CardDescription>ลำดับขั้นในการจัดทำเรื่องเบิกจ่าย พ.ต.ส.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="relative mb-8">
                  <div className="absolute left-[10%] right-[10%] top-4 hidden h-0.5 bg-border sm:block" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:gap-3">
                  {PAY_PERIOD_STATUS_STEPS.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;

                    return (
                      <div
                        key={step.id}
                        className="relative flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-3 sm:flex-col sm:items-center sm:gap-2.5 sm:border-0 sm:bg-transparent sm:px-2 sm:py-0"
                      >
                        <div className="relative z-10 flex shrink-0 flex-col items-center">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all shadow-sm bg-background',
                              isCompleted
                                ? 'border-primary bg-primary text-primary-foreground'
                                : isCurrent
                                  ? 'border-primary text-primary ring-4 ring-primary/10'
                                  : 'border-muted text-muted-foreground',
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <span className="text-xs font-bold">{idx + 1}</span>
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 sm:text-center">
                          <span
                            className={cn(
                              'block text-sm font-medium leading-snug sm:min-h-[2.75rem] sm:text-[11px]',
                              isCurrent ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {step.label}
                          </span>
                        </div>

                        {idx < currentStepIndex && (
                          <div className="absolute left-[calc(50%+1.5rem)] right-[-50%] top-4 hidden h-0.5 bg-primary sm:block" />
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>

                {/* Actions Grid */}
                <div className="grid gap-4 sm:grid-cols-2 mt-auto">
                  <div className="space-y-3 rounded-xl border border-border/60 bg-muted/5 p-5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/10 rounded-md">
                        <Calculator className="h-4 w-4 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-sm">การคำนวณ</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed h-10">
                      คำนวณยอดเงินใหม่หากมีการแก้ไขข้อมูลวันลา หรือมีการปรับเปลี่ยนฐานข้อมูล
                    </p>
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          variant="outline"
                          className="w-full bg-background shadow-sm text-xs"
                          disabled={currentPeriod.status !== 'OPEN' || calculatePeriod.isPending}
                        >
                          คำนวณยอดใหม่
                        </Button>
                      }
                      title="ยืนยันคำนวณรอบใหม่"
                      description={
                        <span>
                          ระบบจะคำนวณยอดใหม่ทั้งหมดสำหรับรอบ <b>{currentPeriod.label}</b>
                        </span>
                      }
                      confirmText="คำนวณใหม่"
                      onConfirm={handleCalculate}
                      disabled={currentPeriod.status !== 'OPEN' || calculatePeriod.isPending}
                    />
                  </div>

                  {/* Submit Action */}
                  <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <h3 className="font-semibold text-primary text-sm flex items-center justify-center sm:justify-start gap-2">
                        <Send className="h-4 w-4" /> ส่งเรื่องเพื่อขออนุมัติ
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        เมื่อตรวจสอบข้อมูลครบทุกวิชาชีพแล้ว ให้กดส่งเรื่องไปที่ หัวหน้า HR
                      </p>
                    </div>
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          className="w-full sm:w-auto shadow-sm gap-2"
                          disabled={!canSubmit || submitToHR.isPending}
                        >
                          ยืนยันส่งเรื่อง
                        </Button>
                      }
                      title="ยืนยันส่งเรื่องขออนุมัติ"
                      description={
                        <span>
                          จะส่งเรื่องเบิกจ่ายรอบ <b>{currentPeriod.label}</b> ให้หัวหน้า HR
                          ตรวจสอบต่อ
                        </span>
                      }
                      confirmText="ส่งเรื่อง"
                      onConfirm={handleSubmitToHR}
                      disabled={!canSubmit || submitToHR.isPending}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Profession Review Status */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-sm flex flex-col border-border">
              <CardHeader className="pb-4 border-b bg-muted/5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">ความคืบหน้า</CardTitle>
                    <CardDescription className="mt-1">การตรวจสอบรายวิชาชีพ</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-sm font-mono h-8 px-3">
                    {professionProgress.reviewed} / {professionProgress.total}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                {/* UX Fix: Custom Scrollbar area inside Card */}
                <div className="h-full max-h-[420px] overflow-y-auto p-4 space-y-2 bg-muted/5">
                  {professionProgress.items.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background text-sm text-muted-foreground">
                      ยังไม่มีข้อมูลการคำนวณในรอบนี้
                    </div>
                  ) : (
                    professionProgress.items.map((item) => (
                      <Link
                        key={item.code}
                        href={`/pts-officer/payroll/${currentPeriod.id}/profession/${item.code}`}
                        className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
                      >
                        <div
                          className={cn(
                            'group flex items-center justify-between rounded-xl border p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5',
                            item.reviewed
                              ? 'bg-emerald-50/40 border-emerald-200/60'
                              : 'bg-background border-border shadow-sm',
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-foreground">{item.label}</p>
                              {item.reviewed ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatThaiNumber(item.count)} คน{' '}
                              <span className="mx-1 text-border">•</span>{' '}
                              <span className="font-mono">{formatThaiNumber(item.amount)}</span> บ.
                            </p>
                          </div>
                          <div
                            className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                              item.reviewed
                                ? 'bg-emerald-100/50 group-hover:bg-emerald-200/50'
                                : 'bg-muted group-hover:bg-primary/10',
                            )}
                          >
                            <ChevronRight
                              className={cn(
                                'h-4 w-4',
                                item.reviewed
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground group-hover:text-primary',
                              )}
                            />
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </CardContent>
              <div className="p-4 border-t bg-background shrink-0">
                <Button
                  variant="outline"
                  className="w-full justify-between shadow-sm bg-background hover:bg-muted"
                  asChild
                >
                  <Link href={`/pts-officer/payroll/${currentPeriod.id}`}>
                    ดูตารางรวมทั้งหมด <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 5. History Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="border-b bg-muted/5 py-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            ประวัติรอบการจ่ายเงินทั้งหมด
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-background">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[180px]">งวดเดือน/ปี</TableHead>
                  <TableHead className="text-center w-[120px]">จำนวนคน</TableHead>
                  <TableHead className="text-right w-[150px]">ยอดรวม (บาท)</TableHead>
                  <TableHead className="w-[150px]">สถานะ</TableHead>
                  <TableHead className="w-[150px]">วันที่สร้างเอกสาร</TableHead>
                  <TableHead className="text-right w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {periods.map((period) => (
                  <TableRow key={period.id} className="hover:bg-muted/20">
                    <TableCell className="font-semibold">
                      {period.month} {period.year}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {formatThaiNumber(period.totalPersons)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 font-medium">
                      {formatThaiNumber(period.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={PAY_PERIOD_STATUS_CONFIG[period.status].className}
                      >
                        {PAY_PERIOD_STATUS_CONFIG[period.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {period.createdAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:bg-primary/10 hover:text-primary"
                        asChild
                      >
                        <Link href={`/pts-officer/payroll/${period.id}`}>ดูข้อมูล</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {periods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      ไม่มีประวัติรอบจ่ายเงิน
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
