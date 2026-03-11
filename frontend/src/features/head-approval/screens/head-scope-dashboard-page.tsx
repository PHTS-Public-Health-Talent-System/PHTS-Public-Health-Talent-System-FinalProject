'use client';

import { useMemo } from 'react';
import { Clock, FileCheck, FileText, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyRequests, useMyScopes, usePendingApprovals } from '@/features/request/core/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';
import { RequestListCard } from '@/components/request-list-card';
import { DashboardHeader } from '@/components/dashboard-header';

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

function parseSubmissionData(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function HeadScopeDashboardPage({ basePath, roleTitle }: HeadScopeDashboardPageProps) {
  const pendingQuery = usePendingApprovals();
  const myRequestsQuery = useMyRequests();
  const scopesQuery = useMyScopes();

  const pendingApprovals = useMemo(
    () => ((pendingQuery.data ?? []) as RequestWithDetails[]).slice(0, 3),
    [pendingQuery.data],
  );
  const myPending = useMemo(
    () =>
      ((myRequestsQuery.data ?? []) as RequestWithDetails[])
        .filter((row) => row.status === 'PENDING')
        .slice(0, 3),
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

  const getRequesterName = (row: RequestWithDetails) => {
    const byRequester = `${row.requester?.first_name ?? ''} ${row.requester?.last_name ?? ''}`.trim();
    if (byRequester) return byRequester;
    const submission = parseSubmissionData(row.submission_data);
    const title = pickString(submission, ['title']);
    const firstName = pickString(submission, ['first_name', 'firstName']);
    const lastName = pickString(submission, ['last_name', 'lastName']);
    const bySubmission = [title, firstName, lastName].filter(Boolean).join(' ').trim();
    return bySubmission || 'ผู้ยื่นคำขอ';
  };

  const getRequesterPosition = (row: RequestWithDetails) => {
    if (row.requester?.position?.trim()) return row.requester.position.trim();
    const submission = parseSubmissionData(row.submission_data);
    const bySubmission = pickString(submission, ['position_name', 'positionName']);
    return bySubmission || row.current_department || '-';
  };

  return (
    <div className="p-8 space-y-8 pb-20">
      <DashboardHeader title="แดชบอร์ด" subtitle={`ภาพรวมงานอนุมัติคำขอสำหรับ${roleTitle}`} />

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
              <p className="text-sm text-muted-foreground">จำนวนขอบเขตการดูแลที่รับผิดชอบ</p>
              <p className="text-3xl font-bold mt-1">{formatThaiNumber(stats.scopeCount)}</p>
            </div>
            <Layers className="h-6 w-6 text-violet-600" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RequestListCard
          title="คำขอที่รอการอนุมัติ"
          viewAllHref={`${basePath}/requests`}
          rows={pendingApprovals.map((row) => ({
            id: row.request_id,
            href: `${basePath}/requests/${row.request_id}`,
            requestNo: row.request_no ?? '-',
            status: { type: 'pending', label: 'รออนุมัติ' },
            primaryText: getRequesterName(row),
            secondaryText: getRequesterPosition(row),
            dateText: formatThaiDate(row.created_at),
            amountText: `${formatThaiNumber(row.requested_amount ?? 0)} บาท`,
          }))}
          emptyMessage="ไม่มีรายการรออนุมัติ"
          minRows={3}
        />

        <RequestListCard
          title="คำขอของฉันล่าสุด"
          viewAllHref={`${basePath}/my-requests`}
          rows={myPending.map((row) => ({
            id: row.request_id,
            href: `${basePath}/my-requests/${row.request_id}`,
            requestNo: row.request_no ?? '-',
            status: { type: 'pending', label: getPendingStepLabel(row.current_step) },
            primaryText: getRequesterName(row),
            secondaryText: getRequesterPosition(row),
            dateText: formatThaiDate(row.created_at),
            amountText: `${formatThaiNumber(row.requested_amount ?? 0)} บาท`,
          }))}
          emptyMessage="ไม่มีคำขอคงค้างของคุณ"
          minRows={3}
        />
      </div>
    </div>
  );
}
