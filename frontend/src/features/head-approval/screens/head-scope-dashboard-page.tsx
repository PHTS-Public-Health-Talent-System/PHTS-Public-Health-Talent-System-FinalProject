'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Clock, FileCheck, FileText, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyRequests, useMyScopes, usePendingApprovals } from '@/features/request/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import { toRequestDisplayId } from '@/shared/utils/public-id';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';

const getPendingStepLabel = (step?: number | null) => {
  switch (step) {
    case 1:
      return 'รอหัวหน้าตึก/หัวหน้างาน';
    case 2:
      return 'รอหัวหน้ากลุ่มงาน';
    case 3:
      return 'รอเจ้าหน้าที่ พ.ต.ส.';
    case 4:
      return 'รอหัวหน้ากลุ่มงานทรัพยากรบุคคล';
    case 5:
      return 'รอหัวหน้าการเงิน';
    case 6:
      return 'รอผู้อำนวยการ';
    default:
      return 'รอดำเนินการ';
  }
};

type HeadScopeDashboardPageProps = {
  basePath: string;
  roleTitle: string;
};

export function HeadScopeDashboardPage({ basePath, roleTitle }: HeadScopeDashboardPageProps) {
  const pendingQuery = usePendingApprovals();
  const myRequestsQuery = useMyRequests();
  const scopesQuery = useMyScopes();

  const pendingApprovals = useMemo(
    () => ((pendingQuery.data ?? []) as RequestWithDetails[]).slice(0, 5),
    [pendingQuery.data],
  );
  const myPending = useMemo(
    () =>
      ((myRequestsQuery.data ?? []) as RequestWithDetails[])
        .filter((row) => row.status === 'PENDING')
        .slice(0, 5),
    [myRequestsQuery.data],
  );

  const stats = useMemo(() => {
    const allMy = (myRequestsQuery.data ?? []) as RequestWithDetails[];
    const pendingForApprove = (pendingQuery.data ?? []) as RequestWithDetails[];
    const scopeCount = (scopesQuery.data ?? []).length;
    return {
      pendingForApprove: pendingForApprove.length,
      myPending: allMy.filter((row) => row.status === 'PENDING').length,
      myTotal: allMy.length,
      scopeCount,
    };
  }, [myRequestsQuery.data, pendingQuery.data, scopesQuery.data]);

  const isLoading = pendingQuery.isLoading || myRequestsQuery.isLoading || scopesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-10 w-80 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <Skeleton key={k} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">แดชบอร์ด</h1>
          <p className="text-muted-foreground mt-1">
            ภาพรวมงานอนุมัติคำขอในระดับ{roleTitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">รออนุมัติในขั้นตอนของฉัน</p>
              <p className="text-3xl font-bold mt-1">{formatThaiNumber(stats.pendingForApprove)}</p>
            </div>
            <FileCheck className="h-6 w-6 text-sky-600" />
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">คำขอของฉันที่รอดำเนินการ</p>
              <p className="text-3xl font-bold mt-1">{formatThaiNumber(stats.myPending)}</p>
            </div>
            <Clock className="h-6 w-6 text-amber-600" />
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">คำขอของฉันทั้งหมด</p>
              <p className="text-3xl font-bold mt-1">{formatThaiNumber(stats.myTotal)}</p>
            </div>
            <FileText className="h-6 w-6 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">จำนวน Scope ที่รับผิดชอบ</p>
              <p className="text-3xl font-bold mt-1">{formatThaiNumber(stats.scopeCount)}</p>
            </div>
            <Layers className="h-6 w-6 text-violet-600" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-lg">คำขอที่รอการอนุมัติ</CardTitle>
            <Button size="sm" variant="outline" asChild>
              <Link href={`${basePath}/requests`}>ดูทั้งหมด</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {pendingApprovals.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีรายการรออนุมัติ</p>
            ) : (
              pendingApprovals.map((row) => (
                <Link
                  key={row.request_id}
                  href={`${basePath}/requests/${row.request_id}`}
                  className="block px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{row.request_no ?? toRequestDisplayId(row.request_id, row.created_at)}</p>
                      <p className="text-xs text-muted-foreground">{formatThaiDate(row.created_at)}</p>
                    </div>
                    <Badge variant="outline">รออนุมัติ</Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-lg">คำขอของฉันล่าสุด</CardTitle>
            <Button size="sm" variant="outline" asChild>
              <Link href={`${basePath}/my-requests`}>ดูทั้งหมด</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {myPending.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีคำขอคงค้างของคุณ</p>
            ) : (
              myPending.map((row) => (
                <Link
                  key={row.request_id}
                  href={`${basePath}/my-requests/${row.request_id}`}
                  className="block px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{row.request_no ?? toRequestDisplayId(row.request_id, row.created_at)}</p>
                      <p className="text-xs text-muted-foreground">{getPendingStepLabel(row.current_step)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatThaiNumber(row.requested_amount ?? 0)} บาท</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
