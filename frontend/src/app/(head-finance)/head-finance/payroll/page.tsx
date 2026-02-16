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
  useApproveByHeadFinance,
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
  processedDate: string;
  status: 'WAITING_HR' | 'WAITING_HEAD_FINANCE' | 'WAITING_DIRECTOR' | 'CLOSED';
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

function getStatusBadge(status: PayrollRow['status']) {
  switch (status) {
    case 'WAITING_HR':
      return (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-700 font-normal gap-1"
        >
          <Clock className="w-3 h-3" /> รอหัวหน้า HR อนุมัติ
        </Badge>
      );
    case 'WAITING_HEAD_FINANCE':
      return (
        <Badge
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700 font-normal gap-1"
        >
          <CheckCircle2 className="w-3 h-3" /> รอหัวหน้าการเงิน
        </Badge>
      );
    case 'WAITING_DIRECTOR':
      return (
        <Badge
          variant="outline"
          className="border-purple-200 bg-purple-50 text-purple-700 font-normal gap-1"
        >
          <CheckCircle2 className="w-3 h-3" /> รอผู้อำนวยการ
        </Badge>
      );
    case 'CLOSED':
      return (
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-700 font-normal gap-1"
        >
          <CheckCircle2 className="w-3 h-3" /> ปิดงวดแล้ว
        </Badge>
      );
    default:
      return <span className="text-muted-foreground">-</span>;
  }
}

export default function HeadFinancePayrollPage() {
  const periodsQuery = usePeriods();
  const approveByHeadFinance = useApproveByHeadFinance();
  const rejectPeriod = useRejectPeriod();
  const downloadReport = useDownloadPeriodReport();

  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRow | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = useMemo<PayrollRow[]>(() => {
    const periods = (periodsQuery.data ?? []) as PayPeriod[];
    return periods
      .filter((period) => period.status !== 'OPEN')
      .map((period) => ({
        periodId: period.period_id,
        periodLabel: formatPeriodLabel(period.period_month, period.period_year),
        periodCode: toPeriodCode(period.period_month, period.period_year),
        totalAmount: Number(period.total_amount ?? 0),
        totalRecords: Number(period.total_headcount ?? 0),
        submittedBy: period.created_by_name ?? '-',
        submittedDate: formatDate(period.created_at ?? null),
        processedDate: formatDate(period.closed_at ?? period.updated_at ?? null),
        status: period.status as PayrollRow['status'],
      }));
  }, [periodsQuery.data]);

  const pendingRows = useMemo(
    () => rows.filter((row) => row.status === 'WAITING_HEAD_FINANCE'),
    [rows],
  );
  const processedRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.status === 'WAITING_HR' || row.status === 'WAITING_DIRECTOR' || row.status === 'CLOSED',
      ),
    [rows],
  );

  const latestPeriodId = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.periodId - a.periodId);
    return sorted[0]?.periodId;
  }, [rows]);

  const pendingTotalAmount = pendingRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const pendingTotalRecords = pendingRows.reduce((sum, row) => sum + row.totalRecords, 0);

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
        await approveByHeadFinance.mutateAsync(selectedPayroll.periodId);
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
          <p className="text-muted-foreground mt-1">ตรวจสอบและอนุมัติรอบจ่ายเงิน พ.ต.ส. (หัวหน้าการเงิน)</p>
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
          value={pendingTotalRecords}
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
          title="ส่งต่อ/ปิดแล้ว"
          value={processedRows.length}
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
                      ไม่มีรอบที่รอหัวหน้าการเงิน อนุมัติ
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
                        <div className="text-sm">PTS Officer: {row.submittedBy}</div>
                      </TableCell>
                      <TableCell>{row.submittedDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/head-finance/payroll/${row.periodId}`}>
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
            รอบจ่ายเงินที่อนุมัติแล้ว / ส่งต่อแล้ว
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
                  <TableHead className="font-semibold">วันที่ดำเนินการ</TableHead>
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
                ) : processedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      ไม่มีรอบที่ดำเนินการแล้ว
                    </TableCell>
                  </TableRow>
                ) : (
                  processedRows.map((row) => (
                    <TableRow key={row.periodId} className="group hover:bg-muted/30 border-border">
                      <TableCell className="font-mono text-sm">PAY-{row.periodCode}</TableCell>
                      <TableCell className="font-medium">{row.periodLabel}</TableCell>
                      <TableCell className="text-right">
                        {formatThaiNumber(row.totalRecords)} คน
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatThaiNumber(row.totalAmount)} บาท
                      </TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>{row.processedDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/head-finance/payroll/${row.periodId}`}>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              const blob = await downloadReport.mutateAsync(row.periodId);
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `payroll_${row.periodId}.pdf`;
                              link.click();
                              window.URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${actionType === 'approve' ? 'text-emerald-600' : 'text-destructive'}`}
            >
              {actionType === 'approve' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {actionType === 'approve' && 'ยืนยันการอนุมัติรอบจ่ายเงิน'}
              {actionType === 'reject' && 'ยืนยันการปฏิเสธรอบจ่ายเงิน'}
            </DialogTitle>
            <DialogDescription>
              {selectedPayroll && (
                <span className="font-medium text-foreground block mt-1">
                  รอบเดือน {selectedPayroll.periodLabel} (รหัส {selectedPayroll.periodCode})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedPayroll && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-muted-foreground">จำนวนรายการ:</div>
                  <div className="font-medium text-right">{selectedPayroll.totalRecords} คน</div>

                  <div className="text-muted-foreground">ยอดรวมทั้งสิ้น:</div>
                  <div className="font-medium text-right">
                    {formatThaiNumber(selectedPayroll.totalAmount)} บาท
                  </div>

                  <div className="text-muted-foreground">ผู้ส่งเรื่อง:</div>
                  <div className="font-medium text-right">{selectedPayroll.submittedBy}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {actionType === 'approve' ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลที่ปฏิเสธ'}
                {actionType === 'reject' && <span className="text-destructive ml-1">*</span>}
              </label>
              <Textarea
                placeholder={
                  actionType === 'approve'
                    ? 'ระบุหมายเหตุเพิ่มเติม...'
                    : 'โปรดระบุเหตุผลที่ต้องการปฏิเสธเพื่อให้เจ้าหน้าที่แก้ไข...'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none min-h-[100px]"
              />
              {actionError && (
                <p className="text-xs text-destructive flex items-center gap-1">
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
              disabled={approveByHeadFinance.isPending || rejectPeriod.isPending}
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
