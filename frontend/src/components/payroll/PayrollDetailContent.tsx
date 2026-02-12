"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Users,
  Banknote,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  FileText,
  Eye,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import {
  useApproveByHR,
  useDownloadPeriodReport,
  usePeriodDetail,
  usePeriodPayouts,
  useRejectPeriod,
} from "@/features/payroll/hooks"
import type { PeriodPayoutRow, PeriodDetail } from "@/features/payroll/api"
import { useRateHierarchy } from "@/features/master-data/hooks"
import type { ProfessionHierarchy } from "@/features/master-data/api"
import { useRequestDetail } from "@/features/request/hooks"
import { normalizeRateMapping, resolveRateMappingDisplay } from "@/app/(user)/user/request-detail-rate-mapping"
import { buildAttachmentUrl } from "@/app/(user)/user/request-detail-attachments"
import { normalizeProfessionCode, resolveProfessionLabel } from "@/shared/constants/profession"

type PeriodStatus = "OPEN" | "WAITING_HR" | "WAITING_HEAD_FINANCE" | "WAITING_DIRECTOR" | "CLOSED"

type PayrollRow = {
  id: number
  citizenId: string
  requestId: number | null
  title: string
  name: string
  position: string
  department: string
  professionCode: string
  rateGroup: string
  groupNo: string
  itemNo: string
  subItemNo: string
  baseRate: number
  retroactiveAmount: number
  workDays: number
  leaveDays: number
  totalAmount: number
  note?: string
}

type PayrollDetailContentProps = {
  periodId: string
  selectedProfession: string
  basePath: string
  compactView?: boolean
  showTable?: boolean
  showSummary?: boolean
  showSelector?: boolean
  backHref?: string
  allowApprovalActions?: boolean
  reviewedProfessionCodes?: string[]
  onSetProfessionReviewed?: (professionCode: string, reviewed: boolean) => void
  onSubmitForReview?: () => Promise<void>
  isSubmittingForReview?: boolean
  onAvailableProfessionsChange?: (professions: { code: string; label: string }[]) => void
}

const professionDescriptions: Record<string, string> = {
  NURSE: "ผู้ประกอบวิชาชีพการพยาบาลและการผดุงครรภ์",
  PHYSICIAN: "แพทย์/ผู้อำนวยการโรงพยาบาล",
  MED_TECH: "ผู้ประกอบวิชาชีพเทคนิคการแพทย์",
  PHYSICAL_THERAPY: "ผู้ประกอบวิชาชีพกายภาพบำบัด",
  OCCUPATIONAL_THERAPY: "ผู้ประกอบวิชาชีพกิจกรรมบำบัด",
  RADIOLOGIST: "ผู้ประกอบวิชาชีพรังสีการแพทย์",
  PHARMACIST: "ผู้ประกอบวิชาชีพเภสัชกรรม",
  DENTIST: "ผู้ประกอบวิชาชีพทันตกรรม",
  CLINICAL_PSYCHOLOGIST: "ผู้ประกอบวิชาชีพจิตวิทยาคลินิก",
  CARDIO_THORACIC_TECH: "ผู้ประกอบวิชาชีพเทคโนโลยีหัวใจและทรวงอก",
}

const parseGroupNumber = (value?: string) => {
  if (!value) return null
  const match = value.match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isNaN(parsed) ? null : parsed
}

const formatPeriodLabel = (month?: number | null, year?: number | null) => {
  if (!month || !year) return "-"
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" })
}

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

