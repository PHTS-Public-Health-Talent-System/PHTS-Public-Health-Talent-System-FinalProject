"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Send,
  FileText,
  Download,
  Calendar,
  Users,
  Banknote,
  AlertCircle,
  ChevronRight,
  Calculator,
} from "lucide-react"
import { YearPicker } from "@/components/month-year-picker"
import { toast } from "sonner"
import type { AxiosError } from "axios"
import {
  useCalculatePeriod,
  useCreatePeriod,
  useDownloadPeriodReport,
  usePeriodPayouts,
  usePeriods,
  useSubmitToHR,
} from "@/features/payroll/hooks"
import type { PayPeriod, PeriodPayoutRow } from "@/features/payroll/api"
import { usePayrollReviewProgress } from "@/features/payroll/usePayrollReviewProgress"
import { normalizeProfessionCode, resolveProfessionLabel } from "@/shared/constants/profession"

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
]

type PeriodStatus = "draft" | "pending_hr" | "approved_hr" | "approved_director" | "paid"

type PayrollPeriod = {
  id: string
  label: string
  month: string
  year: string
  status: PeriodStatus
  totalPersons: number
  totalAmount: number
  createdAt: string
}

function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return "-"
  const [year, month, day] = dateStr.split("T")[0].split("-")
  const yearNum = Number.parseInt(year)
  const thaiYear = yearNum > 2400 ? yearNum : yearNum + 543
  return `${Number.parseInt(day)} ${thaiMonths[Number.parseInt(month) - 1]} ${thaiYear}`
}

function mapStatus(status?: string | null): PeriodStatus {
  switch (status) {
    case "OPEN":
      return "draft"
    case "WAITING_HR":
      return "pending_hr"
    case "WAITING_HEAD_FINANCE":
      return "approved_hr"
    case "WAITING_DIRECTOR":
      return "approved_director"
    case "CLOSED":
      return "paid"
    default:
      return "draft"
  }
}

function mapPeriod(period: PayPeriod): PayrollPeriod {
  const monthName = thaiMonths[(period.period_month ?? 1) - 1] ?? "-"
  const yearNum = period.period_year ?? 0
  const thaiYear = yearNum > 2400 ? yearNum : yearNum + 543
  return {
    id: String(period.period_id),
    label: `${monthName} ${thaiYear}`,
    month: monthName,
    year: String(thaiYear),
    status: mapStatus(period.status),
    totalPersons: Number(period.total_headcount ?? 0),
    totalAmount: Number(period.total_amount ?? 0),
    createdAt: formatThaiDate(period.created_at ?? undefined),
  }
}

function getStatusBadge(status: PeriodStatus) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="bg-secondary">เปิดรอบ</Badge>
    case "pending_hr":
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">รอ HR อนุมัติ</Badge>
    case "approved_hr":
      return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">รอหัวหน้าการเงิน</Badge>
    case "approved_director":
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">รอผู้อำนวยการ</Badge>
    case "paid":
      return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">ปิดงวดแล้ว</Badge>
  }
}

