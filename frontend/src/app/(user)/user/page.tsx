'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle2, Bell, Plus, Megaphone, User, Inbox } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { DataTableCard } from '@/components/data-table-card';
import { StatusBadge, type StatusType } from '@/components/status-badge';
import { useCurrentUser } from '@/features/auth/hooks';
import { useUserDashboard } from '@/features/dashboard/hooks';
import type { RequestStatus } from '@/types/request.types';
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
          first_name?: string;
          last_name?: string;
          firstName?: string;
          lastName?: string;
        }
      | undefined;
    return `${user?.first_name ?? user?.firstName ?? ''} ${user?.last_name ?? user?.lastName ?? ''}`.trim();
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
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            สวัสดี, {userName || 'ผู้ใช้งาน'}
          </h1>
          <p className="text-muted-foreground mt-1">
            ยินดีต้อนรับสู่ระบบเบิกจ่ายค่าตอบแทนพิเศษ (พ.ต.ส.)
          </p>
        </div>
      </div>

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
          <DataTableCard title="คำขอล่าสุด" viewAllHref="/user/my-requests">
            <div className="space-y-3">
              {recentRequests.length > 0 ? (
                recentRequests.map((request) => (
                  <Link
                    key={request.request_id}
                    href={`/user/my-requests/${request.request_id}`}
                    className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:bg-secondary/50 hover:shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {request.display_id}
                        </span>
                        <StatusBadge
                          status={mapStatusToBadge(request.status)}
                          label={request.status_label}
                        />
                      </div>
                      <p className="mt-2 font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {request.month_label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        สถานะ: ขั้นตอนที่ {request.step}/6
                      </p>
                    </div>
                    <div className="text-right pl-4">
                      <p className="text-lg font-bold text-foreground">
                        {request.amount}{' '}
                        <span className="text-xs font-normal text-muted-foreground">บาท</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.submitted_label}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-3 opacity-20" />
                  <p>ไม่มีรายการคำขอล่าสุด</p>
                  <Button variant="link" asChild className="mt-2 text-primary">
                    <Link href="/user/my-requests/new">สร้างคำขอใหม่</Link>
                  </Button>
                </div>
              )}
            </div>
          </DataTableCard>
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
