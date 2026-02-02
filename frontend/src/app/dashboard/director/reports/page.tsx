"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDownloadDetailReport, useDownloadSummaryReport } from "@/features/report/hooks";
import { usePeriods } from "@/features/payroll/hooks";
import { toPeriodLabel } from "@/features/payroll/period-utils";
import type { PayPeriod } from "@/features/payroll/api";

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function DirectorReportsPage() {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [profession, setProfession] = useState("");
  const [periodId, setPeriodId] = useState("");

  const detailReport = useDownloadDetailReport();
  const summaryReport = useDownloadSummaryReport();
  const { data: periods } = usePeriods();
  const periodRows = (periods as PayPeriod[] | undefined) ?? [];
  const latestClosed = periodRows.find((p) => p.status === "CLOSED");

  const params = useMemo(() => {
    const y = year ? Number(year) : undefined;
    const m = month ? Number(month) : undefined;
    return {
      year: y,
      month: m,
      profession: profession.trim() ? profession.trim() : undefined,
    };
  }, [year, month, profession]);

  const selectedPeriod = periodId
    ? periodRows.find((p) => String(p.period_id) === periodId)
    : periodRows.find(
        (p) =>
          String(p.period_year) === String(params.year ?? "") &&
          String(p.period_month) === String(params.month ?? ""),
      );
  const isClosed = selectedPeriod?.status === "CLOSED";
  const isValid = Boolean(params.year && params.month && isClosed);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ดาวน์โหลดรายงาน</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">ปี</div>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="เช่น 2025" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">เดือน</div>
            <Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="1-12" />
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
              <SelectTrigger className="w-full">
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
            <div className="text-sm text-muted-foreground">รหัสวิชาชีพ (เฉพาะรายละเอียด)</div>
            <Input
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="เช่น NURSE"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!latestClosed) return;
                setYear(String(latestClosed.period_year));
                setMonth(String(latestClosed.period_month));
                setPeriodId(String(latestClosed.period_id));
              }}
              disabled={!latestClosed}
            >
              ใช้งวดล่าสุดที่ปิดแล้ว
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายงานแบบสรุป</CardTitle>
        </CardHeader>
        <CardContent>
          {!isClosed && (
            <div className="text-xs text-muted-foreground mb-2">
              รายงานดาวน์โหลดได้เฉพาะงวดที่ปิดแล้วเท่านั้น
            </div>
          )}
          <Button
            onClick={async () => {
              const blob = await summaryReport.mutateAsync({ year: params.year, month: params.month });
              const filename = `PTS_Summary_${params.year}_${params.month}.xlsx`;
              triggerDownload(blob, filename);
            }}
            disabled={!isValid || summaryReport.isPending}
          >
            {summaryReport.isPending ? "กำลังสร้างรายงาน..." : "ดาวน์โหลดรายงานสรุป"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายงานแบบละเอียด</CardTitle>
        </CardHeader>
        <CardContent>
          {!isClosed && (
            <div className="text-xs text-muted-foreground mb-2">
              รายงานดาวน์โหลดได้เฉพาะงวดที่ปิดแล้วเท่านั้น
            </div>
          )}
          <Button
            onClick={async () => {
              const blob = await detailReport.mutateAsync({
                year: params.year,
                month: params.month,
                profession: params.profession,
              });
              const suffix = params.profession ? params.profession : "ALL";
              const filename = `PTS_Detail_${suffix}_${params.year}_${params.month}.xlsx`;
              triggerDownload(blob, filename);
            }}
            disabled={!isValid || detailReport.isPending}
          >
            {detailReport.isPending ? "กำลังสร้างรายงาน..." : "ดาวน์โหลดรายงานละเอียด"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
