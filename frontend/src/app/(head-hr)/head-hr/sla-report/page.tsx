"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingDown,
  BarChart3,
} from "lucide-react"
import { usePendingWithSla, useSlaConfigs } from "@/features/sla/hooks"

type SlaConfig = {
  step_no: number
  role_name: string
  sla_days: number
  reminder_before_days: number
  reminder_after_days: number
}

type PendingSlaItem = {
  request_id: number
  request_no: string
  citizen_id: string
  first_name?: string | null
  last_name?: string | null
  current_step: number
  step_started_at: string
  business_days_elapsed: number
  sla_days: number
  is_approaching_sla: boolean
  is_overdue: boolean
  days_until_sla: number
  days_overdue: number
}

type StepStat = {
  step: number
  label: string
  targetDays: number
  avgDays: number
  onTime: number
  total: number
  pending: number
}

const stepLabels: Record<number, string> = {
  1: "หัวหน้าตึก/หัวหน้างาน",
  2: "หัวหน้ากลุ่มงาน",
  3: "เจ้าหน้าที่ พ.ต.ส.",
  4: "หัวหน้ากลุ่มงานทรัพยากรบุคคล",
  5: "หัวหน้าการเงิน",
  6: "ผู้อำนวยการ",
}

const stepStatusLabels: Record<number, string> = {
  1: "รอหัวหน้าตึก/หัวหน้างาน",
  2: "รอหัวหน้ากลุ่มงาน",
  3: "รอเจ้าหน้าที่ตรวจสอบ",
  4: "รอ HR อนุมัติ",
  5: "รอการเงินอนุมัติ",
  6: "รอผู้อำนวยการอนุมัติ",
}

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

function getStatusColor(onTime: number) {
  if (onTime >= 90) return "text-[hsl(var(--success))]"
  if (onTime >= 80) return "text-[hsl(var(--warning))]"
  return "text-destructive"
}

function getProgressColor(onTime: number) {
  if (onTime >= 90) return "bg-[hsl(var(--success))]"
  if (onTime >= 80) return "bg-[hsl(var(--warning))]"
  return "bg-destructive"
}

