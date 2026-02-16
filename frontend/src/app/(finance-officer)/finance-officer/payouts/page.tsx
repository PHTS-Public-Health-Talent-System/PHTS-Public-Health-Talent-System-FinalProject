'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Download, Filter, Search, Wallet, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useFinanceSummary } from '@/features/finance/hooks';
import {
  formatThaiCurrency,
  formatThaiMonthYear,
  formatThaiNumber,
  toBuddhistYear,
} from '@/shared/utils/thai-locale';

type FinanceSummaryRow = {
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

const toPeriodCode = (month: number, year: number) => {
  return `PAY-${String(month).padStart(2, '0')}/${toBuddhistYear(year)}`;
};

const escapeCsv = (value: string | number) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export default function PayoutsPage() {
  const { data, isLoading, error } = useFinanceSummary();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  const periods = useMemo<FinanceSummaryRow[]>(() => {
    if (!Array.isArray(data)) return [];
    return (data as FinanceSummaryRow[]).map((row) => ({
      ...row,
      total_employees: Number(row.total_employees ?? 0),
      total_amount: Number(row.total_amount ?? 0),
      paid_amount: Number(row.paid_amount ?? 0),
      pending_amount: Number(row.pending_amount ?? 0),
      paid_count: Number(row.paid_count ?? 0),
      pending_count: Number(row.pending_count ?? 0),
    }));
  }, [data]);

  const filteredPeriods = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return periods.filter((row) => {
      const monthLabel = formatThaiMonthYear(row.period_month, row.period_year);
      const periodCode = toPeriodCode(row.period_month, row.period_year);
      const yearLabel = String(toBuddhistYear(row.period_year));
      const open = row.pending_count > 0 || row.pending_amount > 0;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && open) ||
        (statusFilter === 'closed' && !open);
      const matchesSearch =
        !keyword ||
        monthLabel.toLowerCase().includes(keyword) ||
        periodCode.toLowerCase().includes(keyword) ||
        yearLabel.includes(keyword) ||
        String(row.period_year).includes(keyword);
      return matchesStatus && matchesSearch;
    });
  }, [periods, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const totalPeriods = filteredPeriods.length;
    const openPeriods = filteredPeriods.filter(
      (row) => row.pending_count > 0 || row.pending_amount > 0,
    ).length;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const pendingAmount = filteredPeriods.reduce((sum, row) => sum + row.pending_amount, 0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const paidAmount = filteredPeriods.reduce((sum, row) => sum + row.paid_amount, 0);
    return { totalPeriods, openPeriods };
  }, [filteredPeriods]);

  const handleExport = () => {
    if (filteredPeriods.length === 0) {
      toast.error('ไม่พบข้อมูลรอบจ่ายสำหรับส่งออก');
      return;
    }
    const headers = [
      'รหัสรอบ',
      'เดือน/ปี',
      'จำนวนผู้รับเงิน',
      'ยอดรวม',
      'ยอดจ่ายแล้ว',
      'ยอดคงค้าง',
      'จำนวนรายการคงค้าง',
    ];
    const rows = filteredPeriods.map((row) => [
      toPeriodCode(row.period_month, row.period_year),
      formatThaiMonthYear(row.period_month, row.period_year),
      row.total_employees,
      row.total_amount,
      row.paid_amount,
      row.pending_amount,
      row.pending_count,
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finance-periods.csv';
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('ส่งออกรายการรอบจ่ายสำเร็จ');
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        <h1 className="text-2xl font-bold">เกิดข้อผิดพลาด</h1>
        <p className="mt-2">ไม่สามารถโหลดข้อมูลรอบจ่ายได้ กรุณาลองใหม่อีกครั้ง</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> จัดการการจ่ายเงิน
          </h1>
          <p className="text-muted-foreground mt-1">
            ตรวจสอบสถานะและดำเนินการโอนเงินสำหรับแต่ละรอบเดือน
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} className="bg-background">
            <Download className="mr-2 h-4 w-4" /> ส่งออก CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">รอบจ่ายทั้งหมด</p>
              <div className="text-2xl font-bold mt-1">{summary.totalPeriods}</div>
            </div>
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">รอบที่มียอดค้างจ่าย</p>
              <div className="text-2xl font-bold mt-1 text-amber-600">{summary.openPeriods}</div>
            </div>
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-600">
              <Wallet className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">รายการรอบจ่าย</CardTitle>
              <CardDescription>แสดงรายการแยกตามเดือน</CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาเดือน, ปี, รหัส..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background pl-9 h-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as 'all' | 'open' | 'closed')}
              >
                <SelectTrigger className="w-full sm:w-[150px] bg-background h-9">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="สถานะ" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="open">ค้างจ่าย</SelectItem>
                  <SelectItem value="closed">จ่ายครบ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[140px]">รหัสรอบ</TableHead>
                  <TableHead>เดือน/ปี</TableHead>
                  <TableHead className="text-right">จำนวนผู้รับเงิน</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                  <TableHead className="text-right">จ่ายแล้ว</TableHead>
                  <TableHead className="text-right">คงค้าง</TableHead>
                  <TableHead className="text-center w-[140px]">สถานะ</TableHead>
                  <TableHead className="text-right w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeriods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      ไม่พบข้อมูลรอบจ่าย
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPeriods.map((row) => {
                    const isOpen = row.pending_count > 0 || row.pending_amount > 0;
                    return (
                      <TableRow key={row.period_id} className="hover:bg-muted/20 group">
                        <TableCell className="font-mono text-sm text-muted-foreground group-hover:text-primary transition-colors">
                          {toPeriodCode(row.period_month, row.period_year)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatThaiMonthYear(row.period_month, row.period_year)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatThaiNumber(row.total_employees)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatThaiCurrency(row.total_amount)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {formatThaiCurrency(row.paid_amount)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {formatThaiCurrency(row.pending_amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isOpen ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700 font-normal"
                            >
                              รอดำเนินการ
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 font-normal"
                            >
                              จ่ายครบแล้ว
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Link
                              href={`/finance-officer/payouts/${row.period_id}`}
                              title="ดูรายละเอียด"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
