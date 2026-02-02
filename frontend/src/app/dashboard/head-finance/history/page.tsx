"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePeriods, useSearchPayouts } from "@/features/payroll/hooks";
import { getPeriodStatusLabel, toPeriodLabel } from "@/features/payroll/period-utils";
import type { PayoutSearchRow, PayPeriod } from "@/features/payroll/api";

export default function HeadFinanceHistoryPage() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { data: periods } = usePeriods();
  const periodRows = useMemo(() => (periods as PayPeriod[] | undefined) ?? [], [periods]);

  const searchParams = useMemo(() => {
    return {
      q: query.trim(),
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    };
  }, [query, year, month]);

  const search = useSearchPayouts(searchParams);
  const periodStatusById = useMemo(() => {
    return new Map(periodRows.map((p) => [p.period_id, p.status]));
  }, [periodRows]);

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(periodRows.map((p) => p.status)));
    return unique.sort();
  }, [periodRows]);

  const filteredResults = useMemo(() => {
    const rows = (search.data ?? []) as PayoutSearchRow[];
    if (statusFilter === "ALL") return rows;
    return rows.filter((row) => periodStatusById.get(row.period_id) === statusFilter);
  }, [search.data, statusFilter, periodStatusById]);

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
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">เลือกจากงวด</div>
            <Select
              value={periodId}
              onValueChange={(value) => {
                setPeriodId(value);
                const selected = periodRows.find((p) => String(p.period_id) === value);
                if (selected) {
                  setYear(String(selected.period_year));
                  setMonth(String(selected.period_month));
                }
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="เลือกงวด" />
              </SelectTrigger>
              <SelectContent>
                {periodRows.map((p) => (
                  <SelectItem key={p.period_id} value={String(p.period_id)}>
                    {toPeriodLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">สถานะงวด</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทั้งหมด</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {getPeriodStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => search.refetch()} disabled={!query.trim()}>
            ค้นหา
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setYear("");
              setMonth("");
              setPeriodId("");
              setStatusFilter("ALL");
            }}
          >
            รีเซ็ตตัวกรอง
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
                {filteredResults.map((row: PayoutSearchRow) => (
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
                        <Link href={`/dashboard/head-finance/budget-check/${row.period_id}`}>ดูงวด</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredResults.length === 0 && (
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
