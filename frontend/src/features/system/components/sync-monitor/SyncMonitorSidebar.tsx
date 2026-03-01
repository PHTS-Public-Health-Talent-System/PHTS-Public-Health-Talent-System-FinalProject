import { Activity, AlertCircle, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useRef } from 'react';
import type { SyncBatchRecord, SyncSchedule } from '@/features/system';
import type { LeaveIssueSummary } from '@/features/system/sync-monitor';

type SyncMonitorSidebarProps = {
  latestBatchId?: number;
  schedule?: SyncSchedule;
  batches: SyncBatchRecord[];
  batchesLoading: boolean;
  batchesFetching: boolean;
  batchesFetchingNextPage: boolean;
  hasMoreBatches: boolean;
  onLoadMoreBatches: () => void;
  onRefreshBatches: () => void;
  leaveIssueSummary: LeaveIssueSummary;
  formatDateTime: (value: string) => string;
  toStageBadgeClass: (status: string) => string;
  toStageStatusLabel: (status: string) => string;
  leaveReasonCodeLabels: Record<string, string>;
};

export function SyncMonitorSidebar({
  latestBatchId,
  schedule,
  batches,
  batchesLoading,
  batchesFetching,
  batchesFetchingNextPage,
  hasMoreBatches,
  onLoadMoreBatches,
  onRefreshBatches,
  leaveIssueSummary,
  formatDateTime,
  toStageBadgeClass,
  toStageStatusLabel,
  leaveReasonCodeLabels,
}: SyncMonitorSidebarProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMoreBatches || batchesFetchingNextPage) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreBatches();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [batchesFetchingNextPage, hasMoreBatches, onLoadMoreBatches]);

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-border bg-muted/10 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">สถานะการทำงาน</p>
              <p className="mt-0.5 text-xs text-muted-foreground">ระบบดึงข้อมูลจาก HRMS ล่าสุด</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t pt-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                รอบล่าสุด
              </p>
              <p className="text-sm font-mono text-foreground">
                {latestBatchId ? `Batch #${latestBatchId}` : 'ไม่มีข้อมูล'}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ทำงานอัตโนมัติ
              </p>
              <p className="text-sm font-medium text-foreground">
                {schedule
                  ? schedule.mode === 'INTERVAL'
                    ? `ทุก ${schedule.interval_minutes} นาที`
                    : `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
                  : '-'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-8 w-full bg-background text-xs" asChild>
            <a href="/admin/system">ปรับตั้งค่าเวลาซิงก์</a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-muted-foreground" /> ประวัติรอบการซิงก์
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRefreshBatches}
              disabled={batchesFetching}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batchesLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการซิงก์</p>
          ) : (
            <div className="max-h-[38rem] space-y-3 overflow-y-auto pr-1">
              {batches.map((batch) => (
                <div
                  key={batch.batch_id}
                  className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">#{batch.batch_id}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase">
                        {batch.sync_type}
                      </Badge>
                    </div>
                    <Badge className={`h-5 px-1.5 text-[10px] ${toStageBadgeClass(batch.overall_status)}`}>
                      {toStageStatusLabel(batch.overall_status)}
                    </Badge>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateTime(batch.started_at)}</span>
                    {batch.warnings_count && batch.warnings_count > 0 ? (
                      <span className="flex items-center gap-1 font-medium text-amber-600">
                        <AlertCircle className="h-3 w-3" /> {batch.warnings_count} เตือน
                      </span>
                    ) : null}
                  </div>
                  <div className="mb-2 grid grid-cols-3 gap-2 text-[10px] sm:text-[11px]">
                    <div className="rounded border bg-background px-2 py-1 text-center">
                      <span className="mb-0.5 block text-muted-foreground">ทั้งหมด</span>
                      <span className="font-semibold text-foreground">{batch.total_records}</span>
                    </div>
                    <div className="rounded border bg-background px-2 py-1 text-center">
                      <span className="mb-0.5 block text-muted-foreground">เปลี่ยน</span>
                      <span className="font-semibold text-emerald-600">{batch.changed_records}</span>
                    </div>
                    <div className="rounded border bg-background px-2 py-1 text-center">
                      <span className="mb-0.5 block text-muted-foreground">ผิดพลาด</span>
                      <span className="font-semibold text-red-600">{batch.error_records}</span>
                    </div>
                  </div>
                </div>
              ))}
              {hasMoreBatches ? (
                <div ref={loadMoreRef} className="flex justify-center py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onLoadMoreBatches}
                    disabled={batchesFetchingNextPage}
                    className="text-xs text-muted-foreground"
                  >
                    {batchesFetchingNextPage ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        กำลังโหลดเพิ่ม...
                      </>
                    ) : (
                      'โหลดประวัติเพิ่ม'
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> สรุปประเด็นการลา
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">ประเด็นทั้งหมด</p>
              <p className="text-2xl font-bold text-foreground">{leaveIssueSummary.total}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="mb-1 block text-muted-foreground">มีการเปลี่ยนประเภท</span>
                  <span className="font-semibold text-foreground">{leaveIssueSummary.reclassified}</span>
                </div>
                <div>
                  <span className="mb-1 block text-muted-foreground">ต้องทบทวน</span>
                  <span className="font-semibold text-foreground">{leaveIssueSummary.review}</span>
                </div>
                <div>
                  <span className="mb-1 block text-muted-foreground">วันที่ถูกปรับ</span>
                  <span className="font-semibold text-foreground">{leaveIssueSummary.dateAdjusted}</span>
                </div>
                <div>
                  <span className="mb-1 block text-muted-foreground">วันที่ใช้ไม่ได้</span>
                  <span className="font-semibold text-foreground">{leaveIssueSummary.dateInvalid}</span>
                </div>
              </div>
            </div>
          </div>
          {leaveIssueSummary.topReasons.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">ไม่พบข้อมูล</p>
          ) : (
            <div className="space-y-1">
              {leaveIssueSummary.topReasons.map((item) => (
                <div
                  key={item.reasonCode}
                  className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm last:border-0"
                >
                  <span className="truncate pr-2 text-xs text-muted-foreground">
                    {leaveReasonCodeLabels[item.reasonCode] ?? item.reasonCode}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
