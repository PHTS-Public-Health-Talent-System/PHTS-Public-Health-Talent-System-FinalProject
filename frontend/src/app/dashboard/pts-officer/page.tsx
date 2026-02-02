"use client"

import Link from "next/link"
import {
  FileSearch,
  CalendarClock,
  DatabaseZap,
  Siren,
  ArrowRight,
  History,
  Save,
  Settings
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { usePendingApprovals } from "@/features/request/hooks"
import { usePeriods } from "@/features/payroll/hooks"
import { useDataQualityDashboard } from "@/features/data-quality/hooks"
import { useLicenseAlertsSummary } from "@/features/license-alerts/hooks"
import type { RequestWithDetails } from "@/types/request.types"
import type { PayPeriod } from "@/features/payroll/api"

type LicenseAlertsSummary = {
  expired?: number
  expiring_30?: number
  expiring_60?: number
  expiring_90?: number
  total?: number
}

type DataQualityDashboard = {
  totalIssues?: number
  criticalIssues?: number
  affectingCalculation?: number
}

export default function PtsOfficerDashboardPage() {
  const pending = usePendingApprovals()
  const periods = usePeriods()
  const dataQuality = useDataQualityDashboard()
  const licenseSummary = useLicenseAlertsSummary()

  const pendingCount = (pending.data as RequestWithDetails[] | undefined)?.length ?? 0
  const periodRows = (periods.data as PayPeriod[] | undefined) ?? []
  const openPeriods = periodRows.filter((p) => p.status === "OPEN").length
  const waitingHr = periodRows.filter((p) => p.status === "WAITING_HR").length

  const dq = (dataQuality.data as DataQualityDashboard | undefined) ?? {}
  const alerts = (licenseSummary.data as LicenseAlertsSummary | undefined) ?? {}

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">แดชบอร์ดเจ้าหน้าที่ พ.ต.ส.</h1>
        <p className="text-muted-foreground">จัดการข้อมูล ตรวจสอบเอกสาร และดูแลระบบการเบิกจ่าย</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Pending Requests */}
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">คำขอรอตรวจ</CardTitle>
            <FileSearch className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">รายการที่ต้องตรวจสอบเอกสาร</p>
            <Button asChild size="sm" className="w-full mt-3 shadow-none bg-primary/10 text-primary hover:bg-primary hover:text-white">
              <Link href="/dashboard/pts-officer/verification">ไปตรวจเอกสาร</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Open Periods */}
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">งวดที่เปิดอยู่</CardTitle>
            <CalendarClock className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{openPeriods}</div>
            <p className="text-xs text-muted-foreground mt-1">
                 รอส่งต่อ HR: <span className="font-medium text-foreground">{waitingHr}</span> งวด
            </p>
            <Button asChild size="sm" className="w-full mt-3 shadow-none bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white">
              <Link href="/dashboard/pts-officer/payroll">จัดการงวด</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Data Quality */}
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Data Quality</CardTitle>
            <DatabaseZap className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">{dq.totalIssues ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
               ประเด็นที่กระทบคำนวณ: <span className="font-medium text-destructive">{dq.affectingCalculation ?? 0}</span>
            </p>
            <Button asChild size="sm" className="w-full mt-3 shadow-none bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white">
              <Link href="/dashboard/pts-officer/data-quality">ตรวจคุณภาพข้อมูล</Link>
            </Button>
          </CardContent>
        </Card>

        {/* License Alerts */}
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">License Alerts</CardTitle>
            <Siren className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{alerts.expired ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
               ใกล้หมดอายุ (30 วัน): <span className="font-medium text-amber-600">{alerts.expiring_30 ?? 0}</span>
            </p>
            <Button asChild size="sm" className="w-full mt-3 shadow-none bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white">
              <Link href="/dashboard/pts-officer/license-alerts">ดูรายการแจ้งเตือน</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="h-6 w-1 bg-secondary rounded-full"></span>
            เครื่องมือและทางลัด
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/dashboard/pts-officer/payroll-history" className="group">
             <Card className="hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer h-full">
                 <CardContent className="p-4 flex items-center gap-4">
                     <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                         <History className="h-5 w-5" />
                     </div>
                     <div>
                         <h4 className="font-medium group-hover:text-primary">ค้นหา/ตรวจย้อนหลัง</h4>
                         <p className="text-xs text-muted-foreground">ดูประวัติการจ่ายเงินรายบุคคล</p>
                     </div>
                     <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                 </CardContent>
             </Card>
          </Link>

          <Link href="/dashboard/pts-officer/snapshots" className="group">
             <Card className="hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer h-full">
                 <CardContent className="p-4 flex items-center gap-4">
                     <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                         <Save className="h-5 w-5" />
                     </div>
                     <div>
                         <h4 className="font-medium group-hover:text-primary">Snapshots</h4>
                         <p className="text-xs text-muted-foreground">ข้อมูลที่ถูกบันทึกไว้ในแต่ละงวด</p>
                     </div>
                     <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                 </CardContent>
             </Card>
          </Link>

          <Link href="/dashboard/pts-officer/master-data" className="group">
             <Card className="hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer h-full">
                 <CardContent className="p-4 flex items-center gap-4">
                     <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                         <Settings className="h-5 w-5" />
                     </div>
                     <div>
                         <h4 className="font-medium group-hover:text-primary">ตั้งค่าข้อมูลหลัก</h4>
                         <p className="text-xs text-muted-foreground">จัดการอัตราเงินและวันหยุด</p>
                     </div>
                     <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                 </CardContent>
             </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
