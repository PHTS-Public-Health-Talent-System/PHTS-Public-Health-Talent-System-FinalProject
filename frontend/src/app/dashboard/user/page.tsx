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
  ChevronRight,
  Clock,
  CheckCircle2,
  BellRing
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

  // Calculation Logic (คงเดิม)
  const total = requests?.length ?? 0;
  const pending = requests?.filter((r) =>
    r.status === "PENDING" || r.status.startsWith("PENDING_")
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
      {/* 1. Hero Header Section - Serene Design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-sky-50 to-white border border-sky-100 shadow-sm">
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              สวัสดี, {prefill?.first_name || user?.firstName} {prefill?.last_name || user?.lastName}
            </h1>
            <p className="text-slate-600 text-lg">
              ยินดีต้อนรับสู่ระบบบริหารจัดการเงิน พ.ต.ส. โรงพยาบาลอุตรดิตถ์
            </p>
          </div>
          <Link href="/dashboard/user/request">
            <Button size="lg" className="h-14 text-lg px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Plus className="mr-2 h-6 w-6" /> ยื่นคำขอใหม่
            </Button>
          </Link>
        </div>
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* 2. Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="คำขอทั้งหมด"
              value={total}
              icon={FileText}
              description="รายการในปีงบประมาณนี้"
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
              className="border-l-4 border-l-orange-400"
            />
            <StatCard
              title="อนุมัติแล้ว"
              value={approved}
              icon={BadgeCheck}
              iconClassName="bg-emerald-50 text-emerald-600"
              description="รายการที่อนุมัติสำเร็จ"
              className="border-l-4 border-l-emerald-400"
            />
          </>
        )}
      </div>

      {/* 3. Quick Filters (Pill shaped) */}
      <div className="flex flex-wrap items-center gap-3">
         <span className="text-sm font-medium text-slate-500 mr-2">กรองสถานะด่วน:</span>
         <Link href="/dashboard/user/requests">
            <Button variant="outline" className="rounded-full border-slate-200 hover:bg-slate-50 hover:text-primary">ดูทั้งหมด</Button>
          </Link>
          <Link href="/dashboard/user/requests?status=PENDING">
            <Button variant="outline" className="rounded-full bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">รอดำเนินการ</Button>
          </Link>
          <Link href="/dashboard/user/requests?status=RETURNED">
            <Button variant="outline" className="rounded-full bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">ส่งกลับแก้ไข</Button>
          </Link>
          <Link href="/dashboard/user/requests?status=DRAFT">
            <Button variant="outline" className="rounded-full bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200">ฉบับร่าง</Button>
          </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* 4. Recent Requests (Main Content) */}
        <Card className="xl:col-span-2 border-slate-200 shadow-soft rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> รายการล่าสุด
              </CardTitle>
              {requests && requests.length > 0 && (
                <Link href="/dashboard/user/requests" className="text-primary hover:underline text-sm font-medium flex items-center">
                  ดูทั้งหมด <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : !requests || requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="bg-slate-50 p-4 rounded-full mb-4">
                  <FileText className="h-10 w-10 text-slate-300" />
                </div>
                <p className="text-lg font-medium text-slate-600">ยังไม่มีรายการคำขอ</p>
                <p className="text-sm mb-6">เริ่มสร้างคำขอแรกของคุณได้เลย</p>
                <Link href="/dashboard/user/request">
                  <Button variant="outline">สร้างคำขอใหม่</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                  {sortedRequests.slice(0, 5).map((req) => (
                    <div key={req.request_id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                       <div className="flex items-start gap-4 mb-4 sm:mb-0">
                          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                             <FileText className="h-6 w-6" />
                          </div>
                          <div>
                             <Link href={`/dashboard/user/requests/${req.request_id}`} className="text-lg font-semibold text-slate-900 hover:text-primary transition-colors block mb-1">
                                {req.request_no ?? "แบบร่าง (Draft)"}
                             </Link>
                             <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                                <span className="font-medium text-slate-700">{REQUEST_TYPE_LABELS[req.request_type]}</span>
                                <span className="text-slate-300">•</span>
                                <span>{new Date(req.created_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                             </div>
                          </div>
                       </div>

                       <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                          <div className="text-right">
                            <StatusBadge status={req.status} currentStep={req.current_step} className="mb-1" />
                            <div className="text-sm font-numbers font-medium text-slate-900 text-right w-full">
                              {Number(req.requested_amount).toLocaleString()} <span className="text-slate-500 text-xs text-right">บาท</span>
                            </div>
                          </div>
                          <Link href={`/dashboard/user/requests/${req.request_id}`}>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200">
                                <Eye className="h-5 w-5 text-slate-400 group-hover:text-primary" />
                              </Button>
                          </Link>
                       </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Notifications Side Panel */}
        <Card className="h-fit border-slate-200 shadow-soft rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" /> การแจ้งเตือน
              </CardTitle>
              <Link href="/dashboard/user/notifications">
                 <Button variant="ghost" size="sm" className="text-xs">ดูทั้งหมด</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-4">
            {isNotifLoading ? (
               <div className="space-y-4">
                 {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
               </div>
            ) : latestNotifs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <BellRing className="mx-auto h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">ไม่มีการแจ้งเตือนใหม่</p>
              </div>
            ) : (
              <div className="space-y-3">
                {latestNotifs.map((n) => (
                  <div key={n.notification_id} className={`relative p-4 rounded-xl border transition-all ${!n.is_read ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className={`text-sm font-semibold ${!n.is_read ? 'text-primary' : 'text-slate-700'}`}>
                        {n.title}
                      </h4>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-2 text-right">
                      {new Date(n.created_at).toLocaleDateString('th-TH')}
                    </p>
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
