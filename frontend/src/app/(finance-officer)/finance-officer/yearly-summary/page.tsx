'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useFinanceSummary } from '@/features/finance/hooks';
import { toast } from 'sonner';
import { Download, TrendingUp, Users, Wallet, Landmark, PieChart } from 'lucide-react';
import {
  formatThaiCurrency,
  formatThaiMonthYear,
  formatThaiNumber,
  toBuddhistYear,
  toGregorianYear,
} from '@/shared/utils/thai-locale';

type MonthlySummaryRow = {
  period_id: number;
  period_month: number;
  period_year: number;
  period_status: string;
  is_frozen: boolean | number;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  pending_count: number;
};

const escapeCsv = (value: string | number) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export default function YearlySummaryPage() {
  const currentYear = toGregorianYear(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const summaryQuery = useFinanceSummary();

  const allPeriods = useMemo<MonthlySummaryRow[]>(() => {
    if (!Array.isArray(summaryQuery.data)) return [];
    return (summaryQuery.data as MonthlySummaryRow[]).map((row) => ({
      period_id: Number(row.period_id ?? 0),
      period_month: Number(row.period_month ?? 0),
      period_year: toGregorianYear(Number(row.period_year ?? 0)),
      period_status: String(row.period_status ?? ''),
      is_frozen: row.is_frozen ?? 0,
      total_employees: Number(row.total_employees ?? 0),
      total_amount: Number(row.total_amount ?? 0),
      paid_amount: Number(row.paid_amount ?? 0),
      pending_amount: Number(row.pending_amount ?? 0),
      pending_count: Number(row.pending_count ?? 0),
    }));
  }, [summaryQuery.data]);

  const reportablePeriods = useMemo(
    () =>
      allPeriods.filter(
        (row) => row.period_status === 'CLOSED' && (row.is_frozen === true || row.is_frozen === 1),
      ),
    [allPeriods],
  );

  const availableYears = useMemo(
    () => Array.from(new Set(reportablePeriods.map((row) => row.period_year))).sort((a, b) => b - a),
    [reportablePeriods],
  );

  const resolvedSelectedYear = useMemo(() => {
    if (availableYears.length === 0) return selectedYear;
    return availableYears.includes(selectedYear) ? selectedYear : availableYears[0];
  }, [availableYears, selectedYear]);

  const monthlyRows = useMemo<MonthlySummaryRow[]>(() => {
    return reportablePeriods
      .filter((row) => row.period_year === resolvedSelectedYear)
      .sort((a, b) => b.period_month - a.period_month);
  }, [reportablePeriods, resolvedSelectedYear]);

  const annualFinance = useMemo(() => {
    return monthlyRows.reduce(
      (acc, row) => {
        acc.totalEmployees += row.total_employees;
        acc.totalAmount += row.total_amount;
        acc.paidAmount += row.paid_amount;
        acc.pendingAmount += row.pending_amount;
        return acc;
      },
      { totalEmployees: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 },
    );
  }, [monthlyRows]);

  const paidRatio =
    annualFinance.totalAmount > 0
      ? (annualFinance.paidAmount / annualFinance.totalAmount) * 100
      : 0;

  const yearlyTotals = useMemo(() => {
    const map = new Map<number, { totalAmount: number }>();
    for (const row of reportablePeriods) {
      const existing = map.get(row.period_year) ?? { totalAmount: 0 };
      existing.totalAmount += row.total_amount;
      map.set(row.period_year, existing);
    }
    return Array.from(map.entries())
      .map(([year, totals]) => ({ year, totalAmount: totals.totalAmount }))
      .sort((a, b) => b.year - a.year);
  }, [reportablePeriods]);

  const growthRate = useMemo(() => {
    const idx = yearlyTotals.findIndex((entry) => entry.year === resolvedSelectedYear);
    if (idx < 0) return 0;
    const current = yearlyTotals[idx];
    const previous = yearlyTotals[idx + 1];
    if (!previous || previous.totalAmount <= 0) return 0;
    return ((current.totalAmount - previous.totalAmount) / previous.totalAmount) * 100;
  }, [yearlyTotals, resolvedSelectedYear]);

  const handleExport = () => {
    if (monthlyRows.length === 0) {
      toast.error('ไม่พบข้อมูลสำหรับปีที่เลือก');
      return;
    }

    const rows = [
      ['ปี (พ.ศ.)', toBuddhistYear(resolvedSelectedYear)],
      ['จำนวนผู้รับเงิน', annualFinance.totalEmployees],
      ['งบประมาณรวม', annualFinance.totalAmount],
      ['เบิกจ่ายแล้ว', annualFinance.paidAmount],
      ['ภาระผูกพันคงค้าง', annualFinance.pendingAmount],
      ['สัดส่วนการเบิกจ่าย (%)', paidRatio.toFixed(2)],
    ];
    const csv =
      '\uFEFF' + ['หัวข้อ,ค่า', ...rows.map((line) => line.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-yearly-summary-${toBuddhistYear(resolvedSelectedYear)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('ส่งออกรายงานสำเร็จ');
  };

  if (summaryQuery.isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <PieChart className="h-6 w-6 text-primary" /> สรุปการเงินรายปี
          </h1>
          <p className="text-muted-foreground mt-1">แสดงเฉพาะงวดที่ผู้บริหารอนุมัติแล้วและปิดรอบสมบูรณ์</p>
        </div>
        <div className="flex gap-3">
          <Select
            value={String(resolvedSelectedYear)}
            onValueChange={(value) => setSelectedYear(Number(value))}
            disabled={availableYears.length === 0}
          >
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="เลือกปี (พ.ศ.)" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  พ.ศ. {toBuddhistYear(year)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} className="bg-background">
            <Download className="mr-2 h-4 w-4" />
            ส่งออก CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              งบประมาณรวมทั้งปี
            </CardTitle>
            <Landmark className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatThaiCurrency(annualFinance.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ปีงบประมาณ {toBuddhistYear(resolvedSelectedYear)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              เบิกจ่ายแล้ว
            </CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatThaiCurrency(annualFinance.paidAmount)}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">ความคืบหน้า</span>
                <span className="font-medium text-emerald-600">{paidRatio.toFixed(1)}%</span>
              </div>
              <Progress value={paidRatio} className="h-1.5 bg-emerald-100" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ภาระผูกพันคงค้าง
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatThaiCurrency(annualFinance.pendingAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">รอการดำเนินการจ่าย</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              จำนวนบุคลากร
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatThaiNumber(annualFinance.totalEmployees)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              เติบโตเทียบปีก่อน {growthRate >= 0 ? '+' : ''}
              {growthRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            รายละเอียดรายเดือน
          </CardTitle>
          <CardDescription>
            แสดงรายการเบิกจ่ายแยกตามเดือน ประจำปีงบประมาณ {toBuddhistYear(resolvedSelectedYear)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[200px]">เดือน/ปี</TableHead>
                <TableHead className="text-right">จำนวนผู้รับเงิน</TableHead>
                <TableHead className="text-right">ยอดรวม (บาท)</TableHead>
                <TableHead className="text-right text-emerald-600">จ่ายแล้ว (บาท)</TableHead>
                <TableHead className="text-right text-amber-600">คงค้าง (บาท)</TableHead>
                <TableHead className="text-center w-[150px]">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    ไม่มีข้อมูลการเบิกจ่ายในปีนี้
                  </TableCell>
                </TableRow>
              ) : (
                monthlyRows.map((row) => {
                  const isFullyPaid = row.pending_amount <= 0 && row.pending_count <= 0;
                  return (
                    <TableRow key={row.period_id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        {formatThaiMonthYear(row.period_month, row.period_year)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatThaiNumber(row.total_employees)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatThaiCurrency(row.total_amount)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 font-medium">
                        {formatThaiCurrency(row.paid_amount)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600 font-medium">
                        {formatThaiCurrency(row.pending_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isFullyPaid ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal"
                          >
                            จ่ายครบแล้ว
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 font-normal"
                          >
                            มีรายการคงค้าง
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
