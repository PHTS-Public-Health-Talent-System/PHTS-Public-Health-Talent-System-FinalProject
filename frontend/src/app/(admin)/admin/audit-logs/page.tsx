'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Download,
  Eye,
  Filter,
  ActivitySquare,
  FileJson,
  ClipboardCopy,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import {
  useAuditEventTypes,
  useAuditEvents,
  useExportAuditEvents,
  type AuditSearchResult,
  type AuditEventRow,
  type AuditEventTypeOption,
} from '@/features/audit/logs';
import { useAuditSummary, type AuditSummaryRow } from '@/features/audit/summary';
import { toast } from 'sonner';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuditLogsPage() {
  // --- State ---
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditEventRow | null>(null);
  const limit = 50;

  // --- Hooks ---
  const eventsQuery = useAuditEvents({
    page,
    limit,
    eventType: eventType === 'all' ? undefined : eventType,
    search: search.trim() || undefined,
  });
  const eventTypesQuery = useAuditEventTypes();
  const summaryQuery = useAuditSummary();
  const exportMutation = useExportAuditEvents();

  // --- Data Processing ---
  const result = (eventsQuery.data ?? {
    events: [],
    total: 0,
    page: 1,
    limit: 50,
  }) as AuditSearchResult;
  const eventTypes = ((eventTypesQuery.data ?? []) as AuditEventTypeOption[]).map((x) => x.value);
  const totalPages = Math.max(1, Math.ceil((result.total || 0) / (result.limit || limit)));
  const fromItem = result.total === 0 ? 0 : (result.page - 1) * result.limit + 1;
  const toItem = Math.min(result.page * result.limit, result.total);

  const topSummary = useMemo(
    () => ((summaryQuery.data ?? []) as AuditSummaryRow[]).slice(0, 3),
    [summaryQuery.data],
  );

  // --- Handlers ---
  const handleExportCsv = async () => {
    const promise = exportMutation.mutateAsync({
      eventType: eventType === 'all' ? undefined : eventType,
      search: search.trim() || undefined,
    });

    toast.promise(promise, {
      loading: 'กำลังเตรียมไฟล์ส่งออก...',
      success: 'เริ่มดาวน์โหลดไฟล์ CSV แล้ว',
      error: 'ไม่สามารถส่งออกข้อมูลได้',
    });

    try {
      const exportData = (await promise) as { events?: AuditEventRow[] };
      const rows = Array.isArray(exportData.events) ? exportData.events : [];

      if (rows.length === 0) return;

      const headers = [
        'audit_id',
        'event_type',
        'entity_type',
        'entity_id',
        'actor_name',
        'actor_role',
        'ip_address',
        'created_at',
        'details',
      ];
      const body = rows.map((r) => [
        r.audit_id,
        r.event_type,
        r.entity_type,
        r.entity_id ?? '',
        r.actor_name ?? '',
        r.actor_role ?? '',
        r.ip_address ?? '',
        new Date(r.created_at).toISOString(),
        JSON.stringify(r.details || {}),
      ]);

      const csv =
        '\uFEFF' +
        [headers, ...body]
          .map((line) => line.map((v) => String(v ?? '').replace(/"/g, '""')).join(','))
          .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกข้อมูลลงคลิปบอร์ดแล้ว');
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ActivitySquare className="h-6 w-6 text-primary" /> บันทึกการใช้งานระบบ (Audit Logs)
          </h1>
          <p className="text-muted-foreground mt-1">
            ตรวจสอบประวัติการใช้งานและการเปลี่ยนแปลงข้อมูลทั้งหมดที่เกิดขึ้นในระบบ
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={exportMutation.isPending || result.total === 0}
          className="gap-2 bg-background shadow-sm"
        >
          <Download className="h-4 w-4" />
          ส่งออก CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {summaryQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : topSummary.length === 0 ? (
          <div className="md:col-span-3 text-center py-6 text-muted-foreground text-sm border rounded-lg bg-muted/10 border-dashed">
            ไม่มีข้อมูลสรุปเหตุการณ์
          </div>
        ) : (
          topSummary.map((s) => (
            <Card
              key={s.event_type}
              className="border-border shadow-sm bg-gradient-to-br from-background to-muted/20"
            >
              <CardContent className="pt-5 pb-5">
                <p
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate"
                  title={s.event_type}
                >
                  {s.event_type}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    {formatThaiNumber(Number(s.count))}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">ครั้ง</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาไอพีแอดเดรส หรือรหัสข้อมูล..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-10 bg-background"
              />
            </div>
            <Select
              value={eventType}
              onValueChange={(v) => {
                setEventType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-[250px] h-10 bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="ประเภทเหตุการณ์" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภทเหตุการณ์</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card className="border-border shadow-sm overflow-hidden flex flex-col">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">รายการบันทึก (Logs)</CardTitle>
            <Badge variant="secondary" className="font-normal text-xs">
              {formatThaiNumber(result.total)} รายการ
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30 whitespace-nowrap">
              <TableRow>
                <TableHead className="w-[180px]">เวลา</TableHead>
                <TableHead>เหตุการณ์</TableHead>
                <TableHead>ผู้ดำเนินการ</TableHead>
                <TableHead>ข้อมูลที่ได้รับผลกระทบ</TableHead>
                <TableHead className="text-right">ไอพีแอดเดรส</TableHead>
                <TableHead className="w-[50px] sticky right-0 bg-muted/30 backdrop-blur-sm"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </TableCell>
                    <TableCell className="sticky right-0 bg-background">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : result.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Database className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p>ไม่พบข้อมูลบันทึกการใช้งานตามเงื่อนไขที่ระบุ</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                result.events.map((log) => (
                  <TableRow
                    key={log.audit_id}
                    className="group hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono align-top py-4">
                      {formatThaiDateTime(log.created_at, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <Badge
                        variant="outline"
                        className="font-medium bg-background text-[10px] tracking-wide"
                      >
                        {log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm text-foreground">
                          {log.actor_name || 'ระบบ (System)'}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {log.actor_role || 'SYSTEM'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          {log.entity_type}
                        </span>
                        {log.entity_id && (
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            ID: {log.entity_id}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground align-top py-4">
                      {log.ip_address || '-'}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-background group-hover:bg-muted/50 transition-colors align-top py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        title="ดูรายละเอียด"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Footer */}
        <div className="border-t bg-muted/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
          <span className="text-xs text-muted-foreground">
            แสดง{' '}
            <span className="font-medium text-foreground">
              {fromItem}-{toItem}
            </span>{' '}
            จาก{' '}
            <span className="font-medium text-foreground">{formatThaiNumber(result.total)}</span>{' '}
            รายการ
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || eventsQuery.isFetching}
              className="h-8 text-xs bg-background gap-1 pl-2.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || eventsQuery.isFetching}
              className="h-8 text-xs bg-background gap-1 pr-2.5"
            >
              ถัดไป <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden gap-0">
          <DialogHeader className="p-6 border-b bg-muted/10 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" /> รายละเอียดบันทึก (Log Details)
            </DialogTitle>
            <DialogDescription className="font-mono text-xs mt-1">
              Log ID: {selectedLog?.audit_id}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            {selectedLog && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 border-b border-border/50 pb-6">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider mb-1">
                      ประเภทเหตุการณ์
                    </span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedLog.event_type}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider mb-1">
                      เวลาที่เกิด
                    </span>
                    <span className="font-mono text-sm text-foreground">
                      {formatThaiDateTime(selectedLog.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider mb-1">
                      ผู้ดำเนินการ
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-medium text-sm">
                        {selectedLog.actor_name || 'ระบบ'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({selectedLog.actor_role || 'SYSTEM'})
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider mb-1">
                      ไอพีแอดเดรส
                    </span>
                    <span className="font-mono text-sm">{selectedLog.ip_address || '-'}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground font-medium text-sm">
                      ข้อมูลเพิ่มเติม (Metadata)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2"
                      onClick={() =>
                        copyToClipboard(JSON.stringify(selectedLog.details || {}, null, 2))
                      }
                    >
                      <ClipboardCopy className="h-3 w-3" /> คัดลอก JSON
                    </Button>
                  </div>
                  {/* JSON Display Area */}
                  <div className="bg-[#0d1117] text-[#c9d1d9] p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-[350px] shadow-inner border border-slate-800">
                    <pre className="leading-relaxed">
                      {JSON.stringify(selectedLog.details || {}, null, 2)}
                    </pre>
                  </div>
                </div>

                {selectedLog.user_agent && (
                  <div className="text-[11px] text-muted-foreground bg-muted/30 p-3 rounded-md border">
                    <span className="font-semibold text-foreground block mb-1">
                      ข้อมูลอุปกรณ์ (User Agent):
                    </span>
                    <span className="break-words font-mono leading-relaxed opacity-80">
                      {selectedLog.user_agent}
                    </span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
