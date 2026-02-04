"use client";

import {
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Users,
  CreditCard,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { StatCard } from "@/components/common/stat-card";
import { usePendingApprovals } from "@/features/request/hooks";
import { usePeriods } from "@/features/payroll/hooks";
import { useLicenseAlertsSummary } from "@/features/license-alerts/hooks";
import { PayPeriod } from "@/features/payroll/api";

export default function PtsOfficerDashboardPage() {
  const { } = useAuth();
  
  // Data Fetching
  const { data: pendingRequests, isLoading: isRequestsLoading } = usePendingApprovals();
  const { data: periods, isLoading: isPeriodsLoading } = usePeriods();
  const { data: licenseSummary, isLoading: isLicenseLoading } = useLicenseAlertsSummary();

  // 1. Pending Requests Count
  const pendingCount = pendingRequests?.length ?? 0;

  // 2. Open Period Info
  const openPeriod = periods?.find((p: PayPeriod) => p.status === 'OPEN');
  
  // 3. License Alerts
  const licenseAlerts = licenseSummary?.total ?? 0;

  const isLoading = isRequestsLoading || isPeriodsLoading || isLicenseLoading;

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-white border border-indigo-100 shadow-sm">
        <div className="p-8 flex flex-col md:flex-row md:items-center md:gap-8 justify-between gap-6 relative z-10">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Dashboard เจ้าหน้าที่ พ.ต.ส.
            </h1>
            <p className="text-slate-600 text-base leading-relaxed">
              จัดการคำขอ, ตรวจสอบข้อมูล, และดูแลระบบบัญชีเงินเดือน
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-center">
             <Link href="/dashboard/pts-officer/verification">
                <Button size="lg" className="h-12 px-6 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all">
                  <CheckCircle2 className="mr-2 h-5 w-5" /> ตรวจสอบคำขอ
                </Button>
             </Link>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* 2. Key Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <Link href="/dashboard/pts-officer/verification" className="block group">
                <StatCard
                  title="คำขอรอตรวจสอบ"
                  value={pendingCount}
                  icon={FileText}
                  iconClassName="bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors"
                  description="รายการที่ต้องดำเนินการ"
                  className="group-hover:border-blue-200 transition-all cursor-pointer h-full hover:translate-y-0"
                />
            </Link>
            
            <Link href="/dashboard/pts-officer/payroll" className="block group">
                <StatCard
                  title="งวดเดือนปัจจุบัน"
                  value={openPeriod ? `${openPeriod.period_month}/${openPeriod.period_year}` : "ไม่มีงวดเปิด"}
                  icon={Calendar}
                  iconClassName="bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors"
                  description={openPeriod ? "สถานะ: เปิดใช้งาน" : "สร้างงวดใหม่"}
                  className="group-hover:border-emerald-200 transition-all cursor-pointer h-full hover:translate-y-0"
                />
            </Link>

            <Link href="/dashboard/pts-officer/license-alerts" className="block group">
                <StatCard
                  title="แจ้งเตือนใบอนุญาต"
                  value={licenseAlerts}
                  icon={AlertTriangle}
                  iconClassName="bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-colors"
                  description="หมดอายุ / ใกล้หมดอายุ"
                  className="group-hover:border-rose-200 transition-all cursor-pointer h-full hover:translate-y-0"
                />
            </Link>
          </>
        )}
      </div>

      {/* 3. Quick Actions Grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" /> เมนูจัดการด่วน
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
             <Link href="/dashboard/pts-officer/verification">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 active:scale-100">
                    <CheckCircle2 className="h-6 w-6" />
                    <span>ตรวจสอบคำขอ</span>
                </Button>
            </Link>
             <Link href="/dashboard/pts-officer/payroll">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 active:scale-100">
                    <CreditCard className="h-6 w-6" />
                    <span>จัดการบัญชีเงินเดือน</span>
                </Button>
            </Link>
             <Link href="/dashboard/pts-officer/master-data">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-200 active:scale-100">
                    <Search className="h-6 w-6" />
                    <span>จัดการข้อมูลหลัก</span>
                </Button>
            </Link>
        </div>
      </div>
    </div>
  );
}
