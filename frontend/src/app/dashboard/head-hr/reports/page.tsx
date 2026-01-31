"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDownloadDetailReport, useDownloadSummaryReport } from "@/features/report/hooks";

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function HrReportsPage() {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [profession, setProfession] = useState("");

  const detailReport = useDownloadDetailReport();
  const summaryReport = useDownloadSummaryReport();

  const params = useMemo(() => {
    const y = year ? Number(year) : undefined;
    const m = month ? Number(month) : undefined;
    return {
      year: y,
      month: m,
      profession: profession.trim() ? profession.trim() : undefined,
    };
  }, [year, month, profession]);

  const isValid = Boolean(params.year && params.month);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ดาวน์โหลดรายงาน</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">ปี</div>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="เช่น 2025" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">เดือน</div>
            <Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="1-12" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">รหัสวิชาชีพ (เฉพาะรายละเอียด)</div>
            <Input
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="เช่น NURSE"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายงานแบบสรุป</CardTitle>
        </CardHeader>
        <CardContent>
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
