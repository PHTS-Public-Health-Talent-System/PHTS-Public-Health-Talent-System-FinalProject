'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  Users,
  Banknote,
  TrendingUp,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useApproveByDirector,
  useDownloadPeriodReport,
  usePeriods,
  useRejectPeriod,
} from '@/features/payroll/hooks';
import type { PayPeriod } from '@/features/payroll/api';
import { formatThaiDate, formatThaiMonthYear, formatThaiNumber } from '@/shared/utils/thai-locale';

const formatPeriodLabel = (month: number, year: number) => formatThaiMonthYear(month, year);

const toPeriodCode = (month: number, year: number) => {
  const buddhistYear = year >= 2400 ? year : year + 543;
  return `PAY-${String(month).padStart(2, '0')}/${buddhistYear}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return formatThaiDate(value);
};

type PayrollRow = {
  periodId: number;
  periodLabel: string;
  periodCode: string;
  totalAmount: number;
  totalRecords: number;
  submittedBy: string;
  submittedDate: string;
  closedDate: string;
  status: 'WAITING_DIRECTOR' | 'CLOSED';
};

type StatCardProps = {
  title: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
};

const StatCard = ({ title, value, icon: Icon, colorClass, bgClass }: StatCardProps) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
      </div>
      <div
        className={`p-3 rounded-full ${bgClass} ${colorClass.replace('text-', 'bg-').split(' ')[0]}/10`}
      >
        <Icon className="h-6 w-6" />
      </div>
    </CardContent>
  </Card>
);

export default function DirectorPayrollPage() {
  const periodsQuery = usePeriods();
  const approveByDirector = useApproveByDirector();
  const rejectPeriod = useRejectPeriod();
  const downloadReport = useDownloadPeriodReport();

  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRow | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = useMemo<PayrollRow[]>(() => {
    const periods = (periodsQuery.data ?? []) as PayPeriod[];
    return periods
      .filter((period) => period.status === 'WAITING_DIRECTOR' || period.status === 'CLOSED')
      .map((period) => ({
        periodId: period.period_id,
        periodLabel: formatPeriodLabel(period.period_month, period.period_year),
        periodCode: toPeriodCode(period.period_month, period.period_year),
        totalAmount: Number(period.total_amount ?? 0),
        totalRecords: Number(period.total_headcount ?? 0),
        submittedBy: period.created_by_name ?? '-',
        submittedDate: formatDate(period.created_at ?? null),
        closedDate: formatDate(period.closed_at ?? period.updated_at ?? null),
        status: period.status as 'WAITING_DIRECTOR' | 'CLOSED',
      }));
  }, [periodsQuery.data]);

  const pendingRows = useMemo(
    () => rows.filter((row) => row.status === 'WAITING_DIRECTOR'),
    [rows],
  );
  const closedRows = useMemo(() => rows.filter((row) => row.status === 'CLOSED'), [rows]);

  const latestPeriodId = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.periodId - a.periodId);
    return sorted[0]?.periodId;
  }, [rows]);

  const pendingTotalAmount = pendingRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const waitingTotalRecords = pendingRows.reduce((sum, row) => sum + row.totalRecords, 0);

  const handleAction = async () => {
    if (!selectedPayroll || !actionType) return;
    const trimmed = comment.trim();

    if (actionType === 'reject' && !trimmed) {
      setActionError('กรุณาระบุเหตุผลก่อนปฏิเสธ');
      return;
    }

    setActionError(null);
    try {
      if (actionType === 'approve') {
        await approveByDirector.mutateAsync(selectedPayroll.periodId);
        toast.success('อนุมัติรอบจ่ายเงินแล้ว');
      } else {
        await rejectPeriod.mutateAsync({
          periodId: selectedPayroll.periodId,
          payload: { reason: trimmed },
        });
        toast.success('ปฏิเสธรอบจ่ายเงินแล้ว');
      }

      await periodsQuery.refetch();
      setSelectedPayroll(null);
      setActionType(null);
      setComment('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
      setActionError(message);
    }
  };

  const isLoading = periodsQuery.isLoading;

  return (
    <div className="p-8 space-y-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">รอบจ่ายเงิน</h1>
          <p className="text-muted-foreground mt-1">ตรวจสอบและอนุมัติรอบจ่ายเงิน พ.ต.ส. ในฐานะผู้บริหาร</p>
        </div>
        <div>
          <Button
            variant="outline"
            className="bg-background shadow-sm"
            disabled={!latestPeriodId || downloadReport.isPending}
            onClick={async () => {
              if (!latestPeriodId) return;
              const blob = await downloadReport.mutateAsync(latestPeriodId);
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `payroll_${latestPeriodId}.pdf`;
              link.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            ดาวน์โหลดรายงานล่าสุด
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="รอรอบอนุมัติ"
          value={pendingRows.length}
          icon={Calendar}
          colorClass="text-purple-600"
          bgClass="bg-purple-500/10"
        />
        <StatCard
          title="ผู้มีสิทธิรอจ่าย"
          value={waitingTotalRecords}
          icon={Users}
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <StatCard
          title="ยอดรวมรออนุมัติ"
          value={`${(pendingTotalAmount / 1_000_000).toFixed(2)}M`}
          icon={Banknote}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-500/10"
        />
        <StatCard
          title="อนุมัติแล้ว"
          value={closedRows.length}
          icon={TrendingUp}
          colorClass="text-amber-600"
          bgClass="bg-amber-500/10"
        />
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600" />
            รอบจ่ายเงินรออนุมัติ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-semibold w-[150px]">รหัสรอบ</TableHead>
                  <TableHead className="font-semibold">เดือนงวด</TableHead>
                  <TableHead className="font-semibold text-right">จำนวนคน</TableHead>
                  <TableHead className="font-semibold text-right">ยอดรวม</TableHead>
                  <TableHead className="font-semibold">ผู้อนุมัติก่อนหน้า</TableHead>
                  <TableHead className="font-semibold">วันที่ส่ง</TableHead>
                  <TableHead className="font-semibold text-right w-[170px]">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ) : pendingRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      ไม่มีรอบที่รอผู้บริหารอนุมัติ
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRows.map((row) => (
                    <TableRow key={row.periodId} className="group hover:bg-muted/30 border-border">
                      <TableCell className="font-mono text-sm">PAY-{row.periodCode}</TableCell>
                      <TableCell className="font-medium">{row.periodLabel}</TableCell>
                      <TableCell className="text-right">
                        {formatThaiNumber(row.totalRecords)} คน
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatThaiNumber(row.totalAmount)} บาท
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>ฝ่ายทรัพยากรบุคคล: อนุมัติแล้ว</div>
                          <div>ฝ่ายการเงิน: อนุมัติแล้ว</div>
                        </div>
                      </TableCell>
                      <TableCell>{row.submittedDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/director/payroll/${row.periodId}`}>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => {
                              setSelectedPayroll(row);
                              setActionType('approve');
                              setActionError(null);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => {
                              setSelectedPayroll(row);
                              setActionType('reject');
                              setActionError(null);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            รอบจ่ายเงินที่อนุมัติแล้ว
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-semibold w-[150px]">รหัสรอบ</TableHead>
                  <TableHead className="font-semibold">เดือนงวด</TableHead>
                  <TableHead className="font-semibold text-right">จำนวนคน</TableHead>
                  <TableHead className="font-semibold text-right">ยอดรวม</TableHead>
                  <TableHead className="font-semibold">สถานะ</TableHead>
                  <TableHead className="font-semibold">วันที่อนุมัติ</TableHead>
                  <TableHead className="font-semibold text-right w-[170px]">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ) : closedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      ไม่มีรอบที่อนุมัติแล้ว
                    </TableCell>
                  </TableRow>
                ) : (
                  closedRows.map((row) => (
                    <TableRow key={row.periodId} className="group hover:bg-muted/30 border-border">
                      <TableCell className="font-mono text-sm">PAY-{row.periodCode}</TableCell>
                      <TableCell className="font-medium">{row.periodLabel}</TableCell>
                      <TableCell className="text-right">
                        {formatThaiNumber(row.totalRecords)} คน
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatThaiNumber(row.totalAmount)} บาท
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 font-normal"
                        >
                          อนุมัติแล้ว
                        </Badge>
                      </TableCell>
                      <TableCell>{row.closedDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/director/payroll/${row.periodId}`}>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground">
            แสดงทั้งหมด {rows.length} รายการ
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedPayroll && !!actionType}
        onOpenChange={() => {
          setSelectedPayroll(null);
          setActionType(null);
          setComment('');
          setActionError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                actionType === 'approve' ? 'text-emerald-600' : 'text-destructive'
              }`}
            >
              {actionType === 'approve' && <CheckCircle2 className="h-5 w-5" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5" />}
              {actionType === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
            </DialogTitle>
            <DialogDescription>
              {selectedPayroll && (
                <div className="mt-3 rounded-md bg-secondary/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">รหัสรอบ:</span>
                    <span className="font-mono font-medium">PAY-{selectedPayroll.periodCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">รอบจ่าย:</span>
                    <span className="font-medium">{selectedPayroll.periodLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ยอดรวม:</span>
                    <span className="font-medium">
                      {formatThaiNumber(selectedPayroll.totalAmount)} บาท
                    </span>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {actionType === 'approve' ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลการปฏิเสธ'}
                {actionType === 'reject' && <span className="text-destructive ml-1">*</span>}
              </label>
              <Textarea
                placeholder={
                  actionType === 'approve'
                    ? 'ระบุหมายเหตุเพิ่มเติม (ถ้ามี)'
                    : 'โปรดระบุเหตุผลที่ปฏิเสธ...'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none min-h-[100px]"
              />
              {actionError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {actionError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPayroll(null);
                setActionType(null);
                setComment('');
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAction}
              disabled={approveByDirector.isPending || rejectPeriod.isPending}
              className={
                actionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-white'
              }
            >
              {actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
