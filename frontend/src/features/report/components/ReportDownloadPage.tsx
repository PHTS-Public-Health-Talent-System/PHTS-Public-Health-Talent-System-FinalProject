'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  FileSpreadsheet,
  Calculator,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useDownloadDetailReport, useDownloadSummaryReport } from '@/features/report/hooks';
import { usePeriods } from '@/features/payroll/hooks';
import type { PayPeriod } from '@/features/payroll/api';
import { formatThaiMonthYear } from '@/shared/utils/thai-locale';

type ReportType = 'detail' | 'summary';
type ReportFormat = 'xlsx' | 'csv';

type PeriodOption = {
  id: string;
  year: number;
  month: number;
  label: string;
};

type ReportDownloadPageProps = {
  title?: string;
  description?: string;
};

const formatPeriodLabel = (month: number, year: number) => {
  return formatThaiMonthYear(month, year);
};

const isFrozenPeriod = (period: PayPeriod) => period.is_frozen === true || period.is_frozen === 1;

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export function ReportDownloadPage({
  title = 'ดาวน์โหลดรายงาน',
  description = 'เลือกงวดและรูปแบบไฟล์ที่ต้องการ (Excel/CSV)',
}: ReportDownloadPageProps) {
  const periodsQuery = usePeriods();
  const detailReport = useDownloadDetailReport();
  const summaryReport = useDownloadSummaryReport();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [customReportType, setCustomReportType] = useState<ReportType>('summary');
  const [customFormat, setCustomFormat] = useState<ReportFormat>('xlsx');

  const periodOptions = useMemo<PeriodOption[]>(() => {
    const periods = (periodsQuery.data ?? []) as PayPeriod[];
    return [...periods]
      .filter((period) => period.status === 'CLOSED' && isFrozenPeriod(period))
      .sort((a, b) => {
        if (b.period_year !== a.period_year) return b.period_year - a.period_year;
        return b.period_month - a.period_month;
      })
      .map((period) => ({
        id: String(period.period_id),
        year: period.period_year,
        month: period.period_month,
        label: formatPeriodLabel(period.period_month, period.period_year),
      }));
  }, [periodsQuery.data]);

  const effectivePeriod = useMemo(() => {
    if (selectedPeriodId)
      return periodOptions.find((period) => period.id === selectedPeriodId) ?? null;
    return periodOptions[0] ?? null;
  }, [periodOptions, selectedPeriodId]);

  const isDownloading = detailReport.isPending || summaryReport.isPending;

  const handleDownload = async (type: ReportType, format: ReportFormat) => {
    if (!effectivePeriod) {
      toast.error('ไม่พบงวดสำหรับออกรายงาน');
      return;
    }

    const params = {
      year: effectivePeriod.year,
      month: effectivePeriod.month,
      format,
    };

    try {
      const blob =
        type === 'detail'
          ? await detailReport.mutateAsync(params)
          : await summaryReport.mutateAsync(params);
      const filename = `PTS_${type}_${effectivePeriod.year}_${effectivePeriod.month}.${format}`;
      saveBlob(blob, filename);
      toast.success(`ดาวน์โหลดรายงาน${type === 'detail' ? 'รายละเอียด' : 'สรุปยอด'}สำเร็จ`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถดาวน์โหลดรายงานได้';
      toast.error(message);
    }
  };

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border">
          <span className="text-sm font-medium pl-2">งวดประจำเดือน:</span>
          <Select
            value={selectedPeriodId || periodOptions[0]?.id}
            onValueChange={setSelectedPeriodId}
          >
            <SelectTrigger className="w-[200px] bg-background shadow-sm border-input">
              <SelectValue placeholder="เลือกงวด" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.length > 0 ? (
                periodOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-xs text-muted-foreground text-center">
                  ไม่มีงวดที่ปิดรอบแล้ว
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {periodOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl bg-muted/10 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">ไม่พบข้อมูลรายงาน</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            ยังไม่มีงวดการจ่ายเงินที่ปิดรอบสมบูรณ์และพร้อมสำหรับออกรายงานในขณะนี้
          </p>
        </div>
      ) : (
        <>
          {/* Quick Download Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow cursor-default group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      รายงานรายละเอียด
                    </CardTitle>
                    <CardDescription className="mt-1">
                      แสดงรายการรายบุคคล รายละเอียดกลุ่มงาน และจำนวนเงิน
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    แนะนำ
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => handleDownload('detail', 'xlsx')}
                    disabled={isDownloading}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleDownload('detail', 'csv')}
                    disabled={isDownloading}
                  >
                    <FileText className="h-4 w-4" /> CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm hover:shadow-md transition-shadow cursor-default group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-emerald-600" />
                      รายงานสรุปยอด
                    </CardTitle>
                    <CardDescription className="mt-1">
                      แสดงยอดรวมแยกตามกลุ่มงานและประเภทบุคลากร
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1 gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 border"
                    onClick={() => handleDownload('summary', 'xlsx')}
                    disabled={isDownloading}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleDownload('summary', 'csv')}
                    disabled={isDownloading}
                  >
                    <FileText className="h-4 w-4" /> CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Custom Report Section */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b bg-muted/10 py-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                สร้างรายงานแบบกำหนดเอง
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/3 space-y-2">
                  <label className="text-sm font-medium">ประเภทรายงาน</label>
                  <Select
                    value={customReportType}
                    onValueChange={(value) => setCustomReportType(value as ReportType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detail">รายงานรายละเอียด</SelectItem>
                      <SelectItem value="summary">รายงานสรุปยอด</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-1/3 space-y-2">
                  <label className="text-sm font-medium">รูปแบบไฟล์</label>
                  <Select
                    value={customFormat}
                    onValueChange={(value) => setCustomFormat(value as ReportFormat)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">ไฟล์เอ็กเซล (.xlsx)</SelectItem>
                      <SelectItem value="csv">ไฟล์ซีเอสวี (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-1/3">
                  <Button
                    className="w-full"
                    disabled={isDownloading}
                    onClick={() => handleDownload(customReportType, customFormat)}
                  >
                    {isDownloading ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
