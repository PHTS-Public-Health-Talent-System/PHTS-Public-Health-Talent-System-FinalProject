"use client";

import {
  Plus,
  FileText,
  BadgeCheck,
  Hourglass,
  Eye,
  Bell,
  Wallet,
  ArrowRight,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

export default function UserDashboardPage() {
  const { user } = useAuth();
  const { data: requests, isLoading } = useMyRequests();
  const { data: prefill } = usePrefill();
  const { data: notifications, isLoading: isNotifLoading } = useNotifications();

  const total = requests?.length ?? 0;
  const pending =
    requests?.filter(
      (r) =>
        r.status !== "DRAFT" &&
        r.status !== "APPROVED" &&
        r.status !== "REJECTED" &&
        r.status !== "CANCELLED",
    ).length ?? 0;
  const approved = requests?.filter((r) => r.status === "APPROVED").length ?? 0;
  
  const totalAmount = useMemo(() => {
     return requests?.reduce((sum, r) => sum + Number(r.requested_amount || 0), 0) ?? 0;
  }, [requests]);

  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    return [...requests].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [requests]);
  const latestNotifs = notifications?.notifications?.slice(0, 3) ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-8 text-primary-foreground shadow-lg">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              สวัสดี, {prefill?.first_name || user?.firstName}{" "}
              {prefill?.last_name || user?.lastName}
            </h1>
            <p className="text-primary-foreground/80 text-lg">
              ยินดีต้อนรับสู่ระบบบริหารจัดการเงิน พ.ต.ส. โรงพยาบาลอุตรดิตถ์
            </p>
          </div>
          <Link href="/dashboard/user/request">
            <Button
              size="lg"
              variant="secondary"
              className="shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="mr-2 h-5 w-5" /> ยื่นคำขอใหม่
            </Button>
          </Link>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <StatCard
              title="คำขอทั้งหมด"
              value={total}
              icon={FileText}
              description="รายการที่สร้างทั้งหมด"
            />
             <StatCard
              title="ยอดเงินรวมที่ขอ"
              value={`${totalAmount.toLocaleString()} ฿`}
              icon={Wallet}
              iconClassName="bg-blue-50 text-blue-600"
              description="ยอดสะสมทั้งหมด"
            />
            <StatCard
              title="รอดำเนินการ"
              value={pending}
              icon={Hourglass}
              iconClassName="bg-orange-50 text-orange-600"
              description="รายการที่รอการอนุมัติ"
            />
            <StatCard
              title="อนุมัติแล้ว"
              value={approved}
              icon={BadgeCheck}
              iconClassName="bg-emerald-50 text-emerald-600"
              description="รายการที่อนุมัติสำเร็จ"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Recent Requests Section */}
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                   <FileText className="h-5 w-5 text-primary" />
                   รายการล่าสุด
                </h2>
                <Link href="/dashboard/user/requests" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  ดูทั้งหมด <ArrowRight className="h-4 w-4" />
                </Link>
             </div>

             {/* Quick Filter Tabs */}
             <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/user/requests?status=PENDING">
                  <Badge variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors gap-1">
                    <Hourglass className="h-3 w-3" /> รอดำเนินการ
                  </Badge>
                </Link>
                <Link href="/dashboard/user/requests?status=RETURNED">
                  <Badge variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 transition-colors gap-1">
                     <Eye className="h-3 w-3" /> ส่งกลับแก้ไข
                  </Badge>
                </Link>
                 <Link href="/dashboard/user/requests?status=DRAFT">
                  <Badge variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-gray-50 hover:text-gray-600 transition-colors gap-1">
                     <FileText className="h-3 w-3" /> ฉบับร่าง
                  </Badge>
                </Link>
             </div>

            <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : !requests || requests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="bg-muted/50 p-4 rounded-full mb-4">
                      <FileText className="h-8 w-8 opacity-40" />
                    </div>
                    <p className="font-medium mb-1">ยังไม่มีรายการคำขอ</p>
                    <p className="text-sm mb-4">เริ่มต้นสร้างคำขอใหม่ของคุณได้เลย</p>
                    <Link href="/dashboard/user/request">
                      <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> สร้างคำขอแรก
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {sortedRequests.slice(0, 5).map((req) => (
                      <div
                        key={req.request_id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-accent/50 transition-all duration-200"
                      >
                        <div className="flex items-start gap-4 mb-3 sm:mb-0">
                          <div className="mt-1 bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/user/requests/${req.request_id}`}
                              className="font-semibold text-foreground hover:text-primary transition-colors block mb-1"
                            >
                              {req.request_no ?? "No Number"}
                            </Link>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">{REQUEST_TYPE_LABELS[req.request_type]}</span>
                              <span>•</span>
                              <span>
                                {new Date(req.created_at).toLocaleDateString(
                                  "th-TH",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-11 sm:pl-0">
                          <StatusBadge
                            status={req.status}
                            currentStep={req.current_step}
                          />
                          <div className="flex items-center gap-3">
                             <span className="font-mono font-medium text-sm w-20 text-right">
                              {Number(req.requested_amount).toLocaleString()}
                            </span>
                             <Link href={`/dashboard/user/requests/${req.request_id}`}>
                                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                             </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Notifications Card */}
          <Card className="shadow-md border-none bg-card/50 backdrop-blur-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  การแจ้งเตือน
                </CardTitle>
                 <Link href="/dashboard/user/notifications">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    ทั้งหมด
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isNotifLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : latestNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                  <Bell className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">ไม่มีการแจ้งเตือนใหม่</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestNotifs.map((n) => (
                    <div
                      key={n.notification_id}
                      className="group relative flex gap-3 p-3 rounded-xl border border-border/50 bg-background hover:bg-accent/50 hover:border-primary/20 transition-all duration-200"
                    >
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 pt-1">
                           {new Date(n.created_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}