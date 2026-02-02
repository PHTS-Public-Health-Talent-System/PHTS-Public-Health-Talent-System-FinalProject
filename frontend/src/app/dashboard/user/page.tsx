"use client";

import { Plus, FileText, CheckCircle, Clock, Eye, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useMyRequests, usePrefill } from "@/features/request/hooks";
import { useNotifications } from "@/features/notification/hooks";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/common/status-badge";
import { REQUEST_TYPE_LABELS } from "@/types/request.types";
import { useMemo } from "react";

export default function UserDashboardPage() {
  const { user } = useAuth();
  const { data: requests, isLoading } = useMyRequests();
  const { data: prefill } = usePrefill();
  const { data: notifications, isLoading: isNotifLoading } = useNotifications();

  const total = requests?.length ?? 0;
  const pending = requests?.filter((r) =>
    r.status !== "DRAFT" &&
    r.status !== "APPROVED" &&
    r.status !== "REJECTED" &&
    r.status !== "CANCELLED"
  ).length ?? 0;
  const approved = requests?.filter((r) => r.status === "APPROVED").length ?? 0;
  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    return [...requests].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [requests]);
  const latestNotifs = notifications?.notifications?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-primary/5 p-6 rounded-xl border border-primary/10 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            สวัสดี, {prefill?.first_name || user?.firstName} {prefill?.last_name || user?.lastName}
          </h2>
          <p className="text-muted-foreground mt-1">
            ยินดีต้อนรับสู่ระบบบริหารจัดการเงิน พ.ต.ส.
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <Link href="/dashboard/user/request" className="relative z-10">
          <Button className="w-full sm:w-auto shadow-lg hover:shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" /> ยื่นคำขอใหม่
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="คำขอทั้งหมด" value={total} icon={FileText} />
          <StatCard
            title="รอดำเนินการ"
            value={pending}
            icon={Clock}
            iconClassName="bg-orange-50 text-orange-600"
          />
          <StatCard
            title="อนุมัติแล้ว"
            value={approved}
            icon={CheckCircle}
            iconClassName="bg-emerald-50 text-emerald-600"
          />
        </div>
      )}

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
         <Link href="/dashboard/user/requests">
            <Button variant="outline" size="sm" className="rounded-full">ดูทั้งหมด</Button>
          </Link>
          <Link href="/dashboard/user/requests?status=PENDING">
            <Button variant="outline" size="sm" className="rounded-full">รอดำเนินการ</Button>
          </Link>
          <Link href="/dashboard/user/requests?status=RETURNED">
            <Button variant="outline" size="sm" className="rounded-full text-orange-600 border-orange-200 bg-orange-50/50">ส่งกลับแก้ไข</Button>
          </Link>
          <Link href="/dashboard/user/requests?status=DRAFT">
            <Button variant="outline" size="sm" className="rounded-full">ฉบับร่าง</Button>
          </Link>
      </div>

     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> การแจ้งเตือน
            </CardTitle>
            <Link href="/dashboard/user/notifications">
              <Button variant="ghost" size="sm" className="h-8 text-xs">ดูทั้งหมด</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isNotifLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : latestNotifs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                <Bell className="mx-auto h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">ไม่มีการแจ้งเตือนใหม่</p>
              </div>
            ) : (
              <div className="space-y-3">
                {latestNotifs.map((n) => (
                  <div key={n.notification_id} className="group relative rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium leading-none mb-1 group-hover:text-primary transition-colors">{n.title}</p>
                      {!n.is_read && (
                        <span className="flex h-2 w-2 rounded-full bg-cta shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">รายการล่าสุด</CardTitle>
            {requests && requests.length > 0 && (
              <Link href="/dashboard/user/requests">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  ดูทั้งหมด
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !requests || requests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                <FileText className="mx-auto h-10 w-10 mb-3 opacity-20" />
                <p className="mb-4">ยังไม่มีรายการคำขอ</p>
                <Link href="/dashboard/user/request">
                  <Button variant="outline" size="sm">
                    <Plus className="mr-1 h-3 w-3" /> สร้างคำขอแรก
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-border">
                  {sortedRequests.slice(0, 5).map((req) => (
                    <div key={req.request_id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                       <div className="grid gap-1">
                          <Link href={`/dashboard/user/requests/${req.request_id}`} className="font-medium hover:underline group flex items-center gap-2">
                             {req.request_no ?? `#${req.request_id}`}
                             <StatusBadge status={req.status} currentStep={req.current_step} />
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                             <span>{REQUEST_TYPE_LABELS[req.request_type]}</span>
                             <span>•</span>
                             <span>{new Date(req.created_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="font-semibold text-sm hidden sm:inline-block text-right min-w-[80px]">
                            {req.requested_amount.toLocaleString()} ฿
                          </span>
                          <Link href={`/dashboard/user/requests/${req.request_id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <Eye className="h-4 w-4" />
                              </Button>
                          </Link>
                       </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
     </div>
    </div>
  );
}
