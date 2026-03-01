import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  ShieldCheck,
  Database,
  Users,
  FileQuestion,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { SyncReconciliationSummary } from '@/features/system/shared';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';

type SyncGovernanceCardsProps = {
  reconciliation?: SyncReconciliationSummary;
  isFetching?: boolean;
  onRefresh?: () => void;
  actionSlot?: ReactNode;
};

export function SyncGovernanceCards({
  reconciliation,
  isFetching = false,
  onRefresh,
  actionSlot,
}: SyncGovernanceCardsProps) {
  // --- Data Computation ---
  const stats = useMemo(() => {
    // 1. Support Staff Data
    const hrmsSupportCount = Number(reconciliation?.support?.support_view_count ?? 0);
    const localSupportCount = Number(reconciliation?.support?.support_table_count ?? 0);
    const isSupportSynced = hrmsSupportCount === localSupportCount;

    // 2. User Data
    const activeUsers = Number(reconciliation?.users?.users_active ?? 0);
    const totalUsers = Number(reconciliation?.users?.users_total ?? 0);

    // 3. Data Quality (Null values)
    const nullProfileStatus = Number(reconciliation?.quality?.profile_status_code_null ?? 0);
    const nullSupportStatus = Number(reconciliation?.quality?.support_status_code_null ?? 0);
    const totalNullStatus = nullProfileStatus + nullSupportStatus;

    return {
      support: { hrms: hrmsSupportCount, local: localSupportCount, isSynced: isSupportSynced },
      users: { active: activeUsers, total: totalUsers },
      quality: { nullCount: totalNullStatus, hasIssues: totalNullStatus > 0 },
    };
  }, [reconciliation]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" /> สรุปความสอดคล้องข้อมูล
            </CardTitle>
            <CardDescription className="mt-1">
              ตรวจสอบความสมบูรณ์และปริมาณข้อมูลระหว่างฐานข้อมูลกลาง (HRMS) และระบบปัจจุบัน
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            {actionSlot}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isFetching}
                className="gap-2 bg-background"
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin-slow')} />
                รีเฟรชข้อมูล
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Data Synchronization Status */}
        <div
          className={cn(
            'p-4 border rounded-lg transition-colors',
            stats.support.isSynced ? 'bg-card' : 'bg-amber-50/50 border-amber-200',
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" />
              <p className="text-sm font-medium text-foreground">ฐานข้อมูลเจ้าหน้าที่</p>
            </div>
            {stats.support.isSynced ? (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px] font-normal"
              >
                <CheckCircle2 className="h-3 w-3" /> ข้อมูลตรงกัน
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-amber-100 text-amber-700 border-amber-200 gap-1 text-[10px] font-normal"
              >
                <AlertTriangle className="h-3 w-3" /> ข้อมูลไม่ตรงกัน
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <p className={cn('text-2xl font-bold', !stats.support.isSynced && 'text-amber-700')}>
              {formatThaiNumber(stats.support.local)}
            </p>
            <p className="text-sm text-muted-foreground">
              / {formatThaiNumber(stats.support.hrms)} รายการ (HRMS)
            </p>
          </div>
        </div>

        {/* Card 2: User Accounts */}
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Users className="h-4 w-4" />
            <p className="text-sm font-medium text-foreground">บัญชีผู้ใช้งาน</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground">
              {formatThaiNumber(stats.users.active)}
            </p>
            <p className="text-sm text-muted-foreground">
              / {formatThaiNumber(stats.users.total)} เปิดใช้งาน
            </p>
          </div>
          {/* Visual indicator for active ratio (Optional but good for UX) */}
          <div className="w-full bg-secondary h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{
                width: `${stats.users.total > 0 ? (stats.users.active / stats.users.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Card 3: Data Quality (Null Values) */}
        <div
          className={cn(
            'p-4 border rounded-lg transition-colors',
            stats.quality.hasIssues ? 'bg-red-50/50 border-red-200' : 'bg-card',
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileQuestion className="h-4 w-4" />
              <p className="text-sm font-medium text-foreground">คุณภาพข้อมูล (Status Code)</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                'text-2xl font-bold',
                stats.quality.hasIssues ? 'text-red-600' : 'text-muted-foreground',
              )}
            >
              {formatThaiNumber(stats.quality.nullCount)}
            </p>
            <p className="text-sm text-muted-foreground">รายการที่ข้อมูลสถานะสูญหาย</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
