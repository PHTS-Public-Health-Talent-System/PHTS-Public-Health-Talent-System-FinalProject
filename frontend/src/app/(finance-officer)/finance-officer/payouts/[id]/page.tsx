'use client';

export const dynamic = 'force-dynamic';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Search,
  Wallet,
  XCircle,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import {
  useBatchMarkAsPaid,
  useCancelPayout,
  useFinanceSummary,
  useMarkPayoutAsPaid,
  usePayoutsByPeriod,
} from '@/features/finance/hooks';
import {
  formatThaiCurrency,
  formatThaiDateTime,
  formatThaiMonthYear,
  toBuddhistYear,
} from '@/shared/utils/thai-locale';

type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED';

type PayoutRow = {
  payout_id: number;
  period_id: number;
  period_month: number;
  period_year: number;
  citizen_id: string;
  employee_name: string;
  department: string | null;
  pts_rate_snapshot: number;
  calculated_amount: number;
  retroactive_amount: number;
  total_payable: number;
  payment_status: PaymentStatus;
  paid_at: string | null;
  paid_by: number | null;
};

type FinanceSummaryRow = {
  period_id: number;
  period_month: number;
  period_year: number;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
};

const toPeriodCode = (month: number, year: number) => {
  return `PAY-${String(month).padStart(2, '0')}/${toBuddhistYear(year)}`;
};

const formatDateTime = (value?: string | null) => {
  return formatThaiDateTime(value);
};

