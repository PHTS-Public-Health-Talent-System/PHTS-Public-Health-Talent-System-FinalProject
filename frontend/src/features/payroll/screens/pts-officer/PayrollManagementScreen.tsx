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
import {
  Plus,
  Send,
  FileText,
  Download,
  Calendar,
  Users,
  Banknote,
  AlertCircle,
  ChevronRight,
  Calculator,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { YearPicker } from '@/components/month-year-picker';
import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  useCalculatePeriod,
  useCreatePeriod,
  useDeletePeriod,
  useDownloadPeriodReport,
  usePeriodPayouts,
  usePeriods,
  useSubmitToHR,
} from '@/features/payroll/hooks';
import type { PayPeriod, PeriodPayoutRow } from '@/features/payroll/api';
import { usePayrollReviewProgress } from '@/features/payroll/usePayrollReviewProgress';
import { normalizeProfessionCode, resolveProfessionLabel } from '@/shared/constants/profession';
import { formatThaiNumber, toBuddhistYear } from '@/shared/utils/thai-locale';
import {
  asPayPeriodStatus,
  formatThaiDate,
  getThaiMonthName,
  PAY_PERIOD_STATUS_CONFIG,
  PAY_PERIOD_STATUS_STEPS,
} from '@/features/payroll/ui';
import { cn } from '@/lib/utils';

type PayPeriodUiModel = {
  id: string;
  label: string;
  month: string;
  year: string;
  status: ReturnType<typeof asPayPeriodStatus>;
  totalPersons: number;
  totalAmount: number;
  createdAt: string;
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
  };
}

