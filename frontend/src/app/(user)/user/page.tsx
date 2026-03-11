'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle2, Bell, Plus, Megaphone, User } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { DataTableCard } from '@/components/data-table-card';
import { type StatusType } from '@/components/status-badge';
import { RequestListCard } from '@/components/request-list-card';
import { DashboardHeader } from '@/components/dashboard-header';
import { useCurrentUser } from '@/features/auth/hooks';
import { useUserDashboard } from '@/features/dashboard/hooks';
import { useMyRequests } from '@/features/request/core/hooks';
import type { RequestStatus, RequestWithDetails } from '@/types/request.types';
import { buildStatItems } from '@/features/dashboard/user/userDashboard.mappers';
import { Skeleton } from '@/components/ui/skeleton';

const quickActions = [
  { label: 'สร้างคำขอใหม่', href: '/user/my-requests/new', icon: Plus, color: 'text-primary' },
  { label: 'คำขอของฉัน', href: '/user/my-requests', icon: FileText, color: 'text-blue-600' },
  { label: 'ดูประกาศ', href: '/user/announcements', icon: Megaphone, color: 'text-orange-600' },
  { label: 'แจ้งเตือน', href: '/user/notifications', icon: Bell, color: 'text-purple-600' },
];

export default function UserDashboardPage() {
  const { data: userResponse, isLoading: userLoading } = useCurrentUser();
  const { data: dashboardData, isLoading: dashboardLoading } = useUserDashboard();
  const { data: myRequestsData } = useMyRequests();

  const dashboardStats = useMemo(
    () =>
      dashboardData?.stats ?? {
        total: 0,
        pending: 0,
        approved: 0,
        unread: 0,
        pending_steps: [],
        total_trend: '0 เดือนนี้',
        total_trend_up: false,
        pending_trend: undefined,
        pending_trend_up: false,
        approved_trend: 'อนุมัติแล้ว 0 รายการ',
        approved_trend_up: false,
        unread_trend: 'วันนี้ 0 รายการ',
        unread_trend_up: false,
      },
    [dashboardData?.stats],
  );

  const stats = useMemo(() => {
    return buildStatItems(dashboardStats, {
      FileText,
      Clock,
      CheckCircle2,
      Bell,
    });
  }, [dashboardStats]);

  const recentRequests = dashboardData?.recent_requests ?? [];
  const announcements = dashboardData?.announcements ?? [];

  const userName = useMemo(() => {
    const user = userResponse?.data as
      | {
          title?: string;
          first_name?: string;
          last_name?: string;
          firstName?: string;
          lastName?: string;
        }
      | undefined;
    return `${user?.title ?? ''} ${user?.first_name ?? user?.firstName ?? ''} ${user?.last_name ?? user?.lastName ?? ''}`.trim();
  }, [userResponse?.data]);

  const userPositionOrDepartment = useMemo(() => {
    const user = userResponse?.data as
      | {
          position?: string;
          department?: string;
        }
      | undefined;
    return user?.position || user?.department || '-';
  }, [userResponse?.data]);

  const mapStatusToBadge = (status: RequestStatus): StatusType => {
    switch (status) {
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      case 'RETURNED':
        return 'returned';
      case 'CANCELLED':
        return 'cancelled';
      case 'DRAFT':
        return 'draft';
      default:
        return 'pending';
    }
  };

  const isLoading = userLoading || dashboardLoading;

  const parseSubmissionData = (input: unknown): Record<string, unknown> => {
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
  };

  const pickString = (data: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };

  const myRequestsById = useMemo(() => {
    const map = new Map<number, RequestWithDetails>();
    ((myRequestsData ?? []) as RequestWithDetails[]).forEach((req) => map.set(req.request_id, req));
    return map;
  }, [myRequestsData]);

  const getDisplayNameByRequestId = (requestId: number) => {
    const req = myRequestsById.get(requestId);
    if (!req) return userName || 'ผู้ยื่นคำขอ';
    const submission = parseSubmissionData(req.submission_data);
    const title = pickString(submission, ['title']);
    const first = req.requester?.first_name || pickString(submission, ['first_name', 'firstName']);
    const last = req.requester?.last_name || pickString(submission, ['last_name', 'lastName']);
    return [title, first, last].filter(Boolean).join(' ').trim() || userName || 'ผู้ยื่นคำขอ';
  };

  const getDisplayPositionByRequestId = (requestId: number) => {
    const req = myRequestsById.get(requestId);
    if (!req) return userPositionOrDepartment;
    const submission = parseSubmissionData(req.submission_data);
    return (
      req.requester?.position ||
      pickString(submission, ['position_name', 'positionName']) ||
      req.current_department ||
      userPositionOrDepartment
    );
  };

  const getAmountText = (status: RequestStatus, amount: string) => {
    const badge = mapStatusToBadge(status);
    if (badge === 'approved') return `${amount} บาท`;
    return `${amount} บาท`;
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="h-20 w-1/2 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 pb-20">
      {/* Header */}
      <DashboardHeader
        title={`สวัสดี, ${userName || 'ผู้ใช้งาน'}`}
        subtitle="ยินดีต้อนรับสู่ระบบเบิกจ่ายค่าตอบแทนพิเศษ (พ.ต.ส.)"
        icon={User}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          const colorClass =
            idx === 0
              ? 'text-blue-600 bg-blue-50'
              : idx === 1
                ? 'text-amber-600 bg-amber-50'
                : idx === 2
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-purple-600 bg-purple-50';

          return (
            <Card key={stat.title} className="border-border shadow-sm">
              <CardContent className="p-6 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <div className="text-2xl font-bold mt-2">{stat.value}</div>
                  {stat.trend && <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>}
                </div>
                <div className={`p-3 rounded-xl ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Requests */}
        <div className="lg:col-span-2 space-y-6">
          <RequestListCard
            title="คำขอของฉันล่าสุด"
            viewAllHref="/user/my-requests"
            rows={recentRequests.map((request) => ({
              id: request.request_id,
              href: `/user/my-requests/${request.request_id}`,
              requestNo: request.display_id,
              status: {
                type: mapStatusToBadge(request.status),
                label: request.status_label,
              },
              primaryText: getDisplayNameByRequestId(request.request_id),
              secondaryText: getDisplayPositionByRequestId(request.request_id),
              dateText: request.submitted_label,
              amountText: getAmountText(request.status, request.amount),
            }))}
            emptyMessage="ไม่มีรายการคำขอล่าสุด"
            minRows={3}
            emptyAction={
              <Button variant="link" asChild className="mt-2 text-primary">
                <Link href="/user/my-requests/new">สร้างคำขอใหม่</Link>
              </Button>
            }
          />
        </div>

        {/* Right Column: Quick Actions & Announcements */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all text-center gap-2 group"
              >
                <div
                  className={`p-2 rounded-full bg-secondary group-hover:bg-background transition-colors ${action.color}`}
                >
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-foreground">{action.label}</span>
              </Link>
            ))}
          </div>

          {/* Announcements */}
          <DataTableCard title="ประกาศล่าสุด" viewAllHref="/user/announcements">
            <div className="space-y-3">
              {announcements.length > 0 ? (
                announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="rounded-lg border border-border bg-card p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-foreground line-clamp-2">
                        {announcement.title}
                      </p>
                      {announcement.priority === 'high' && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 h-5 shrink-0">
                          สำคัญ
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {announcement.date}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  ไม่มีประกาศใหม่
                </div>
              )}
            </div>
          </DataTableCard>
        </div>
      </div>
    </div>
  );
}
