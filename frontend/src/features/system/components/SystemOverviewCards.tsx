import { memo } from 'react';
import { FileWarning, Layers, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

type SystemOverviewCardsProps = {
  version: string;
  env: string;
  maintenanceEnabled: boolean;
  totalQueueBacklog: number;
  failedJobsCount: number;
  maintenanceLoading: boolean;
  maintenancePending: boolean;
  onMaintenanceToggle: (next: boolean) => void;
};

export const SystemOverviewCards = memo(function SystemOverviewCards({
  version,
  env,
  maintenanceEnabled,
  totalQueueBacklog,
  failedJobsCount,
  maintenanceLoading,
  maintenancePending,
  onMaintenanceToggle,
}: SystemOverviewCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">เวอร์ชันระบบ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{version || '-'}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Environment:</span>
                <Badge variant="secondary" className="h-4 px-1.5 font-mono text-[10px] uppercase">
                  {env || 'Unknown'}
                </Badge>
              </div>
            </div>
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Tag className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'border-border shadow-sm transition-all',
          maintenanceEnabled && 'border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20',
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            โหมดปิดปรับปรุง (Maintenance)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div
                className={cn(
                  'text-2xl font-bold',
                  maintenanceEnabled ? 'text-destructive' : 'text-emerald-600',
                )}
              >
                {maintenanceEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {maintenanceEnabled ? 'จำกัดการเข้าถึงของผู้ใช้' : 'ระบบเปิดใช้งานปกติ'}
              </p>
            </div>
            <Switch
              checked={maintenanceEnabled}
              onCheckedChange={onMaintenanceToggle}
              disabled={maintenanceLoading || maintenancePending}
              className={maintenanceEnabled ? 'data-[state=checked]:bg-destructive' : ''}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            คิวงานค้าง (Queue Backlog)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {formatThaiNumber(totalQueueBacklog)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">รวมจากทุกบริการคิว</p>
            </div>
            <div
              className={cn(
                'rounded-full p-3',
                totalQueueBacklog > 100
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'border-border shadow-sm transition-all',
          failedJobsCount > 0 && 'border-destructive/30 bg-destructive/5',
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            งานที่ล้มเหลว (Failed Jobs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div
                className={cn(
                  'text-2xl font-bold',
                  failedJobsCount > 0 ? 'text-destructive' : 'text-foreground',
                )}
              >
                {formatThaiNumber(failedJobsCount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                รายการที่ไม่สำเร็จ / ต้องการแก้ไข
              </p>
            </div>
            <div
              className={cn(
                'rounded-full p-3',
                failedJobsCount > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              <FileWarning className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