export function PayrollManagementScreen() {
  const periodsQuery = usePeriods();
  const createPeriod = useCreatePeriod();
  const calculatePeriod = useCalculatePeriod();
  const submitToHR = useSubmitToHR();
  const downloadReport = useDownloadPeriodReport();
  const deletePeriod = useDeletePeriod();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createMonth, setCreateMonth] = useState('01');
  const [createYear, setCreateYear] = useState(2569);
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
  const { reviewedCodes } = usePayrollReviewProgress(currentPeriod?.id ?? '');

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

  const handleDownload = async () => {
    if (!currentPeriod) return;
    try {
      const blob = await downloadReport.mutateAsync(currentPeriod.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll-period-${currentPeriod.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('ไม่สามารถดาวน์โหลดรายงานได้');
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

  return (
    <div className="p-8 space-y-8">
      {/* 1. Header & Context Switcher */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการรอบจ่ายเงิน</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            คำนวณ ตรวจสอบ และอนุมัติค่าตอบแทนพิเศษรายเดือน
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={currentPeriod?.id ?? ''} onValueChange={(value) => setSelectedPeriodId(value)}>
            <SelectTrigger className="w-[240px] shadow-sm">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="เลือกงวด" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentPeriod?.status === 'OPEN' ? (
            <ConfirmActionDialog
              trigger={
                <Button variant="destructive" className="shadow-sm" disabled={deletePeriod.isPending}>
                  ลบรอบนี้
                </Button>
              }
              title="ยืนยันการลบรอบจ่ายเงิน (ถาวร)"
              description={
                <span>
                  จะลบรอบ <b>{currentPeriod.label}</b> และข้อมูลคำนวณทั้งหมดของงวดนี้ออกจากระบบ
                  <br />
                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </span>
              }
              confirmText="ลบถาวร"
              variant="destructive"
              onConfirm={handleDeletePeriod}
              disabled={deletePeriod.isPending}
            />
          ) : null}

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> สร้างรอบใหม่
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>สร้างรอบจ่ายเงินใหม่</DialogTitle>
                <DialogDescription>เลือกเดือนและปีสำหรับสร้างรอบใหม่</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
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
                  <YearPicker value={createYear} onChange={setCreateYear} minYear={2550} maxYear={2600} />
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
                      จะสร้างรอบจ่ายเงินใหม่สำหรับ <b>{getThaiMonthName(Number.parseInt(createMonth))}</b> ปี{' '}
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
        </div>
      </div>

      {/* 2. Stats Dashboard */}
      {currentPeriod ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary bg-card/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">รอบปัจจุบัน</p>
                  <p className="text-2xl font-bold">
                    {currentPeriod.month} {currentPeriod.year}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">จำนวนผู้รับเงิน</p>
                  <p className="text-2xl font-bold">
                    {formatThaiNumber(currentPeriod.totalPersons)}{' '}
                    <span className="text-sm font-normal text-muted-foreground">คน</span>
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ยอดรวมสุทธิ</p>
                  <p className="text-2xl font-bold text-[hsl(var(--success))]">
                    {formatThaiNumber(currentPeriod.totalAmount)}{' '}
                    <span className="text-sm font-normal text-muted-foreground">บาท</span>
                  </p>
                </div>
                <Banknote className="h-8 w-8 text-[hsl(var(--success))]/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">สถานะ</p>
                  <Badge
                    variant="outline"
                    className={cn('mt-1', PAY_PERIOD_STATUS_CONFIG[currentPeriod.status].className)}
                  >
                    {PAY_PERIOD_STATUS_CONFIG[currentPeriod.status].label}
                  </Badge>
                </div>
                <AlertCircle className="h-8 w-8 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          ยังไม่มีข้อมูลรอบจ่ายเงิน กรุณาสร้างรอบใหม่
        </div>
      )}

      {currentPeriod && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 3. Main Workflow & Action Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">สถานะการดำเนินงาน</CardTitle>
                <CardDescription>ติดตามขั้นตอนและจัดการรอบจ่ายเงิน</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Workflow Stepper */}
                <div className="relative flex items-center justify-between w-full">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-secondary -z-10" />
                  {PAY_PERIOD_STATUS_STEPS.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-2">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                            isCompleted
                              ? 'border-primary bg-primary text-primary-foreground'
                              : isCurrent
                                ? 'border-primary bg-background text-primary'
                                : 'border-muted bg-background text-muted-foreground',
                          )}
                        >
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <span>{idx + 1}</span>}
                        </div>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            isCurrent ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-4 rounded-lg border bg-secondary/20 p-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calculator className="h-4 w-4" /> การคำนวณ
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      คำนวณยอดเงินใหม่หากมีการแก้ไขข้อมูลพื้นฐานหรือวันลา
                    </p>
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          variant="outline"
                          className="w-full bg-background"
                          disabled={currentPeriod.status !== 'OPEN' || calculatePeriod.isPending}
                        >
                          คำนวณใหม่
                        </Button>
                      }
                      title="ยืนยันคำนวณรอบใหม่"
                      description={
                        <span>
                          ระบบจะคำนวณยอดใหม่สำหรับรอบ <b>{currentPeriod.label}</b>
                        </span>
                      }
                      confirmText="คำนวณใหม่"
                      onConfirm={handleCalculate}
                      disabled={currentPeriod.status !== 'OPEN' || calculatePeriod.isPending}
                    />
                  </div>

                  <div className="space-y-4 rounded-lg border bg-secondary/20 p-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" /> เอกสาร
                    </h3>
                    <p className="text-sm text-muted-foreground">ดาวน์โหลดรายงานสรุปยอดจ่ายประจำงวด</p>
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          variant="outline"
                          className="w-full bg-background"
                          disabled={!currentPeriod || downloadReport.isPending}
                        >
                          <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดรายงาน
                        </Button>
                      }
                      title="ยืนยันดาวน์โหลดรายงาน"
                      description={
                        <span>
                          ระบบจะดาวน์โหลดรายงานของรอบ <b>{currentPeriod.label}</b>
                        </span>
                      }
                      confirmText="ดาวน์โหลด"
                      onConfirm={handleDownload}
                      disabled={!currentPeriod || downloadReport.isPending}
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-primary">ส่งต่อให้ HR อนุมัติ</h3>
                    <p className="text-sm text-muted-foreground">
                      เมื่อตรวจสอบครบถ้วนแล้ว กดส่งเพื่อเข้าสู่ขั้นตอนถัดไป
                    </p>
                  </div>
                  <ConfirmActionDialog
                    trigger={
                      <Button
                        size="lg"
                        className="w-full sm:w-auto gap-2"
                        disabled={!canSubmit || submitToHR.isPending}
                      >
                        <Send className="h-4 w-4" /> ยืนยันส่งหัวหน้า HR
                      </Button>
                    }
                    title="ยืนยันส่งให้หัวหน้า HR อนุมัติ"
                    description={
                      <span>
                        จะส่งรอบ <b>{currentPeriod.label}</b> ให้หัวหน้า HR อนุมัติ
                      </span>
                    }
                    confirmText="ส่งให้หัวหน้า HR"
                    onConfirm={handleSubmitToHR}
                    disabled={!canSubmit || submitToHR.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Profession Review Status */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-sm flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">ความคืบหน้าการตรวจ</CardTitle>
                  <Badge variant="secondary">
                    {professionProgress.reviewed} / {professionProgress.total}
                  </Badge>
                </div>
                <CardDescription>รายการวิชาชีพที่ต้องตรวจสอบในรอบนี้</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto max-h-[500px] pr-2">
                {professionProgress.items.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    ยังไม่มีข้อมูลในรอบนี้
                  </div>
                ) : (
                  <div className="space-y-2">
                    {professionProgress.items.map((item) => (
                      <Link
                        key={item.code}
                        href={`/pts-officer/payroll/${currentPeriod.id}/profession/${item.code}`}
                        className="block"
                      >
                        <div
                          className={cn(
                            'group flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-secondary/50',
                            item.reviewed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-card border-border',
                          )}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{item.label}</p>
                              {item.reviewed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatThaiNumber(item.count)} คน • {formatThaiNumber(item.amount)} บ.
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="p-4 border-t bg-muted/10">
                <Button variant="secondary" className="w-full justify-between" asChild>
                  <Link href={`/pts-officer/payroll/${currentPeriod.id}`}>
                    ไปหน้าตรวจสอบทั้งหมด <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 5. History Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">ประวัติรอบการจ่ายเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>เดือน/ปี</TableHead>
                  <TableHead className="text-center">จำนวนคน</TableHead>
                  <TableHead className="text-right">ยอดรวม (บาท)</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {period.month} {period.year}
                    </TableCell>
                    <TableCell className="text-center">{period.totalPersons}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatThaiNumber(period.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PAY_PERIOD_STATUS_CONFIG[period.status].className}>
                        {PAY_PERIOD_STATUS_CONFIG[period.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{period.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/pts-officer/payroll/${period.id}`}>รายละเอียด</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
