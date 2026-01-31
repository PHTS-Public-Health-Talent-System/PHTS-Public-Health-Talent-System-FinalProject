"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePeriods, useSearchPayouts } from "@/features/payroll/hooks";
import { toPeriodLabel } from "@/features/payroll/period-utils";
import type { PayoutSearchRow, PayPeriod } from "@/features/payroll/api";

export default function HrPayrollHistoryPage() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const { data: periods } = usePeriods();

  const searchParams = useMemo(() => {
    return {
      q: query.trim(),
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    };
  }, [query, year, month]);

  const search = useSearchPayouts(searchParams);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ค้นหา/ตรวจย้อนหลัง</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">คำค้นหา (ชื่อ/เลขบัตร/ตำแหน่ง)</div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="w-80" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">ปี</div>
            <Input value={year} onChange={(e) => setYear(e.target.value)} className="w-24" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">เดือน</div>
            <Input value={month} onChange={(e) => setMonth(e.target.value)} className="w-20" />
          </div>
          <Button onClick={() => search.refetch()} disabled={!query.trim()}>
            ค้นหา
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ผลการค้นหา</CardTitle>
        </CardHeader>
        <CardContent>
          {search.isLoading ? (
            <div className="text-sm text-muted-foreground">กำลังค้นหา...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>งวด</TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead className="text-right">อัตรา</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(search.data ?? []).map((row: PayoutSearchRow) => (
                  <TableRow key={row.payout_id}>
                    <TableCell>
                      {row.period_month && row.period_year
                        ? toPeriodLabel({ period_month: row.period_month, period_year: row.period_year })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {row.first_name ?? ""} {row.last_name ?? ""} ({row.citizen_id})
                    </TableCell>
                    <TableCell>{row.position_name ?? "-"}</TableCell>
                    <TableCell className="text-right">{Number(row.pts_rate_snapshot ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(row.total_payable ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/head-hr/payroll-check/${row.period_id}`}>ดูงวด</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(search.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      ยังไม่มีผลลัพธ์
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {periods && (periods as PayPeriod[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>งวดล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {toPeriodLabel((periods as PayPeriod[])[0])}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