export default function HeadHRSLAReportPage() {
  const [range, setRange] = useState("current")
  const rangeDates = useMemo(() => {
    const now = new Date()
    let start = new Date(now.getFullYear(), now.getMonth(), 1)
    if (range === "last30") {
      start = new Date(now)
      start.setDate(start.getDate() - 30)
    } else if (range === "last90") {
      start = new Date(now)
      start.setDate(start.getDate() - 90)
    } else if (range === "year") {
      start = new Date(now.getFullYear(), 0, 1)
    }
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const toDateStr = (value: Date) => value.toISOString().slice(0, 10)
    return { start: toDateStr(start), end: toDateStr(end) }
  }, [range])

  const pendingQuery = usePendingWithSla(rangeDates)
  const configsQuery = useSlaConfigs()

  const configMap = useMemo(() => {
    const configs = (configsQuery.data ?? []) as SlaConfig[]
    const map = new Map<number, SlaConfig>()
    configs.forEach((config) => map.set(config.step_no, config))
    return map
  }, [configsQuery.data])

  const pendingItems = (pendingQuery.data ?? []) as PendingSlaItem[]

  const filteredPending = pendingItems

  const stepStats = useMemo(() => {
    const map = new Map<number, {
      count: number
      overdue: number
      approaching: number
      totalDays: number
    }>()
    filteredPending.forEach((item) => {
      const current = map.get(item.current_step) ?? {
        count: 0,
        overdue: 0,
        approaching: 0,
        totalDays: 0,
      }
      current.count += 1
      current.totalDays += item.business_days_elapsed ?? 0
      if (item.is_overdue) current.overdue += 1
      if (item.is_approaching_sla) current.approaching += 1
      map.set(item.current_step, current)
    })
    return map
  }, [filteredPending])

  const slaSteps = useMemo<StepStat[]>(() => {
    return Object.entries(stepLabels).map(([stepKey, label]) => {
      const step = Number(stepKey)
      const stats = stepStats.get(step)
      const config = configMap.get(step)
      const count = stats?.count ?? 0
      const overdue = stats?.overdue ?? 0
      const approaching = stats?.approaching ?? 0
      const onTimeCount = Math.max(0, count - overdue - approaching)
      const onTime = count > 0 ? Math.round((onTimeCount / count) * 100) : 0
      const avgDays = count > 0 ? Number((stats?.totalDays ?? 0) / count) : 0
      return {
        step,
        label,
        targetDays: config?.sla_days ?? 0,
        avgDays,
        onTime,
        total: count,
        pending: count,
      }
    })
  }, [configMap, stepStats])

  const totalPending = filteredPending.length
  const overdueCount = filteredPending.filter((item) => item.is_overdue).length
  const withinCount = filteredPending.filter(
    (item) => !item.is_overdue && !item.is_approaching_sla,
  ).length
  const overallOnTime = totalPending > 0
    ? Math.round((withinCount / totalPending) * 100)
    : 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">รายงาน SLA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ติดตามประสิทธิภาพการดำเนินงานตามเวลาที่กำหนด
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="เลือกช่วงเวลา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">เดือนปัจจุบัน</SelectItem>
              <SelectItem value="last30">30 วันล่าสุด</SelectItem>
              <SelectItem value="last90">90 วันล่าสุด</SelectItem>
              <SelectItem value="year">ทั้งปี</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLA เฉลี่ยรวม</p>
                <p className={`text-2xl font-bold ${getStatusColor(overallOnTime)}`}>{overallOnTime}%</p>
              </div>
              <div className={`rounded-lg p-3 ${overallOnTime >= 90 ? "bg-[hsl(var(--success))]/10" : overallOnTime >= 80 ? "bg-[hsl(var(--warning))]/10" : "bg-destructive/10"}`}>
                <BarChart3 className={`h-5 w-5 ${getStatusColor(overallOnTime)}`} />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              อัปเดตจากรายการค้างล่าสุด
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
                <p className="text-2xl font-bold text-foreground">{totalPending}</p>
              </div>
              <div className="rounded-lg bg-[hsl(var(--warning))]/10 p-3">
                <Clock className="h-5 w-5 text-[hsl(var(--warning))]" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              ใน 6 ขั้นตอน
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เกินกำหนด</p>
                <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-destructive">
              <TrendingDown className="mr-1 h-3 w-3" />
              ต้องเร่งดำเนินการ
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ดำเนินการแล้ว</p>
                <p className="text-2xl font-bold text-[hsl(var(--success))]">{withinCount}</p>
              </div>
              <div className="rounded-lg bg-[hsl(var(--success))]/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              เดือนนี้
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA by Step */}
      <Card className="mb-6 bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">SLA แยกตามขั้นตอน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {slaSteps.map((step) => (
              <div key={step.step} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                      {step.step}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{step.label}</p>
                      <p className="text-xs text-muted-foreground">
                        เป้าหมาย: {step.targetDays} วัน | เฉลี่ย: {step.avgDays.toFixed(1)} วัน
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${getStatusColor(step.onTime)}`}>
                        {step.onTime}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.total} รายการ | รอ {step.pending}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <Progress value={step.onTime} className="h-2" />
                  <div
                    className={`absolute top-0 h-2 rounded-full ${getProgressColor(step.onTime)}`}
                    style={{ width: `${step.onTime}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Items */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">รายการที่เกินหรือใกล้เกินกำหนด</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสคำขอ</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>ขั้นตอนปัจจุบัน</TableHead>
                <TableHead>วันที่เข้าขั้นตอน</TableHead>
                <TableHead className="text-center">จำนวนวัน</TableHead>
                <TableHead className="text-center">เป้าหมาย</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPending.map((item) => {
                const name = [item.first_name, item.last_name].filter(Boolean).join(" ").trim() || "-"
                const status = item.is_overdue ? "danger" : item.is_approaching_sla ? "warning" : "normal"
                return (
                <TableRow key={item.request_id}>
                  <TableCell className="font-mono text-sm">{item.request_no}</TableCell>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{item.current_step}</p>
                      <p className="text-xs text-muted-foreground">{stepStatusLabels[item.current_step] ?? "-"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(item.step_started_at)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold ${status === "danger" ? "text-destructive" : status === "warning" ? "text-[hsl(var(--warning))]" : "text-muted-foreground"}`}>
                      {item.business_days_elapsed} วัน
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {item.sla_days} วัน
                  </TableCell>
                  <TableCell className="text-center">
                    {status === "danger" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                        <XCircle className="h-3 w-3" />
                        เกินกำหนด
                      </span>
                    ) : status === "warning" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--warning))]/10 px-2.5 py-1 text-xs font-medium text-[hsl(var(--warning))]">
                        <AlertTriangle className="h-3 w-3" />
                        ใกล้เกิน
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--success))]/10 px-2.5 py-1 text-xs font-medium text-[hsl(var(--success))]">
                        <CheckCircle2 className="h-3 w-3" />
                        อยู่ใน SLA
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
          {filteredPending.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              ไม่พบรายการที่เข้าเงื่อนไขช่วงเวลานี้
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