const escapeCsv = (value: string | number) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export default function PayoutPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const periodId = Number(id);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [targetPayout, setTargetPayout] = useState<PayoutRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const summaryQuery = useFinanceSummary();
  const payoutsQuery = usePayoutsByPeriod(
    periodId,
    statusFilter === 'all'
      ? { search: search.trim() || undefined }
      : { status: statusFilter, search: search.trim() || undefined },
  );
  const markPaidMutation = useMarkPayoutAsPaid();
  const batchMarkPaidMutation = useBatchMarkAsPaid();
  const cancelPayoutMutation = useCancelPayout();

  const payouts = useMemo<PayoutRow[]>(() => {
    if (!Array.isArray(payoutsQuery.data)) return [];
    return (payoutsQuery.data as PayoutRow[]).map((item) => ({
      ...item,
      pts_rate_snapshot: Number(item.pts_rate_snapshot ?? 0),
      calculated_amount: Number(item.calculated_amount ?? 0),
      retroactive_amount: Number(item.retroactive_amount ?? 0),
      total_payable: Number(item.total_payable ?? 0),
    }));
  }, [payoutsQuery.data]);

  const periodSummary = useMemo(() => {
    if (!Array.isArray(summaryQuery.data)) return null;
    return ((summaryQuery.data as FinanceSummaryRow[]).find((row) => row.period_id === periodId) ??
      null) as FinanceSummaryRow | null;
  }, [summaryQuery.data, periodId]);

  const pendingRows = useMemo(
    () => payouts.filter((item) => item.payment_status === 'PENDING'),
    [payouts],
  );

  const totalAmount = payouts.reduce((sum, item) => sum + item.total_payable, 0);
  const paidAmount = payouts
    .filter((item) => item.payment_status === 'PAID')
    .reduce((sum, item) => sum + item.total_payable, 0);
  const pendingAmount = payouts
    .filter((item) => item.payment_status === 'PENDING')
    .reduce((sum, item) => sum + item.total_payable, 0);

  const selectedTotal = payouts
    .filter((item) => selectedIds.includes(item.payout_id))
    .reduce((sum, item) => sum + item.total_payable, 0);

  const allPendingSelected =
    pendingRows.length > 0 && pendingRows.every((item) => selectedIds.includes(item.payout_id));

  const handleSelectAllPending = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pendingRows.map((item) => item.payout_id));
      return;
    }
    setSelectedIds([]);
  };

  const handleSelectRow = (payoutId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => (prev.includes(payoutId) ? prev : [...prev, payoutId]));
      return;
    }
    setSelectedIds((prev) => prev.filter((idValue) => idValue !== payoutId));
  };

  const getStatusBadge = (status: PaymentStatus) => {
    if (status === 'PENDING') {
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          <Clock className="mr-1 h-3 w-3" />
          รอจ่ายเงิน
        </Badge>
      );
    }
    if (status === 'PAID') {
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          จ่ายแล้ว
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        <XCircle className="mr-1 h-3 w-3" />
        ยกเลิก
      </Badge>
    );
  };

  const handleMarkSinglePaid = async (row: PayoutRow) => {
    setActionError(null);
    try {
      await markPaidMutation.mutateAsync({
        payoutId: row.payout_id,
        payload: { comment: 'จ่ายเงินเรียบร้อย' },
      });
      toast.success(`จ่ายเงินเรียบร้อย: ${row.employee_name}`);
      setSelectedIds((prev) => prev.filter((idValue) => idValue !== row.payout_id));
      await payoutsQuery.refetch();
      await summaryQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถจ่ายเงินได้';
      setActionError(message);
      toast.error(message);
    }
  };

  const handleBatchMarkPaid = async () => {
    setActionError(null);
    if (selectedIds.length === 0) {
      setActionError('กรุณาเลือกรายการอย่างน้อย 1 รายการ');
      toast.error('กรุณาเลือกรายการอย่างน้อย 1 รายการ');
      return;
    }
    try {
      const result = (await batchMarkPaidMutation.mutateAsync({
        payoutIds: selectedIds,
      })) as { success?: number[]; failed?: Array<{ id: number; reason: string }> };
      const successCount = result.success?.length ?? selectedIds.length;
      const failedCount = result.failed?.length ?? 0;
      toast.success(`จ่ายเงินสำเร็จ ${successCount} รายการ`);
      if (failedCount > 0) {
        setActionError(`มีรายการไม่สำเร็จ ${failedCount} รายการ`);
        toast.error(`มีรายการไม่สำเร็จ ${failedCount} รายการ`);
      }
      setSelectedIds([]);
      setMarkPaidDialogOpen(false);
      await payoutsQuery.refetch();
      await summaryQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถจ่ายเงินแบบกลุ่มได้';
      setActionError(message);
      toast.error(message);
    }
  };

  const handleCancelPayout = async () => {
    if (!targetPayout) return;
    setActionError(null);
    if (!cancelReason.trim()) {
      setActionError('กรุณาระบุเหตุผลการยกเลิก');
      toast.error('กรุณาระบุเหตุผลการยกเลิก');
      return;
    }
    try {
      await cancelPayoutMutation.mutateAsync({
        payoutId: targetPayout.payout_id,
        payload: { reason: cancelReason.trim() },
      });
      toast.success(`ยกเลิกรายการ ${targetPayout.employee_name} แล้ว`);
      setCancelDialogOpen(false);
      setTargetPayout(null);
      setCancelReason('');
      setSelectedIds((prev) => prev.filter((idValue) => idValue !== targetPayout.payout_id));
      await payoutsQuery.refetch();
      await summaryQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถยกเลิกรายการได้';
      setActionError(message);
      toast.error(message);
    }
  };

  const handleExport = () => {
    setActionError(null);
    if (payouts.length === 0) {
      setActionError('ไม่พบข้อมูลสำหรับส่งออก');
      toast.error('ไม่พบข้อมูลสำหรับส่งออก');
      return;
    }
    const headers = [
      'Payout ID',
      'Citizen ID',
      'ชื่อผู้รับเงิน',
      'หน่วยงาน',
      'อัตรา',
      'ยอดปรับย้อนหลัง',
      'ยอดจ่ายสุทธิ',
      'สถานะ',
      'วันที่จ่าย',
    ];
    const rows = payouts.map((row) => [
      row.payout_id,
      row.citizen_id,
      row.employee_name,
      row.department || '-',
      row.pts_rate_snapshot,
      row.retroactive_amount,
      row.total_payable,
      row.payment_status,
      row.paid_at || '',
    ]);
    const csv =
      '\uFEFF' + [headers, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-payout-period-${periodId}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('ส่งออกรายการจ่ายเงินสำเร็จ');
  };

  const isLoading = payoutsQuery.isLoading || summaryQuery.isLoading;
  const periodTitle = periodSummary
    ? `${toPeriodCode(periodSummary.period_month, periodSummary.period_year)} • ${formatThaiMonthYear(
        periodSummary.period_month,
        periodSummary.period_year,
      )}`
    : `Period #${periodId}`;

  if (isLoading) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6 text-muted-foreground">กำลังโหลดข้อมูลรอบจ่าย...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/finance-officer/payouts"
          className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้ารายการรอบจ่าย
        </Link>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{periodTitle}</h1>
            <p className="mt-1 text-muted-foreground">จัดการการจ่ายเงินรายบุคคลในรอบนี้</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              ส่งออก CSV
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setMarkPaidDialogOpen(true)}
              disabled={selectedIds.length === 0}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              จ่ายเงินที่เลือก ({selectedIds.length})
            </Button>
          </div>
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive" className="mb-6 border-destructive/40 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">จำนวนรายการ</p>
                <p className="text-2xl font-bold">{payouts.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดรวมทั้งรอบ</p>
                <p className="text-2xl font-bold">{formatThaiCurrency(totalAmount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดคงค้าง</p>
                <p className="text-2xl font-bold text-amber-600">{formatThaiCurrency(pendingAmount)}</p>
              </div>
              <Wallet className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดจ่ายแล้ว</p>
                <p className="text-2xl font-bold text-emerald-600">{formatThaiCurrency(paidAmount)}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาด้วยชื่อ หรือเลขบัตรประชาชน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | PaymentStatus)}>
              <SelectTrigger className="w-[180px] bg-background border-input">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="PENDING">รอจ่ายเงิน</SelectItem>
                <SelectItem value="PAID">จ่ายแล้ว</SelectItem>
                <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการจ่ายเงินในรอบนี้</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[52px]">
                  <Checkbox
                    checked={allPendingSelected}
                    onCheckedChange={(checked) => handleSelectAllPending(Boolean(checked))}
                    disabled={pendingRows.length === 0}
                  />
                </TableHead>
                <TableHead>รหัสจ่ายเงิน</TableHead>
                <TableHead>ผู้รับเงิน</TableHead>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead className="text-right">อัตรา</TableHead>
                <TableHead className="text-right">ย้อนหลัง</TableHead>
                <TableHead className="text-right">ยอดจ่าย</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="w-[120px]">ดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                    ไม่พบรายการจ่ายเงิน
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((row) => (
                  <TableRow key={row.payout_id}>
                    <TableCell>
                      {row.payment_status === 'PENDING' && (
                        <Checkbox
                          checked={selectedIds.includes(row.payout_id)}
                          onCheckedChange={(checked) =>
                            handleSelectRow(row.payout_id, Boolean(checked))
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{row.payout_id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.employee_name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{row.citizen_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{row.department || '-'}</TableCell>
                    <TableCell className="text-right">{formatThaiCurrency(row.pts_rate_snapshot)}</TableCell>
                    <TableCell className="text-right">{formatThaiCurrency(row.retroactive_amount)}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {formatThaiCurrency(row.total_payable)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getStatusBadge(row.payment_status)}
                        {row.payment_status === 'PAID' && (
                          <p className="text-xs text-muted-foreground">{formatDateTime(row.paid_at)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.payment_status === 'PENDING' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => handleMarkSinglePaid(row)}
                            disabled={markPaidMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => {
                              setTargetPayout(row);
                              setCancelReason('');
                              setCancelDialogOpen(true);
                            }}
                            disabled={cancelPayoutMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการจ่ายเงินแบบกลุ่ม</DialogTitle>
            <DialogDescription>
              คุณกำลังจะจ่ายเงิน {selectedIds.length} รายการ
              <br />
              ยอดรวม <span className="font-semibold text-emerald-600">{formatThaiCurrency(selectedTotal)}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleBatchMarkPaid}
              disabled={batchMarkPaidMutation.isPending || selectedIds.length === 0}
            >
              ยืนยันจ่ายเงิน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              ยืนยันการยกเลิกรายการ
            </DialogTitle>
            <DialogDescription>
              {targetPayout
                ? `คุณกำลังจะยกเลิกรายการของ ${targetPayout.employee_name}`
                : 'กรุณาตรวจสอบรายการก่อนยืนยัน'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">เหตุผลการยกเลิก</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setActionError(null);
              }}
              placeholder="ระบุเหตุผล..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              ปิด
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelPayout}
              disabled={cancelPayoutMutation.isPending}
            >
              ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