const statusConfig: Record<PeriodStatus, { label: string; color: string }> = {
  OPEN: { label: "เปิดรอบ", color: "bg-muted/30 text-muted-foreground border-muted-foreground/30" },
  WAITING_HR: { label: "รอ HR อนุมัติ", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  WAITING_HEAD_FINANCE: { label: "รอหัวหน้าการเงิน", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  WAITING_DIRECTOR: { label: "รอผู้อำนวยการ", color: "bg-primary/20 text-primary border-primary/30" },
  CLOSED: { label: "ปิดงวดแล้ว", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
}

export function PayrollDetailContent({
  periodId,
  selectedProfession,
  basePath,
  compactView = false,
  showTable = true,
  showSummary = true,
  showSelector = true,
  backHref = "/head-hr/payroll",
  allowApprovalActions = true,
  reviewedProfessionCodes = [],
  onSetProfessionReviewed,
  onSubmitForReview,
  isSubmittingForReview = false,
  onAvailableProfessionsChange,
}: PayrollDetailContentProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [rateFilter, setRateFilter] = useState("all")
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [comment, setComment] = useState("")
  const [selectedRow, setSelectedRow] = useState<PayrollRow | null>(null)

  const periodDetailQuery = usePeriodDetail(periodId)
  const payoutsQuery = usePeriodPayouts(periodId)
  const rateHierarchyQuery = useRateHierarchy()
  const requestDetailQuery = useRequestDetail(selectedRow?.requestId ?? undefined)
  const approveByHR = useApproveByHR()
  const rejectPeriod = useRejectPeriod()
  const downloadReport = useDownloadPeriodReport()

  const periodDetail = periodDetailQuery.data as PeriodDetail | undefined
  const period = periodDetail?.period
  const statusInfo = statusConfig[(period?.status as PeriodStatus) ?? "OPEN"]

  const { professionCards, professionGroups } = useMemo(() => {
    const hierarchy = (rateHierarchyQuery.data ?? []) as ProfessionHierarchy[]
    if (hierarchy.length) {
      const cards = hierarchy
        .map((profession) => {
          const internalCode = normalizeProfessionCode(profession.id)
          const rates = Array.from(
            new Set(
              profession.groups
                .map((group) => Number(group.rate))
                .filter((rate) => Number.isFinite(rate) && rate > 0),
            ),
          ).sort((a, b) => a - b)
          return {
            code: internalCode,
            label: profession.name,
            description: professionDescriptions[internalCode] ?? "",
            rates,
          }
        })
        .filter((card) => Boolean(card.code))

      const groups: Record<string, { group: number; rate: number }[]> = {}
      hierarchy.forEach((profession) => {
        const internalCode = normalizeProfessionCode(profession.id)
        groups[internalCode] = profession.groups.map((group, index) => ({
          group: parseGroupNumber(group.name) ?? index + 1,
          rate: Number(group.rate),
        }))
      })

      return {
        professionCards: cards,
        professionGroups: groups,
      }
    }

    // Fallback from calculated payouts (no hardcoded rate table)
    const rawRows = (payoutsQuery.data ?? []) as PeriodPayoutRow[]
    const groupsMap = new Map<string, Map<string, { group: number; rate: number }>>()

    rawRows.forEach((row) => {
      const mappedCode = normalizeProfessionCode(row.profession_code)
      if (!mappedCode) return
      const rate = Number(row.rate ?? 0)
      if (!Number.isFinite(rate) || rate <= 0) return
      const groupNo = row.group_no !== null && row.group_no !== undefined ? Number(row.group_no) : null
      if (!groupsMap.has(mappedCode)) groupsMap.set(mappedCode, new Map())
      const byRate = groupsMap.get(mappedCode)!
      const key = `${groupNo ?? 0}-${rate}`
      if (!byRate.has(key)) {
        byRate.set(key, {
          group: Number.isFinite(groupNo) && groupNo !== null ? groupNo : byRate.size + 1,
          rate,
        })
      }
    })

    const groups: Record<string, { group: number; rate: number }[]> = {}
    const cards = Array.from(groupsMap.entries())
      .map(([code, value]) => {
        const groupList = Array.from(value.values()).sort((a, b) => a.group - b.group)
        groups[code] = groupList
        return {
          code,
          label: resolveProfessionLabel(code, code),
          description: professionDescriptions[code] ?? "",
          rates: groupList.map((item) => item.rate),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, "th"))

    return {
      professionCards: cards,
      professionGroups: groups,
    }
  }, [rateHierarchyQuery.data, payoutsQuery.data])

  useEffect(() => {
    if (!onAvailableProfessionsChange) return
    onAvailableProfessionsChange(
      professionCards.map((profession) => ({ code: profession.code, label: profession.label })),
    )
  }, [onAvailableProfessionsChange, professionCards])

  const itemByCitizenId = useMemo(() => {
    const map = new Map<string, PeriodDetail["items"][number]>()
    periodDetail?.items?.forEach((item) => {
      const citizenId = item.citizen_id ?? ""
      if (citizenId) map.set(citizenId, item)
    })
    return map
  }, [periodDetail?.items])

  const enrichedPayouts = useMemo(() => {
    const rows = (payoutsQuery.data ?? []) as PeriodPayoutRow[]
    return rows.map((row) => {
      const citizenId = row.citizen_id ?? ""
      const item = citizenId ? itemByCitizenId.get(citizenId) : undefined
      const title = row.title ?? "-"
      const firstName = row.first_name ?? item?.first_name ?? ""
      const lastName = row.last_name ?? item?.last_name ?? ""
      const positionName = row.position_name ?? item?.position_name ?? "-"
      const department = row.department ?? item?.current_department ?? "-"
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || "-"

      const professionCode = normalizeProfessionCode(row.profession_code)

      const baseRate = Number(row.rate ?? 0)
      const groupNoFromRow =
        row.group_no !== null && row.group_no !== undefined ? String(row.group_no) : "-"
      const groupNoFromRate = professionGroups[professionCode]
        ?.find((group) => group.rate === baseRate)
        ?.group?.toString()
      const groupNo = groupNoFromRow !== "-" ? groupNoFromRow : groupNoFromRate ?? "-"
      const rateGroup = groupNo
      const itemNo = row.item_no !== null && row.item_no !== undefined ? String(row.item_no) : "-"
      const subItemNo = row.sub_item_no !== null && row.sub_item_no !== undefined ? String(row.sub_item_no) : "-"
      const retroactiveAmount = Number(row.retroactive_amount ?? 0)
      const totalAmount = Number(row.total_payable ?? 0)

      return {
        id: row.payout_id,
        citizenId,
        requestId: row.request_id ?? item?.request_id ?? null,
        title,
        name: fullName,
        position: positionName,
        department,
        professionCode,
        rateGroup,
        groupNo,
        itemNo,
        subItemNo,
        baseRate,
        retroactiveAmount,
        workDays: Number(row.eligible_days ?? 0),
        leaveDays: Number(row.deducted_days ?? 0),
        totalAmount,
        note: row.remark ?? undefined,
      } satisfies PayrollRow
    })
  }, [payoutsQuery.data, itemByCitizenId, professionGroups])

  const selectedRequest = requestDetailQuery.data
  const selectedRateMapping = useMemo(
    () => normalizeRateMapping(selectedRequest?.submission_data ?? null),
    [selectedRequest?.submission_data],
  )
  const selectedRateDisplay = useMemo(
    () =>
      selectedRateMapping
        ? resolveRateMappingDisplay(selectedRateMapping, rateHierarchyQuery.data)
        : null,
    [selectedRateMapping, rateHierarchyQuery.data],
  )
  const selectedAttachments = selectedRequest?.attachments ?? []
  const deductionReasons = useMemo(() => {
    if (!selectedRow) return []
    const reasons: string[] = []
    if (selectedRow.leaveDays > 0) {
      reasons.push(`ถูกหักตามวันลา/ขาดสิทธิ ${selectedRow.leaveDays.toLocaleString()} วัน`)
    }
    const expectedAmount = selectedRow.baseRate + Math.max(0, selectedRow.retroactiveAmount)
    const deductedAmount = Math.max(0, expectedAmount - selectedRow.totalAmount)
    if (deductedAmount > 0) {
      reasons.push(`จำนวนเงินถูกหัก ${deductedAmount.toLocaleString()} บาท จากยอดที่ควรได้รับ`)
    }
    if (selectedRow.note && selectedRow.note.trim()) {
      reasons.push(`หมายเหตุระบบ: ${selectedRow.note}`)
    }
    if (reasons.length === 0) {
      reasons.push("รายการนี้ไม่ได้ถูกหักเงิน")
    }
    return reasons
  }, [selectedRow])

  const professionTotals = useMemo(() => {
    const totals = new Map<string, number>()
    professionCards.forEach((card) => totals.set(card.code, 0))
    enrichedPayouts.forEach((row) => {
      if (!totals.has(row.professionCode)) totals.set(row.professionCode, 0)
      totals.set(row.professionCode, (totals.get(row.professionCode) ?? 0) + row.totalAmount)
    })
    return totals
  }, [enrichedPayouts, professionCards])

  const filteredPersons = useMemo(() => {
    return enrichedPayouts.filter((person) => {
      const matchesSearch =
        person.name.includes(searchQuery) || person.department.includes(searchQuery)
      const matchesRate = rateFilter === "all" || person.groupNo === rateFilter
      const matchesProfession = selectedProfession === "all" || person.professionCode === selectedProfession
      return matchesSearch && matchesRate && matchesProfession
    })
  }, [enrichedPayouts, rateFilter, searchQuery, selectedProfession])

  const reviewedCodeSet = useMemo(
    () => new Set((reviewedProfessionCodes ?? []).map((code) => code.toUpperCase())),
    [reviewedProfessionCodes],
  )
  const totalProfessionCount = professionCards.length
  const reviewedCount = useMemo(
    () => professionCards.filter((profession) => reviewedCodeSet.has(profession.code.toUpperCase())).length,
    [professionCards, reviewedCodeSet],
  )
  const currentProfessionReviewed =
    selectedProfession !== "all" && reviewedCodeSet.has(selectedProfession.toUpperCase())
  const remainingProfessions = useMemo(
    () =>
      professionCards.filter(
        (profession) => !reviewedCodeSet.has(profession.code.toUpperCase()),
      ),
    [professionCards, reviewedCodeSet],
  )
  const canSubmitReview =
    !!onSubmitForReview &&
    selectedProfession !== "all" &&
    totalProfessionCount > 0 &&
    reviewedCount === totalProfessionCount

  const availableGroups = useMemo(() => {
    const rows =
      selectedProfession === "all"
        ? enrichedPayouts
        : enrichedPayouts.filter((row) => row.professionCode === selectedProfession)
    const groups = new Set<string>()
    rows.forEach((row) => {
      if (row.groupNo !== "-" && row.groupNo) groups.add(row.groupNo)
    })
    return Array.from(groups).sort((a, b) => Number(a) - Number(b))
  }, [enrichedPayouts, selectedProfession])

  const handleAction = async () => {
    if (!actionType) return
    const trimmed = comment.trim()
    if (actionType === "reject" && !trimmed) {
      toast.error("กรุณาระบุเหตุผลก่อนปฏิเสธ")
      return
    }
    try {
      if (actionType === "approve") {
        await approveByHR.mutateAsync(periodId)
        toast.success("อนุมัติรอบจ่ายเงินแล้ว")
      } else {
        await rejectPeriod.mutateAsync({ periodId, payload: { reason: trimmed } })
        toast.success("ปฏิเสธรอบจ่ายเงินแล้ว")
      }
      periodDetailQuery.refetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด"
      toast.error(message)
    } finally {
      setActionType(null)
      setComment("")
    }
  }

  const handleSelectProfession = (code: string) => {
    setSearchQuery("")
    setRateFilter("all")
    if (code === "all") {
      router.push(basePath)
      return
    }
    router.push(`${basePath}/profession/${code}`)
  }

  if (periodDetailQuery.isLoading || payoutsQuery.isLoading) {
    return (
      <div className="p-8">
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            กำลังโหลดข้อมูลรอบจ่ายเงิน...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (periodDetailQuery.isError || payoutsQuery.isError) {
    return (
      <div className="p-8">
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center text-destructive">
            โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                รอบจ่ายเงิน {formatPeriodLabel(period?.period_month ?? null, period?.period_year ?? null)}
              </h1>
              <Badge variant="outline" className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              ส่งโดย {period?.created_by_name ?? "-"} เมื่อ {formatDate(period?.created_at ?? null)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            ส่งออก Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const blob = await downloadReport.mutateAsync(periodId)
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = `payroll_${periodId}.pdf`
                link.click()
                window.URL.revokeObjectURL(url)
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "ไม่สามารถดาวน์โหลดรายงานได้"
                toast.error(message)
              }
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            ส่งออก PDF
          </Button>
          {allowApprovalActions && period?.status === "WAITING_HR" && (
            <>
              <Button
                onClick={() => setActionType("approve")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                อนุมัติรอบจ่าย
              </Button>
              <Button
                variant="destructive"
                onClick={() => setActionType("reject")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                ปฏิเสธ
              </Button>
            </>
          )}
          {!allowApprovalActions && selectedProfession !== "all" && onSetProfessionReviewed && (
            <>
              <Button
                variant={currentProfessionReviewed ? "outline" : "default"}
                size="sm"
                onClick={() => onSetProfessionReviewed(selectedProfession, !currentProfessionReviewed)}
              >
                {currentProfessionReviewed ? "ยกเลิกยืนยันตรวจแล้ว" : "ยืนยันตรวจแล้ว"}
              </Button>
              {onSubmitForReview && (
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={async () => {
                    if (!canSubmitReview) {
                      const names = remainingProfessions.map((profession) => profession.label).join(", ")
                      toast.error(
                        names
                          ? `ยังตรวจไม่ครบทุกวิชาชีพ: ${names}`
                          : "ยังตรวจไม่ครบทุกวิชาชีพ",
                      )
                      return
                    }
                    try {
                      await onSubmitForReview()
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : "ไม่สามารถส่งให้ HR ได้"
                      toast.error(message)
                    }
                  }}
                  disabled={!canSubmitReview || isSubmittingForReview}
                >
                  <Send className="mr-2 h-4 w-4" />
                  ส่งให้ HR
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {!compactView && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">จำนวนผู้รับเงิน</p>
                    <p className="text-2xl font-bold">{Number(period?.total_headcount ?? 0)} คน</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-emerald-500/10">
                    <Banknote className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ยอดรวมทั้งหมด</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {Number(period?.total_amount ?? 0).toLocaleString()} บาท
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Calendar className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">วันทำการ</p>
                    <p className="text-2xl font-bold">
                      {Number(periodDetail?.calendar?.working_days ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <Clock className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">วันหยุด</p>
                    <p className="text-2xl font-bold">
                      {Number(periodDetail?.calendar?.holiday_days ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </>
      )}

      {showSelector && (
        <Card className="border-border bg-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">เลือกวิชาชีพก่อนดูตาราง</CardTitle>
            <p className="text-sm text-muted-foreground">
              เลือกวิชาชีพที่ต้องการเพื่อกรองรายการผู้รับเงินในรอบนี้
            </p>
          </CardHeader>
          <CardContent>
            {!allowApprovalActions && totalProfessionCount > 0 && (
              <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-sm text-muted-foreground">
                  ตรวจแล้ว {reviewedCount}/{totalProfessionCount} วิชาชีพ
                </p>
                {remainingProfessions.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ค้างตรวจ: {remainingProfessions.map((profession) => profession.label).join(", ")}
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {professionCards.map((profession) => {
                const isActive = selectedProfession === profession.code
                const isReviewed = reviewedCodeSet.has(profession.code.toUpperCase())
                return (
                  <button
                    key={profession.code}
                    type="button"
                    onClick={() => handleSelectProfession(profession.code)}
                    className={`group w-full text-left rounded-xl border bg-background/80 p-4 transition-all hover:border-primary/40 hover:shadow-md ${
                      isActive ? "border-primary/60 ring-2 ring-primary/20" : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">{profession.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">รหัส: {profession.code}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            isActive
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-secondary/60 text-muted-foreground"
                          }`}
                        >
                          {Number(professionTotals.get(profession.code) ?? 0).toLocaleString()} บาท
                        </Badge>
                        {!allowApprovalActions && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              isReviewed
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {isReviewed ? "ตรวจแล้ว" : "รอตรวจ"}
                          </Badge>
                        )}
                      </div>
                  </div>
                    <p className="mt-3 text-sm text-muted-foreground">{profession.description}</p>
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">อัตราเงินที่ได้รับ:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profession.rates.length === 0 ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          profession.rates.map((rate) => (
                            <span
                              key={`${profession.code}-${rate}`}
                              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                            >
                              {rate.toLocaleString()} บาท
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {selectedProfession !== "all" && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-sm">
                <div className="text-muted-foreground">
                  กำลังกรอง:{" "}
                  <span className="font-medium text-foreground">
                    {professionCards.find((p) => p.code === selectedProfession)?.label ?? selectedProfession}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectProfession("all")}
                >
                  ล้างตัวกรอง
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showSummary && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">สรุปตามอัตราเงิน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {(selectedProfession === "all"
                ? Array.from(
                    new Map(
                      filteredPersons
                        .filter((row) => row.baseRate > 0)
                        .map((row) => [row.baseRate, row.baseRate]),
                    ).values(),
                  ).sort((a, b) => a - b)
                : (professionGroups[selectedProfession] ?? []).map(({ rate }) => rate)
              ).map((rate) => {
                const count = filteredPersons.filter((person) => person.baseRate === rate).length
                const amount = filteredPersons
                  .filter((person) => person.baseRate === rate)
                  .reduce((total, person) => total + person.totalAmount, 0)
                const groupLabel =
                  selectedProfession === "all"
                    ? "อัตรา"
                    : `กลุ่มที่ ${
                        professionGroups[selectedProfession]?.find((group) => group.rate === rate)?.group ?? "-"
                      }`
                return (
                  <div key={`${selectedProfession}-${rate}`} className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{groupLabel}</span>
                      <Badge variant="outline">{rate.toLocaleString()} บาท</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold">{count} คน</span>
                      <span className="text-emerald-400 font-semibold">{amount.toLocaleString()} บาท</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showTable && (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">รายชื่อผู้รับเงิน</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ, แผนก..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64 bg-secondary border-border"
                  />
                </div>
                <Select value={rateFilter} onValueChange={setRateFilter}>
                  <SelectTrigger className="w-40 bg-secondary border-border">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="กรองตามกลุ่ม" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">ทุกกลุ่ม</SelectItem>
                    {availableGroups.map((group) => {
                      const groupNumber = Number(group)
                      const rate =
                        selectedProfession !== "all"
                          ? professionGroups[selectedProfession]?.find((item) => item.group === groupNumber)?.rate
                          : undefined
                      return (
                        <SelectItem key={group} value={group}>
                          {rate ? `กลุ่มที่ ${group} (${rate.toLocaleString()} บาท)` : `กลุ่มที่ ${group}`}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead className="text-muted-foreground">ลำดับ</TableHead>
                    <TableHead className="text-muted-foreground">คำนำหน้าชื่อ</TableHead>
                    <TableHead className="text-muted-foreground">ชื่อ-สกุล</TableHead>
                    <TableHead className="text-muted-foreground">ตำแหน่ง</TableHead>
                    <TableHead className="text-muted-foreground text-center">กลุ่มที่</TableHead>
                    <TableHead className="text-muted-foreground text-center">ข้อ</TableHead>
                    <TableHead className="text-muted-foreground text-center">ข้อย่อย</TableHead>
                    <TableHead className="text-muted-foreground text-right">
                      อัตราเงิน (บาท/เดือน)
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right">ตกเบิก (บาท)</TableHead>
                    <TableHead className="text-muted-foreground text-right">รวม (บาท)</TableHead>
                    <TableHead className="text-muted-foreground">หมายเหตุ</TableHead>
                    <TableHead className="text-muted-foreground text-right">ดู</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredPersons.map((person, index) => (
                  <TableRow key={person.id} className="hover:bg-secondary/30">
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="text-sm">{person.title || "-"}</TableCell>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell className="text-sm">{person.position}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-secondary">
                        {person.groupNo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{person.itemNo}</TableCell>
                    <TableCell className="text-center">{person.subItemNo}</TableCell>
                    <TableCell className="text-right">{person.baseRate.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {person.retroactiveAmount > 0
                        ? person.retroactiveAmount.toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-400">
                      {person.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.note || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedRow(person)}
                        title={person.requestId ? "ดูรายละเอียด" : "ไม่พบคำขอที่ผูกกับรายการนี้"}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>แสดง {filteredPersons.length} จาก {enrichedPayouts.length} รายการ</span>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => {
        setActionType(null)
        setComment("")
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "อนุมัติรอบจ่ายเงิน"}
              {actionType === "reject" && "ปฏิเสธรอบจ่ายเงิน"}
            </DialogTitle>
            <DialogDescription>
              รอบจ่ายเงิน {formatPeriodLabel(period?.period_month ?? null, period?.period_year ?? null)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">จำนวนรายการ:</span>
                  <p className="font-medium">{Number(period?.total_headcount ?? 0)} คน</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ยอดรวม:</span>
                  <p className="font-medium">{Number(period?.total_amount ?? 0).toLocaleString()} บาท</p>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                {actionType === "approve" ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลที่ปฏิเสธ"}
              </label>
              <Textarea
                placeholder={
                  actionType === "approve"
                    ? "ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                    : "ระบุเหตุผลที่ปฏิเสธรอบจ่ายนี้"
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-2 bg-secondary border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null)
                setComment("")
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAction}
              className={
                actionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-destructive hover:bg-destructive/90"
              }
            >
              {actionType === "approve" && "อนุมัติ"}
              {actionType === "reject" && "ปฏิเสธ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-card border-border sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>รายละเอียดข้อมูลที่ยื่นเข้ามา</DialogTitle>
            <DialogDescription>
              {selectedRow?.name ?? "-"} ({selectedRow?.citizenId ?? "-"})
            </DialogDescription>
          </DialogHeader>

          {!selectedRow?.requestId ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              ไม่พบคำขอที่ผูกกับรายการรับเงินนี้
            </div>
          ) : requestDetailQuery.isLoading ? (
            <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              กำลังโหลดรายละเอียดคำขอ...
            </div>
          ) : requestDetailQuery.isError || !selectedRequest ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              โหลดรายละเอียดคำขอไม่สำเร็จ
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">ข้อมูลพนักงาน</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">ชื่อ-นามสกุล</p>
                    <p className="font-medium">{selectedRow.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ตำแหน่ง</p>
                    <p className="font-medium">{selectedRow.position}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">แผนก</p>
                    <p className="font-medium">{selectedRow.department || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">เลขคำขอ</p>
                    <p className="font-medium">{selectedRequest.request_no || selectedRequest.request_id}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">ข้อมูลที่ยื่นเข้ามา</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">วิชาชีพ</p>
                    <p className="font-medium">{selectedRateDisplay?.professionLabel || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">กลุ่ม</p>
                    <p className="font-medium">{selectedRateDisplay?.groupLabel || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">เงื่อนไขอ้างอิง</p>
                    <p className="font-medium">{selectedRateDisplay?.criteriaLabel || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">เงื่อนไขย่อย</p>
                    <p className="font-medium">{selectedRateDisplay?.subCriteriaLabel || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">วันที่มีผล</p>
                    <p className="font-medium">
                      {selectedRequest.effective_date ? formatDate(selectedRequest.effective_date) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ยอดที่ยื่น</p>
                    <p className="font-medium">
                      {(Number(selectedRateMapping?.amount ?? selectedRequest.requested_amount ?? 0)).toLocaleString()} บาท
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">รายละเอียดการหักเงิน</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">อัตราเงินพื้นฐาน</p>
                    <p className="font-medium">{selectedRow.baseRate.toLocaleString()} บาท</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ตกเบิก</p>
                    <p className="font-medium">{selectedRow.retroactiveAmount.toLocaleString()} บาท</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">วันมีสิทธิ</p>
                    <p className="font-medium">{selectedRow.workDays.toLocaleString()} วัน</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">วันถูกหัก</p>
                    <p className="font-medium">{selectedRow.leaveDays.toLocaleString()} วัน</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ยอดรับจริง</p>
                    <p className="font-semibold text-emerald-400">{selectedRow.totalAmount.toLocaleString()} บาท</p>
                  </div>
                </div>
                <div className="mt-4 rounded-md bg-secondary/40 p-3">
                  <p className="text-sm font-medium text-foreground">สาเหตุ</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {deductionReasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">ไฟล์แนบจากคำขอ</p>
                {selectedAttachments.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">ไม่มีไฟล์แนบ</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedAttachments.map((attachment) => {
                      const url = buildAttachmentUrl(attachment.file_path || "")
                      return (
                        <a
                          key={attachment.attachment_id}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded border border-border px-3 py-2 text-sm hover:bg-secondary/40"
                        >
                          {attachment.file_name}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
