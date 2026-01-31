"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { usePeriods } from "@/features/payroll/hooks";
import { getPeriodStatusLabel, toPeriodLabel } from "@/features/payroll/period-utils";
import type { PayPeriod } from "@/features/payroll/api";

export default function HrPayrollCheckPage() {
  const { data, isLoading } = usePeriods();
  const rows = (data ?? []).filter((p: PayPeriod) => p.status === "WAITING_HR");

  return (
    <Card>
      <CardHeader>
        <CardTitle>งวดรออนุมัติ (HR)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>งวด</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จำนวนคน</TableHead>
                <TableHead className="text-right">ยอดรวม</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((period: PayPeriod) => (
                <TableRow key={period.period_id}>
                  <TableCell>{toPeriodLabel(period)}</TableCell>
                  <TableCell>{getPeriodStatusLabel(period.status)}</TableCell>
                  <TableCell className="text-right">{period.total_headcount ?? 0}</TableCell>
                  <TableCell className="text-right">{Number(period.total_amount ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/head-hr/payroll-check/${period.period_id}`}>ตรวจสอบ</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    ยังไม่มีงวดที่รออนุมัติ
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