export default function PayrollPage() {
  const periodsQuery = usePeriods()
  const createPeriod = useCreatePeriod()
  const calculatePeriod = useCalculatePeriod()
  const submitToHR = useSubmitToHR()
  const downloadReport = useDownloadPeriodReport()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createMonth, setCreateMonth] = useState("01")
  const [createYear, setCreateYear] = useState(2569)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")

  const periods = useMemo<PayrollPeriod[]>(() => {
    const data = (periodsQuery.data ?? []) as PayPeriod[]
    return [...data]
      .sort((a, b) => {
        const yearDiff = (b.period_year ?? 0) - (a.period_year ?? 0)
        if (yearDiff !== 0) return yearDiff
        return (b.period_month ?? 0) - (a.period_month ?? 0)
      })
      .map((period) => mapPeriod(period))
  }, [periodsQuery.data])

  const currentPeriod = useMemo(() => {
    if (!periods.length) return null
    if (!selectedPeriodId) return periods[0]
    return periods.find((period) => period.id === selectedPeriodId) ?? periods[0]
  }, [periods, selectedPeriodId])

  const { data: payoutsData } = usePeriodPayouts(currentPeriod?.id)
  const { reviewedCodes } = usePayrollReviewProgress(currentPeriod?.id ?? "")

  const professionProgress = useMemo(() => {
    const rows = (payoutsData ?? []) as PeriodPayoutRow[]
    const totals = new Map<string, { label: string; count: number; amount: number }>()
    rows.forEach((row) => {
      const code = normalizeProfessionCode(row.profession_code)
      if (!code) return
      const current = totals.get(code) ?? {
        label: resolveProfessionLabel(code, code),
        count: 0,
        amount: 0,
      }
      current.count += 1
      current.amount += Number(row.total_payable ?? 0)
      totals.set(code, current)
    })

    const reviewedSet = new Set((reviewedCodes ?? []).map((item) => normalizeProfessionCode(item)))
    const items = Array.from(totals.entries())
      .map(([code, data]) => ({
        code,
        label: data.label,
        count: data.count,
        amount: data.amount,
        reviewed: reviewedSet.has(code),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"))

    return {
      items,
      total: items.length,
      reviewed: items.filter((item) => item.reviewed).length,
    }
  }, [payoutsData, reviewedCodes])

  const canSubmit = !!currentPeriod && currentPeriod.status === "draft" && professionProgress.total > 0 && professionProgress.total === professionProgress.reviewed

  const handleCreatePeriod = async () => {
    const year = createYear > 2400 ? createYear - 543 : createYear
    const month = Number.parseInt(createMonth)
    try {
      await createPeriod.mutateAsync({ year, month })
      toast.success("สร้างรอบจ่ายเงินเรียบร้อย")
      setIsCreateDialogOpen(false)
      periodsQuery.refetch()
    } catch {
      toast.error("ไม่สามารถสร้างรอบจ่ายเงินได้")
    }
  }

  const handleCalculate = async () => {
    if (!currentPeriod) return
    try {
      await calculatePeriod.mutateAsync(currentPeriod.id)
      toast.success("คำนวณรอบเรียบร้อย")
      periodsQuery.refetch()
    } catch {
      toast.error("ไม่สามารถคำนวณรอบได้")
    }
  }

  const handleSubmitToHR = async () => {
    if (!currentPeriod) return
    if (!canSubmit) {
      toast.error("ต้องยืนยันตรวจครบทุกวิชาชีพก่อนส่ง HR")
      return
    }
    try {
      await submitToHR.mutateAsync(currentPeriod.id)
      toast.success("ส่งให้ HR อนุมัติเรียบร้อย")
      periodsQuery.refetch()
    } catch (error) {
      const apiError = error as AxiosError<{ error?: string }>
      const message = apiError.response?.data?.error ?? "ไม่สามารถส่งให้ HR อนุมัติได้"
      toast.error(message)
    }
  }

  const handleDownload = async () => {
    if (!currentPeriod) return
    try {
      const blob = await downloadReport.mutateAsync(currentPeriod.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `payroll-period-${currentPeriod.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("ไม่สามารถดาวน์โหลดรายงานได้")
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการรอบจ่ายเงิน (PTS Officer)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            สร้างรอบ คำนวณ ตรวจรายวิชาชีพ และส่งให้ HR อนุมัติ
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              สร้างรอบใหม่
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>สร้างรอบจ่ายเงินใหม่</DialogTitle>
              <DialogDescription>เลือกเดือนและปีสำหรับสร้างรอบใหม่</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">เดือน</label>
                <Select value={createMonth} onValueChange={setCreateMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเดือน" />
                  </SelectTrigger>
                  <SelectContent>
                    {thaiMonths.map((month, index) => (
                      <SelectItem key={month} value={`${index + 1}`.padStart(2, "0")}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">ปี พ.ศ.</label>
                <YearPicker value={createYear} onChange={setCreateYear} minYear={2550} maxYear={2600} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleCreatePeriod}>สร้างรอบ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">รอบที่เลือก</p>
                <p className="text-2xl font-bold text-foreground">{currentPeriod ? `${currentPeriod.month} ${currentPeriod.year}` : "-"}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">จำนวนผู้รับเงิน</p>
                <p className="text-2xl font-bold text-primary">{currentPeriod?.totalPersons ?? 0} คน</p>
              </div>
              <Users className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดรวม</p>
                <p className="text-2xl font-bold text-[hsl(var(--success))]">{Number(currentPeriod?.totalAmount ?? 0).toLocaleString()} บาท</p>
              </div>
              <Banknote className="h-8 w-8 text-[hsl(var(--success))]/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">สถานะ</p>
                <div className="mt-1">{currentPeriod ? getStatusBadge(currentPeriod.status) : <span>-</span>}</div>
              </div>
              <AlertCircle className="h-8 w-8 text-[hsl(var(--warning))]/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg font-semibold">Workflow รอบที่เลือก</CardTitle>
            <div className="w-full md:w-[320px]">
              <Select
                value={currentPeriod?.id ?? ""}
                onValueChange={(value) => setSelectedPeriodId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกงวดที่ต้องการจัดการ" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.label} (#{period.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <p className="text-sm text-muted-foreground">ขั้นตอน</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">1. สร้างรอบ</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">2. คำนวณ</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">3. ตรวจรายวิชาชีพ</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">4. ส่ง HR</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={handleCalculate} disabled={!currentPeriod || currentPeriod.status !== "draft"}>
              <Calculator className="h-4 w-4" />
              คำนวณใหม่
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleDownload} disabled={!currentPeriod}>
              <Download className="h-4 w-4" />
              ดาวน์โหลดรายงาน
            </Button>
            <Button className="gap-2 bg-primary" onClick={handleSubmitToHR} disabled={!canSubmit || submitToHR.isPending}>
              <Send className="h-4 w-4" />
              ส่งให้ HR อนุมัติ
            </Button>
            {currentPeriod && (
              <Button variant="secondary" className="gap-2" asChild>
                <Link href={`/pts-officer/payroll/${currentPeriod.id}`}>
                  <FileText className="h-4 w-4" />
                  ตรวจรายวิชาชีพ
                </Link>
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">ความคืบหน้าการตรวจวิชาชีพ</p>
              <p className="text-sm text-muted-foreground">
                {professionProgress.reviewed}/{professionProgress.total}
              </p>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {professionProgress.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลวิชาชีพในรอบนี้</p>
              ) : (
                professionProgress.items.map((item) => (
                  <div key={item.code} className="rounded-md border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.label}</p>
                      <Badge
                        variant="outline"
                        className={item.reviewed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}
                      >
                        {item.reviewed ? "ตรวจแล้ว" : "รอตรวจ"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.count} คน • {item.amount.toLocaleString()} บาท</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {!canSubmit && currentPeriod?.status === "draft" && (
            <p className="text-sm text-amber-500">
              ต้องตรวจและยืนยันครบทุกวิชาชีพก่อนจึงจะส่งให้ HR ได้
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">ประวัติรอบจ่ายเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                  <TableHead className="font-semibold">รหัสรอบ</TableHead>
                  <TableHead className="font-semibold">เดือน/ปี</TableHead>
                  <TableHead className="font-semibold text-center">จำนวนคน</TableHead>
                  <TableHead className="font-semibold text-right">ยอดรวม (บาท)</TableHead>
                  <TableHead className="font-semibold">สถานะ</TableHead>
                  <TableHead className="font-semibold">วันที่สร้าง</TableHead>
                  <TableHead className="font-semibold text-center">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id} className="hover:bg-secondary/20">
                    <TableCell className="font-mono text-sm">{period.id}</TableCell>
                    <TableCell className="font-medium">{period.month} {period.year}</TableCell>
                    <TableCell className="text-center">{period.totalPersons}</TableCell>
                    <TableCell className="text-right font-semibold">{period.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(period.status)}</TableCell>
                    <TableCell className="text-muted-foreground">{period.createdAt}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="gap-1" asChild>
                        <Link href={`/pts-officer/payroll/${period.id}`}>
                          ดูรายละเอียด
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
