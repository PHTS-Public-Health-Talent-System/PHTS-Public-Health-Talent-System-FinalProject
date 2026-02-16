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
import { Search, Download, Eye, Filter } from 'lucide-react';
import {
  useAuditEventTypes,
  useAuditEvents,
  useAuditSummary,
  useExportAuditEvents,
} from '@/features/audit/hooks';
import { toast } from 'sonner';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

// --- Types ---
type AuditEventRow = {
  audit_id: number;
  event_type: string;
  entity_type: string;
  entity_id: number | null;
  actor_id: number | null;
  actor_role: string | null;
  actor_name?: string | null;
  ip_address: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
};

type AuditSearchResult = {
  events: AuditEventRow[];
  total: number;
  page: number;
  limit: number;
};

type AuditSummaryRow = {
  event_type: string;
  count: number;
};

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
  const eventTypes = ((eventTypesQuery.data ?? []) as Array<{ value: string; label: string }>).map(
    (x) => x.value,
  );
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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            บันทึกการใช้งานระบบ
          </h1>
          <p className="text-muted-foreground mt-1">
            ตรวจสอบประวัติการใช้งานและการเปลี่ยนแปลงข้อมูลในระบบ
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={exportMutation.isPending}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          ส่งออก CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {summaryQuery.isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : topSummary.map((s) => (
              <Card key={s.event_type} className="border-border shadow-sm">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {s.event_type}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{formatThaiNumber(Number(s.count))}</span>
                    <span className="text-sm text-muted-foreground">ครั้ง</span>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาผู้ดำเนินการ, ไอพีแอดเดรส หรือรหัสข้อมูล..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-10"
              />
            </div>
            <Select
              value={eventType}
              onValueChange={(v) => {
                setEventType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-[220px] h-10">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="ประเภทเหตุการณ์" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
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
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">รายการบันทึก</CardTitle>
            <Badge variant="secondary" className="font-normal">
              {formatThaiNumber(result.total)} รายการ
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[180px]">เวลา</TableHead>
                <TableHead>เหตุการณ์</TableHead>
                <TableHead>ผู้ดำเนินการ</TableHead>
                <TableHead>เป้าหมายข้อมูล</TableHead>
                <TableHead className="text-right">ไอพีแอดเดรส</TableHead>
                <TableHead className="w-[50px]"></TableHead>
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
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : result.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    ไม่พบข้อมูลบันทึกการใช้งานตามเงื่อนไขที่ระบุ
                  </TableCell>
                </TableRow>
              ) : (
                result.events.map((log) => (
                  <TableRow
                    key={log.audit_id}
                    className="group hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono">
                      {formatThaiDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal bg-background">
                        {log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{log.actor_name || 'ระบบ'}</span>
                        <span className="text-[10px] text-muted-foreground">{log.actor_role}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="ml-1 font-mono text-xs">#{log.entity_id}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {log.ip_address || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Footer */}
        <div className="border-t bg-muted/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            แสดง {fromItem}-{toItem} จาก {result.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || eventsQuery.isFetching}
              className="h-8 bg-background"
            >
              ย้อนกลับ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || eventsQuery.isFetching}
              className="h-8 bg-background"
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>รายละเอียดบันทึก</DialogTitle>
            <DialogDescription>ID: {selectedLog?.audit_id}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {selectedLog && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <span className="text-muted-foreground block text-xs">ประเภทเหตุการณ์</span>
                    <span className="font-medium">{selectedLog.event_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">เวลาที่เกิด</span>
                    <span className="font-mono">{formatThaiDateTime(selectedLog.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">ผู้ดำเนินการ</span>
                    <span>
                      {selectedLog.actor_name} ({selectedLog.actor_role})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">ไอพีแอดเดรส</span>
                    <span className="font-mono">{selectedLog.ip_address}</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-2">
                    ข้อมูลเพิ่มเติม (Metadata)
                  </span>
                  <div className="bg-slate-950 text-slate-50 p-3 rounded-md font-mono text-xs overflow-auto max-h-[300px]">
                    <pre>{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
                  </div>
                </div>

                {selectedLog.user_agent && (
                  <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    <span className="font-medium mr-1">ข้อมูลอุปกรณ์:</span>
                    {selectedLog.user_agent}
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
