"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Calendar, Settings2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreatePeriod, usePeriods } from "@/features/payroll/hooks";
import { getPeriodStatusLabel, toPeriodLabel } from "@/features/payroll/period-utils";
import type { PayPeriod } from "@/features/payroll/api";

export default function PayrollPeriodsPage() {
  const { data, isLoading } = usePeriods();
  const createPeriod = useCreatePeriod();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  const handleCreate = () => {
    const payload = {
      year: Number(year),
      month: Number(month),
    };
    createPeriod.mutate(payload);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-primary/5 p-6 rounded-xl border border-primary/10 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            จัดการงวดการจ่าย
          </h2>
          <p className="text-muted-foreground mt-1">
            สร้างและบริหารจัดการงวดเงินเดือน (Payroll Cycles)
          </p>
        </div>
         <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Create Period Section */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> สร้างงวดใหม่
            </CardTitle>
            <CardDescription>ระบุปีและเดือนเพื่อเริ่มงวดใหม่</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>ปี (ค.ศ.)</Label>
                    <Input
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="font-mono text-center"
                    />
                </div>
                <div className="space-y-2">
                    <Label>เดือน (1-12)</Label>
                    <Input
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="font-mono text-center"
                    />
                </div>
            </div>
            <Button onClick={handleCreate} disabled={createPeriod.isPending} className="w-full">
              {createPeriod.isPending ? "กำลังสร้าง..." : "ยืนยันการสร้างงวด"}
            </Button>
          </CardContent>
        </Card>

        {/* Periods List Section */}
        <Card className="md:col-span-2">
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
                 <Calendar className="h-5 w-5 text-primary" /> ประวัติงวดทั้งหมด
             </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-8">กำลังโหลดข้อมูล...</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[180px]">งวด</TableHead>
                            <TableHead>สถานะ</TableHead>
                            <TableHead className="text-right">จำนวนคน</TableHead>
                            <TableHead className="text-right">ยอดรวม (บาท)</TableHead>
                            <TableHead />
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {(data ?? []).map((period: PayPeriod) => (
                            <TableRow key={period.period_id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{toPeriodLabel(period)}</TableCell>
                            <TableCell>{getPeriodStatusLabel(period.status)}</TableCell>
                            <TableCell className="text-right font-mono">{period.total_headcount ?? 0}</TableCell>
                            <TableCell className="text-right font-mono">{Number(period.total_amount ?? 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                                <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Link href={`/dashboard/pts-officer/payroll/${period.period_id}`}>
                                    <Settings2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                </Link>
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        {data?.length === 0 && (
                            <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                ยังไม่มีงวดการจ่ายในระบบ
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
