import { memo } from 'react';
import { Activity, HardDrive, RefreshCw, Workflow } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import {
  extractSyncWarnings,
  toServiceStatusBadge,
  toStatusClass,
  type DashboardServiceRow,
  type DashboardSyncRow,
} from '@/features/system/dashboard';

type SystemHealthPanelProps = {
  hasServiceRisk: boolean;
  infrastructureRows: DashboardServiceRow[];
  workflowRows: DashboardServiceRow[];
  syncRows: DashboardSyncRow[];
  notificationFailedRateLastHour: number;
  snapshotFailedRateLastHour: number;
  onOpenSyncDialog: () => void;
};

export const SystemHealthPanel = memo(function SystemHealthPanel({
  hasServiceRisk,
  infrastructureRows,
  workflowRows,
  syncRows,
  notificationFailedRateLastHour,
  snapshotFailedRateLastHour,
  onOpenSyncDialog,
}: SystemHealthPanelProps) {
  return (
    <>
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" /> สถานะบริการหลัก (Service
              Health)
            </CardTitle>
            <Badge
              variant={hasServiceRisk ? 'destructive' : 'outline'}
              className={
                !hasServiceRisk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''
              }
            >
              {hasServiceRisk ? 'มีความเสี่ยง' : 'ทำงานปกติ'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b p-5">
            <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" /> โครงสร้างพื้นฐาน (Infrastructure)
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {infrastructureRows.map((service) => (
                <div key={service.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{service.name}</span>
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        service.status === 'FAILED' ? 'animate-pulse bg-red-500' : 'bg-emerald-500',
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        service.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {toServiceStatusBadge(service.key, service.status, service.detail)}
                    </span>
                    {'latencyMs' in service.detail ? (
                      <span className="font-mono text-muted-foreground">
                        {formatThaiNumber(Number(service.detail.latencyMs ?? 0))}ms
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5">
            <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Workflow className="h-3.5 w-3.5" /> บริการย่อย (Microservices)
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {workflowRows.map((service) => (
                <div
                  key={service.key}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/20"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                        <span
                          className={cn(
                            'absolute inline-flex h-full w-full rounded-full opacity-30',
                            toStatusClass(service.status),
                          )}
                        />
                        <span
                          className={cn(
                            'relative inline-flex h-1.5 w-1.5 rounded-full',
                            toStatusClass(service.status),
                          )}
                        />
                      </div>
                      <span className="truncate text-sm font-medium">{service.name}</span>
                    </div>
                    {Boolean((service.detail as { error?: unknown }).error) ? (
                      <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-destructive">
                        {String((service.detail as { error?: unknown }).error)}
                      </p>
                    ) : null}
                    {service.key === 'hrms-sync' &&
                    service.status === 'DEGRADED' &&
                    extractSyncWarnings(service.detail).length > 0 ? (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2">
                        <p className="mb-1 text-[10px] font-medium text-amber-800">
                          คำเตือนจากรอบล่าสุด
                        </p>
                        <div className="space-y-1">
                          {extractSyncWarnings(service.detail).map((warning, index) => (
                            <p
                              key={`${service.key}-warning-${index}`}
                              className="text-[10px] leading-tight text-amber-900"
                            >
                              {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-[10px] font-normal',
                      service.status === 'FAILED'
                        ? 'border-destructive text-destructive'
                        : service.status === 'DEGRADED'
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'text-muted-foreground',
                    )}
                  >
                    {toServiceStatusBadge(service.key, service.status, service.detail)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-muted-foreground" /> คิวงานประมวลผล (Processing
              Queues)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSyncDialog}
              className="h-8 gap-2 bg-background text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> ดึงข้อมูล HRMS
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          {syncRows.map((row) => (
            <div key={row.id} className="space-y-2">
              <div className="flex items-end justify-between">
                <div className="space-y-0.5">
                  <span className="block text-sm font-medium">{row.type}</span>
                  <span className="text-xs text-muted-foreground">{row.details}</span>
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    row.status === 'failed' ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {formatThaiNumber(row.records)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">รายการ</span>
                </span>
              </div>
              <Progress
                value={row.progress}
                className={cn(
                  'h-2 bg-secondary',
                  row.status === 'failed' && 'bg-destructive/20 [&>div]:bg-destructive',
                  row.status === 'running' && 'animate-pulse bg-blue-100 [&>div]:bg-blue-500',
                )}
              />
              {row.highlight ? (
                <p className="text-[10px] font-medium text-amber-600">{row.highlight}</p>
              ) : null}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
            <div className="text-xs text-muted-foreground">
              อัตราส่งแจ้งเตือนล้มเหลว (1 ชม.):{' '}
              <span className="font-semibold text-foreground">
                {formatThaiNumber(notificationFailedRateLastHour)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              อัตราสร้าง Snapshot ล้มเหลว (1 ชม.):{' '}
              <span className="font-semibold text-foreground">
                {formatThaiNumber(snapshotFailedRateLastHour)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
});
