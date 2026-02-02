"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { usePeriods } from "@/features/payroll/hooks";
import { getPeriodStatusLabel, toPeriodLabel } from "@/features/payroll/period-utils";
import { FileCheck, ArrowRight, ShieldCheck } from "lucide-react";
import type { PayPeriod } from "@/features/payroll/api";

export default function HrPayrollCheckPage() {
  const { data, isLoading } = usePeriods();
  const rows = (data ?? []).filter((p: PayPeriod) => p.status === "WAITING_HR");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-primary/5 p-6 rounded-xl border border-primary/10 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
             ตรวจสอบงวดการจ่าย (HR)
          </h2>
          <p className="text-muted-foreground mt-1">
             รายการงวดที่รอการตรวจสอบและยืนยันข้อมูลโดย HR
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
      </div>

      <Card>
        <CardHeader>
           <CardTitle className="flex items-center gap-2 text-base">
               <ShieldCheck className="h-5 w-5 text-primary" /> รายการรอตรวจสอบ
           </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">กำลังโหลดข้อมูล...</div>
          ) : (
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                    <TableHead>งวด</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จำนวนคน</TableHead>
                    <TableHead className="text-right">ยอดรวม (บาท)</TableHead>
                    <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((period: PayPeriod) => (
                    <TableRow key={period.period_id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{toPeriodLabel(period)}</TableCell>
                        <TableCell>{getPeriodStatusLabel(period.status)}</TableCell>
                        <TableCell className="text-right font-mono">{period.total_headcount ?? 0}</TableCell>
                        <TableCell className="text-right font-mono">{Number(period.total_amount ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                        <Button asChild size="sm" className="shadow-none">
                            <Link href={`/dashboard/head-hr/payroll-check/${period.period_id}`}>
                                ตรวจสอบ <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                    {rows.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            <FileCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            ยังไม่มีงวดที่รออนุมัติในขณะนี้
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
  );
}
