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
} from "@/components/ui/select"
import {
  ArrowLeft,
  Users,
  Banknote,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Download,
  FileText,
  Pencil,
  Send,
  ChevronDown,
  ChevronUp,
  List,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog"
import {
  useApproveByDirector,
  useApproveByHeadFinance,
  useApproveByHR,
  useDownloadPeriodReport,
  usePeriodDetail,
  usePeriodPayouts,
  usePayoutDetail,
  useRejectPeriod,
  useUpdatePayout,
} from "@/features/payroll/hooks"
import type { PeriodPayoutRow, PeriodDetail, PayoutDetail } from "@/features/payroll/api"
import { useRateHierarchy } from "@/features/master-data/hooks"
import type { ProfessionHierarchy } from "@/features/master-data/api"
import { normalizeProfessionCode, resolveProfessionLabel } from "@/shared/constants/profession"
import { formatThaiNumber } from "@/shared/utils/thai-locale"

import type { PayrollRow, PeriodStatus } from "./payrollDetail.types"
import {
  buildIssues,
  escapeCsvValue,
  formatDate,
  formatDateOrEmpty,
  formatPeriodLabel,
  parseGroupNumber,
  resolveProfessionReviewTone,
  statusConfig,
} from "./payrollDetail.helpers"
import { PayrollChecksPanel } from "./PayrollChecksPanel"
import { PayrollIssueStatusBadge } from "./PayrollIssueStatusBadge"
import { PayrollSummaryCard } from "./PayrollSummaryCard"

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
  approvalRole?: "HR" | "HEAD_FINANCE" | "DIRECTOR"
  reviewedProfessionCodes?: string[]
  onSetProfessionReviewed?: (professionCode: string, reviewed: boolean) => void
  onSubmitForReview?: () => Promise<void>
  isSubmittingForReview?: boolean
  onAvailableProfessionsChange?: (professions: { code: string; label: string }[]) => void
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
  approvalRole = "HR",
  reviewedProfessionCodes = [],
  onSetProfessionReviewed,
  onSubmitForReview,
  isSubmittingForReview = false,
  onAvailableProfessionsChange,
}: PayrollDetailContentProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [rateFilter, setRateFilter] = useState("all")
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(true)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [comment, setComment] = useState("")
  const [selectedCheckRow, setSelectedCheckRow] = useState<PayrollRow | null>(null)
  const [editRow, setEditRow] = useState<PayrollRow | null>(null)
  const [editEligibleDays, setEditEligibleDays] = useState<string>("")
  const [editDeductedDays, setEditDeductedDays] = useState<string>("")
  const [editRetroactiveAmount, setEditRetroactiveAmount] = useState<string>("")
  const [editRemark, setEditRemark] = useState<string>("")

  const periodDetailQuery = usePeriodDetail(periodId)
  const payoutsQuery = usePeriodPayouts(periodId)
  const rateHierarchyQuery = useRateHierarchy()
  const payoutDetailQuery = usePayoutDetail(selectedCheckRow?.id ?? undefined)
  const approveByDirector = useApproveByDirector()
  const approveByHeadFinance = useApproveByHeadFinance()
  const approveByHR = useApproveByHR()
  const rejectPeriod = useRejectPeriod()
  const downloadReport = useDownloadPeriodReport()
  const updatePayoutMutation = useUpdatePayout()

  const periodDetail = periodDetailQuery.data as PeriodDetail | undefined
  const period = periodDetail?.period
  const statusInfo = statusConfig[(period?.status as PeriodStatus) ?? "OPEN"]
  const payoutsData = useMemo(
    () => (payoutsQuery.data ?? []) as PeriodPayoutRow[],
    [payoutsQuery.data],
  )

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
            // Master data may contain English codes as name; prefer Thai label mapping when available.
            label: resolveProfessionLabel(internalCode, profession.name),
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
    const rawRows = payoutsData
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
          rates: groupList.map((item) => item.rate),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, "th"))

    return {
      professionCards: cards,
      professionGroups: groups,
    }
  }, [rateHierarchyQuery.data, payoutsData])

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
    const rows = payoutsData
    const month = Number(period?.period_month ?? 0)
    const rawYear = Number(period?.period_year ?? 0)
    const year = rawYear > 2400 ? rawYear - 543 : rawYear
    const daysInMonth = month > 0 && year > 0 ? new Date(year, month, 0).getDate() : 0

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
      const retroactiveAmount = Number(row.retroactive_amount ?? 0)
      const totalAmount = Number(row.total_payable ?? 0)
      // Day-based deduction (from deducted_days). Do NOT infer deductions from total_payable,
      // because retroactive deductions are represented separately in retroactiveAmount.
      const leaveDays = Number(row.deducted_days ?? 0)
      const deductionAmount =
        daysInMonth > 0 && baseRate > 0 && leaveDays > 0
          ? Number(((baseRate / daysInMonth) * leaveDays).toFixed(2))
          : 0

      const note = row.remark ?? undefined
      const groupNoFromRow =
        row.group_no !== null && row.group_no !== undefined ? String(row.group_no) : "-"
      const groupNoFromRate = professionGroups[professionCode]
        ?.find((group) => group.rate === baseRate)
        ?.group?.toString()
      const groupNo = groupNoFromRow !== "-" ? groupNoFromRow : groupNoFromRate ?? "-"
      const rateGroup = groupNo
      const itemNo = row.item_no !== null && row.item_no !== undefined ? String(row.item_no) : "-"
      const subItemNo = row.sub_item_no !== null && row.sub_item_no !== undefined ? String(row.sub_item_no) : "-"
      const rowWithLicense = row as PeriodPayoutRow & {
        license_valid_until?: string | null
        license_status?: string | null
      }
      const licenseValidUntil = rowWithLicense.license_valid_until ?? null
      const licenseStatus = rowWithLicense.license_status ?? null
      const issues = buildIssues({ retroactiveAmount, deductionAmount, note, licenseValidUntil })
      const checkCount = Number(row.check_count ?? 0)
      const blockerCount = Number(row.blocker_count ?? 0)
      const warningCount = Number(row.warning_count ?? 0)

      return {
        id: row.payout_id,
        citizenId,
        eligibilityId: row.eligibility_id !== null && row.eligibility_id !== undefined ? Number(row.eligibility_id) : null,
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
        leaveDays,
        totalAmount,
        deductionAmount,
        licenseValidUntil,
        licenseStatus,
        issues,
        checkCount,
        blockerCount,
        warningCount,
        note,
      } satisfies PayrollRow
    })
  }, [itemByCitizenId, payoutsData, period?.period_month, period?.period_year, professionGroups])

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
    const query = searchQuery.trim().toLowerCase()

    return enrichedPayouts.filter((person) => {
      const matchesSearch =
        !query ||
        person.name.toLowerCase().includes(query) ||
        person.department.toLowerCase().includes(query)
      const matchesRate = rateFilter === "all" || person.groupNo === rateFilter
      const matchesProfession = selectedProfession === "all" || person.professionCode === selectedProfession
      return matchesSearch && matchesRate && matchesProfession
    })
  }, [enrichedPayouts, rateFilter, searchQuery, selectedProfession])

  const displayStats = useMemo(() => {
    if (selectedProfession === "all") {
      return {
        count: Number(period?.total_headcount ?? 0),
        amount: Number(period?.total_amount ?? 0),
      }
    }
    const personsInProfession = enrichedPayouts.filter(
      (person) => person.professionCode === selectedProfession,
    )
    return {
      count: personsInProfession.length,
      amount: personsInProfession.reduce((sum, person) => sum + person.totalAmount, 0),
    }
  }, [enrichedPayouts, period?.total_amount, period?.total_headcount, selectedProfession])

  const activeProfessionLabel = useMemo(() => {
    if (selectedProfession === "all") return ""
    return professionCards.find((profession) => profession.code === selectedProfession)?.label ?? selectedProfession
  }, [professionCards, selectedProfession])

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

  const handleOpenAllowanceDetail = (person: PayrollRow) => {
    const eligibilityId = Number(person.eligibilityId ?? 0)
    if (!Number.isFinite(eligibilityId) || eligibilityId <= 0) {
      toast.error("ไม่พบ Eligibility ID สำหรับรายการนี้")
      return
    }
    const professionCode = person.professionCode || "ALL"
    router.push(
      `/pts-officer/allowance-list/${eligibilityId}?profession=${encodeURIComponent(professionCode)}&page=1`,
    )
  }

  const canEditPayout = period?.status === "OPEN" && !Boolean(period?.is_frozen)
  const approvalStatus =
    approvalRole === "DIRECTOR"
      ? "WAITING_DIRECTOR"
      : approvalRole === "HEAD_FINANCE"
        ? "WAITING_HEAD_FINANCE"
        : "WAITING_HR"
  const approvalLabel =
    approvalRole === "DIRECTOR"
      ? "ผู้อำนวยการ"
      : approvalRole === "HEAD_FINANCE"
        ? "หัวหน้าการเงิน"
        : "หัวหน้า HR"

  useEffect(() => {
    if (!editRow) return
    setEditEligibleDays(String(editRow.workDays ?? 0))
    setEditDeductedDays(String(editRow.leaveDays ?? 0))
    setEditRetroactiveAmount(String(editRow.retroactiveAmount ?? 0))
    setEditRemark(editRow.note ?? "")
  }, [editRow])

  const handleSavePayoutEdit = async () => {
    if (!editRow) return
    if (!canEditPayout) {
      toast.error("สามารถแก้ไขได้เฉพาะรอบที่ยังเปิดอยู่")
      return
    }

    const eligibleDays = Number(editEligibleDays)
    const deductedDays = Number(editDeductedDays)
    const retroactiveAmount = Number(editRetroactiveAmount)

    if (!Number.isFinite(eligibleDays) || eligibleDays < 0) {
      toast.error("กรุณากรอกวันมีสิทธิให้ถูกต้อง (>= 0)")
      return
    }
    if (!Number.isFinite(deductedDays) || deductedDays < 0) {
      toast.error("กรุณากรอกวันถูกหักให้ถูกต้อง (>= 0)")
      return
    }
    if (!Number.isFinite(retroactiveAmount)) {
      toast.error("กรุณากรอกยอดตกเบิกให้ถูกต้อง")
      return
    }

    try {
      await updatePayoutMutation.mutateAsync({
        payoutId: editRow.id,
        payload: {
          eligible_days: eligibleDays,
          deducted_days: deductedDays,
          retroactive_amount: retroactiveAmount,
          remark: editRemark?.trim() ? editRemark.trim() : null,
        },
      })
      toast.success("บันทึกการแก้ไขเรียบร้อย")
      setEditRow(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"
      toast.error(message)
    }
  }

  const handleAction = async () => {
    if (!actionType) return
    const trimmed = comment.trim()
    if (actionType === "reject" && !trimmed) {
      toast.error("กรุณาระบุเหตุผลก่อนปฏิเสธ")
      return
    }
    try {
      if (actionType === "approve") {
        if (approvalRole === "DIRECTOR") {
          await approveByDirector.mutateAsync(periodId)
        } else if (approvalRole === "HEAD_FINANCE") {
          await approveByHeadFinance.mutateAsync(periodId)
        } else {
          await approveByHR.mutateAsync(periodId)
        }
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

  const handleExportCsv = () => {
    const rows = filteredPersons
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก")
      return
    }
    const headers = [
      "เลขบัตรประชาชน",
      "คำนำหน้า",
      "ชื่อ-สกุล",
      "ตำแหน่ง",
      "หน่วยงาน",
      "วิชาชีพ",
      "วันหมดอายุใบอนุญาต",
      "กลุ่ม",
      "ข้อ",
      "ข้อย่อย",
      "อัตราเงิน",
      "ตกเบิก",
      "ยอดหัก",
      "รวมจ่าย",
      "ประเด็นที่ต้องตรวจ",
      "หมายเหตุ",
    ]
    const csvRows = rows.map((row) => [
      row.citizenId,
      row.title,
      row.name,
      row.position,
      row.department,
      resolveProfessionLabel(row.professionCode, row.professionCode),
      row.licenseValidUntil ? formatDateOrEmpty(row.licenseValidUntil) : "",
      row.groupNo,
      row.itemNo,
      row.subItemNo,
      row.baseRate,
      row.retroactiveAmount,
      row.deductionAmount,
      row.totalAmount,
      row.issues.map((issue) => issue.label).join("; "),
      row.note ?? "",
    ])
    const csv = [headers, ...csvRows]
      .map((line) => line.map((item) => escapeCsvValue(item)).join(","))
      .join("\n")
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `payroll_${periodId}_${selectedProfession === "all" ? "all" : selectedProfession}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Link href={backHref}>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-foreground md:text-2xl">
                    รอบจ่าย {formatPeriodLabel(period?.period_month ?? null, period?.period_year ?? null)}
                    {activeProfessionLabel ? (
                      <span className="font-normal text-muted-foreground"> / {activeProfessionLabel}</span>
                    ) : null}
                  </h1>
                  <Badge variant="outline" className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  สร้างโดย {period?.created_by_name ?? "-"} • {formatDate(period?.created_at ?? null)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {allowApprovalActions && period?.status === approvalStatus ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setActionType("approve")}
                    className="bg-emerald-600 shadow-sm hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    อนุมัติ{approvalLabel}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setActionType("reject")}
                    className="shadow-sm"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    ปฏิเสธ
                  </Button>
                </div>
              ) : (
                !allowApprovalActions &&
                selectedProfession !== "all" &&
                onSetProfessionReviewed && (
                  <div className="flex gap-2">
                    {period?.status !== "OPEN" ? (
                      <Button
                        variant="outline"
                        className="border-muted text-muted-foreground"
                        disabled
                        title="ส่งให้ HR แล้ว จึงไม่สามารถยืนยัน/แก้ไขสถานะการตรวจได้"
                      >
                        ยืนยันการตรวจ
                      </Button>
                    ) : (
                      <ConfirmActionDialog
                        trigger={
                          <Button
                            variant={currentProfessionReviewed ? "outline" : "default"}
                            className={
                              currentProfessionReviewed
                                ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                                : "bg-emerald-600 hover:bg-emerald-700"
                            }
                          >
                            {currentProfessionReviewed ? (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> ตรวจแล้ว
                              </>
                            ) : (
                              "ยืนยันการตรวจ"
                            )}
                          </Button>
                        }
                        title={currentProfessionReviewed ? "ยกเลิกสถานะตรวจแล้ว?" : "ยืนยันการตรวจวิชาชีพ?"}
                        description={
                          activeProfessionLabel ? (
                            <span>
                              วิชาชีพ: <b>{activeProfessionLabel}</b>
                            </span>
                          ) : (
                            "ยืนยันสถานะการตรวจของวิชาชีพนี้"
                          )
                        }
                        cancelText={currentProfessionReviewed ? "ไม่ยกเลิก" : "ยกเลิก"}
                        confirmText={currentProfessionReviewed ? "ยืนยันยกเลิก" : "ยืนยัน"}
                        variant={currentProfessionReviewed ? "destructive" : "default"}
                        onConfirm={() =>
                          onSetProfessionReviewed(
                            selectedProfession,
                            !currentProfessionReviewed,
                          )
                        }
                      />
                    )}
                    {onSubmitForReview && (
                      <ConfirmActionDialog
                        trigger={
                          <Button
                            variant="secondary"
                            className="gap-2"
                            disabled={!canSubmitReview || isSubmittingForReview}
                          >
                            <Send className="h-4 w-4" />
                            ส่ง HR
                          </Button>
                        }
                        title="ยืนยันส่งให้ HR ตรวจสอบ"
                        description={
                          <span>
                            ระบบจะส่งผลการตรวจของรอบนี้ให้ HR (ต้องตรวจครบทุกวิชาชีพก่อน)
                          </span>
                        }
                        confirmText="ส่งให้ HR"
                        onConfirm={async () => {
                          if (!canSubmitReview) {
                            const names = remainingProfessions
                              .map((profession) => profession.label)
                              .join(", ")
                            toast.error(
                              names
                                ? `ยังตรวจไม่ครบทุกวิชาชีพ: ${names}`
                                : "ยังตรวจไม่ครบทุกวิชาชีพ",
                            )
                            return
                          }
                          await onSubmitForReview()
                        }}
                        disabled={!canSubmitReview || isSubmittingForReview}
                      />
                    )}
                  </div>
                )
              )}

              <div className="mx-1 hidden h-6 w-px bg-border md:block" />

              <div className="flex gap-1">
                <ConfirmActionDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="ส่งออก CSV"
                      disabled={filteredPersons.length === 0}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  }
                  title="ยืนยันส่งออก CSV"
                  description={
                    <span>
                      จะส่งออกรายการ <b>{formatThaiNumber(filteredPersons.length)}</b> รายการ
                    </span>
                  }
                  confirmText="ส่งออก"
                  onConfirm={handleExportCsv}
                  disabled={filteredPersons.length === 0}
                />
                <ConfirmActionDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="ส่งออก PDF"
                      disabled={downloadReport.isPending}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  }
                  title="ยืนยันดาวน์โหลดรายงาน PDF"
                  description="ระบบจะดาวน์โหลดรายงานรอบจ่ายเงินเป็นไฟล์ PDF"
                  confirmText="ดาวน์โหลด"
                  onConfirm={async () => {
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
                  disabled={downloadReport.isPending}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {!compactView && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 px-6 md:px-8 lg:grid-cols-4">
            <PayrollSummaryCard
              icon={Users}
              title="จำนวนรายชื่อ"
              value={`${formatThaiNumber(displayStats.count)} คน`}
              iconClassName="text-primary"
              iconBgClassName="bg-primary/10"
            />
            <PayrollSummaryCard
              icon={Banknote}
              title="ยอดสุทธิ"
              value={`${formatThaiNumber(displayStats.amount)} ฿`}
              iconClassName="text-emerald-600"
              iconBgClassName="bg-emerald-500/10"
            />
            <PayrollSummaryCard
              icon={Calendar}
              title="วันทำการ"
              value={`${formatThaiNumber(Number(periodDetail?.calendar?.working_days ?? 0))} วัน`}
              iconClassName="text-blue-600"
              iconBgClassName="bg-blue-500/10"
            />
            <PayrollSummaryCard
              icon={Clock}
              title="วันหยุด"
              value={`${formatThaiNumber(Number(periodDetail?.calendar?.holiday_days ?? 0))} วัน`}
              iconClassName="text-amber-600"
              iconBgClassName="bg-amber-500/10"
            />
          </div>

        </>
      )}

      {showSelector && (
        <div className="space-y-2 px-6 md:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">สถานะการตรวจสอบรายวิชาชีพ</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSelectorExpanded((prev) => !prev)}
              title={isSelectorExpanded ? "ย่อ" : "ขยาย"}
            >
              {isSelectorExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {isSelectorExpanded && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {professionCards.map((profession) => {
                const isActive = selectedProfession === profession.code
                const isReviewed = reviewedCodeSet.has(profession.code.toUpperCase())
                const totalAmount = Number(professionTotals.get(profession.code) ?? 0)
                const reviewTone = resolveProfessionReviewTone({
                  isReviewed,
                  totalAmount,
                })
                return (
                  <button
                    key={profession.code}
                    type="button"
                    onClick={() => handleSelectProfession(profession.code)}
                    className={[
                      "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:shadow-md",
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card hover:border-primary/50",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="truncate pr-2 text-sm font-semibold">{profession.label}</span>
                      {reviewTone.useCheckIcon ? (
                        <CheckCircle2 className={cn("h-4 w-4 shrink-0", reviewTone.indicatorClassName)} />
                      ) : (
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            reviewTone.indicatorClassName,
                          )}
                        />
                      )}
                    </div>
                    <div className="mt-auto w-full">
                      <p className="text-xl font-bold tracking-tight text-foreground">
                        {formatThaiNumber(totalAmount)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">บาท</span>
                      </p>
                    </div>
                    <div
                      className={[
                        "absolute bottom-0 left-0 h-1 w-full rounded-b-xl",
                        reviewTone.barClassName,
                      ].join(" ")}
                    />
                  </button>
                )
              })}
            </div>
          )}

          {selectedProfession !== "all" && !isSelectorExpanded && (
            <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <Filter className="h-3 w-3" />
              กำลังแสดงข้อมูล:{" "}
              <span className="font-medium text-foreground">
                {professionCards.find((p) => p.code === selectedProfession)?.label ?? selectedProfession}
              </span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="ml-auto h-auto p-0"
                onClick={() => handleSelectProfession("all")}
              >
                แสดงทั้งหมด
              </Button>
            </div>
          )}
        </div>
      )}

      {showSummary && (
        <Card className="mx-6 border-border bg-card md:mx-8">
          <CardHeader>
            <CardTitle className="text-lg">
              สรุปตามอัตราเงิน{activeProfessionLabel ? ` (${activeProfessionLabel})` : ""}
            </CardTitle>
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
                if (count === 0) return null
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
                      <Badge variant="outline">{formatThaiNumber(rate)} บาท</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold">{count} คน</span>
                      <span className="text-emerald-400 font-semibold">
                        {formatThaiNumber(amount)} บาท
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showTable && (
        <Card className="mx-6 border-border shadow-sm md:mx-8">
          <CardHeader className="border-b bg-muted/5 px-6 py-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <CardTitle className="flex items-center gap-2 text-lg">
                <List className="h-5 w-5 text-muted-foreground" />
                รายชื่อผู้รับเงิน{activeProfessionLabel ? ` - ${activeProfessionLabel}` : ""}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (ทั้งหมด {filteredPersons.length} รายการ)
                </span>
              </CardTitle>
              <div className="flex w-full flex-col items-center gap-2 sm:flex-row md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ, แผนก..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 bg-background pl-9"
                  />
                </div>
                <Select value={rateFilter} onValueChange={setRateFilter}>
                  <SelectTrigger className="h-9 w-full bg-background sm:w-[160px]">
                    <div className="flex items-center gap-2 truncate">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate text-sm">
                        {rateFilter === "all" ? "ทุกกลุ่มอัตรา" : `กลุ่ม ${rateFilter}`}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกกลุ่มอัตรา</SelectItem>
                    {availableGroups.map((group) => (
                      <SelectItem key={group} value={group}>
                        กลุ่มที่ {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[50px] text-center font-semibold">#</TableHead>
                  <TableHead className="min-w-[240px] font-semibold">ชื่อ - นามสกุล / เลขบัตร</TableHead>
                  <TableHead className="min-w-[180px] font-semibold">ตำแหน่ง / หน่วยงาน</TableHead>
                  <TableHead className="w-[100px] text-center font-semibold">กลุ่ม/ข้อ</TableHead>
                  <TableHead className="w-[110px] text-right font-semibold">อัตรา</TableHead>
                  <TableHead className="w-[120px] text-right font-semibold">ตกเบิก</TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-orange-700">หัก</TableHead>
                  <TableHead className="w-[130px] text-right font-bold text-foreground">สุทธิ</TableHead>
                  <TableHead className="w-[120px] text-center font-semibold">สถานะ</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      ไม่พบข้อมูลที่ค้นหา
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPersons.map((person, index) => {
                    const hasChecks = person.checkCount > 0 || person.issues.length > 0
                    const warnCount =
                      person.warningCount > 0 ? person.warningCount : person.issues.length
                    return (
                      <TableRow
                        key={person.id}
                        className="group transition-colors hover:bg-muted/30"
                      >
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div
                            className="flex cursor-pointer flex-col transition-transform group-hover:translate-x-1"
                            onClick={() => void handleOpenAllowanceDetail(person)}
                          >
                            <span className="text-sm font-medium text-foreground transition-colors hover:text-primary">
                              {person.name}
                            </span>
                            <span className="text-[11px] font-mono tracking-wide text-muted-foreground">
                              {person.citizenId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[200px] flex-col">
                            <span className="truncate text-xs font-medium text-foreground" title={person.position}>
                              {person.position}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground" title={person.department}>
                              {person.department}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="h-5 bg-background px-1.5 text-[10px] font-normal"
                          >
                            {person.groupNo} / {person.itemNo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {formatThaiNumber(person.baseRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          <span
                            className={cn(
                              "font-medium",
                              person.retroactiveAmount > 0
                                ? "text-blue-600"
                                : person.retroactiveAmount < 0
                                  ? "text-orange-600"
                                  : "text-muted-foreground",
                            )}
                          >
                            {person.retroactiveAmount > 0 ? "+" : ""}
                            {formatThaiNumber(person.retroactiveAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {person.deductionAmount > 0 ? (
                            <span className="font-medium text-orange-700">
                              -{formatThaiNumber(person.deductionAmount)}
                            </span>
                          ) : (
                            <span className="font-medium tabular-nums text-muted-foreground">
                              0
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-sm font-bold",
                              person.totalAmount > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatThaiNumber(person.totalAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            className={cn(
                              "transition-opacity",
                              hasChecks
                                ? "cursor-pointer hover:opacity-80"
                                : "cursor-default opacity-50 grayscale",
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!hasChecks) return
                              setSelectedCheckRow(person)
                            }}
                            title={hasChecks ? "เปิดดูสิ่งที่ต้องตรวจสอบ" : undefined}
                          >
                            <PayrollIssueStatusBadge
                              checkCount={person.checkCount}
                              blockerCount={person.blockerCount}
                              warningCount={warnCount}
                            />
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          {canEditPayout ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditRow(person)
                              }}
                              title="แก้ไขรายการจ่าย (งวดนี้)"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground">
            <span>แสดง {filteredPersons.length} รายการ</span>
          </div>
        </Card>
      )}

      <Dialog
        open={!!editRow}
        onOpenChange={(open) => {
          if (!open) setEditRow(null)
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการจ่าย (งวดนี้)</DialogTitle>
            <DialogDescription>
              แก้ไขเฉพาะข้อมูลของงวดนี้เท่านั้น (การคำนวณใหม่อาจทับค่าที่แก้)
            </DialogDescription>
          </DialogHeader>

          {editRow ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{editRow.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{editRow.citizenId}</div>
                  </div>
                  <Badge variant="outline">
                    {resolveProfessionLabel(editRow.professionCode, editRow.professionCode)}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">วันมีสิทธิ (วัน)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={editEligibleDays}
                    onChange={(e) => setEditEligibleDays(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">วันถูกหัก (วัน)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={editDeductedDays}
                    onChange={(e) => setEditDeductedDays(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">ตกเบิก (บาท)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={editRetroactiveAmount}
                    onChange={(e) => setEditRetroactiveAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">อัตราเงินที่ได้รับ</label>
                  <Input value={formatThaiNumber(Number(editRow.baseRate ?? 0))} disabled />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/10 p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">เงินงวดปัจจุบัน (ประมาณ)</span>
                    <span className="font-medium tabular-nums">
                      {(() => {
                        const month = Number(period?.period_month ?? 0)
                        const rawYear = Number(period?.period_year ?? 0)
                        const year = rawYear > 2400 ? rawYear - 543 : rawYear
                        const daysInMonth = month > 0 ? new Date(year, month, 0).getDate() : 0
                        const eligibleDays = Number(editEligibleDays)
                        if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) return "-"
                        if (!Number.isFinite(eligibleDays) || eligibleDays < 0) return "-"
                        const calc = (Number(editRow.baseRate ?? 0) / daysInMonth) * eligibleDays
                        return formatThaiNumber(calc, { maximumFractionDigits: 2 })
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">ยอดหัก (ตามวันถูกหัก)</span>
                    <span className="font-medium tabular-nums text-orange-700">
                      {(() => {
                        const month = Number(period?.period_month ?? 0)
                        const rawYear = Number(period?.period_year ?? 0)
                        const year = rawYear > 2400 ? rawYear - 543 : rawYear
                        const daysInMonth = month > 0 ? new Date(year, month, 0).getDate() : 0
                        const deductedDays = Number(editDeductedDays)
                        if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) return "-0"
                        if (!Number.isFinite(deductedDays) || deductedDays < 0) return "-"
                        const amt = (Number(editRow.baseRate ?? 0) / daysInMonth) * deductedDays
                        return `-${formatThaiNumber(amt, { maximumFractionDigits: 2 })}`
                      })()}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  หมายเหตุ: ระบบใช้วันมีสิทธิเป็นจำนวนวันที่จ่ายจริง (หลังหักแล้ว) ส่วน “ยอดหัก” เป็นตัวช่วยให้เห็นผลกระทบจากวันถูกหัก
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">หมายเหตุ</label>
                <Textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  placeholder="หมายเหตุ (ถ้ามี)"
                  className="resize-none"
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/10 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ยอดสุทธิใหม่ (ประมาณ)</span>
                  <span className="font-semibold text-emerald-600 tabular-nums">
                    {(() => {
                      const month = Number(period?.period_month ?? 0)
                      const rawYear = Number(period?.period_year ?? 0)
                      const year = rawYear > 2400 ? rawYear - 543 : rawYear
                      const daysInMonth = month > 0 ? new Date(year, month, 0).getDate() : 0
                      const eligibleDays = Number(editEligibleDays)
                      const retro = Number(editRetroactiveAmount)
                      if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) return "-"
                      if (!Number.isFinite(eligibleDays) || !Number.isFinite(retro)) return "-"
                      const calc = (Number(editRow.baseRate ?? 0) / daysInMonth) * eligibleDays
                      const total = calc + retro
                      return formatThaiNumber(total, { maximumFractionDigits: 2 })
                    })()}{" "}
                    บาท
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={updatePayoutMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => void handleSavePayoutEdit()}
              disabled={!editRow || updatePayoutMutation.isPending || !canEditPayout}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => {
        setActionType(null)
        setComment("")
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && `อนุมัติรอบจ่ายเงิน (${approvalLabel})`}
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
                  <p className="font-medium">
                    {formatThaiNumber(Number(period?.total_amount ?? 0))} บาท
                  </p>
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
              disabled={approveByHR.isPending || approveByDirector.isPending || rejectPeriod.isPending}
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
        open={!!selectedCheckRow}
        onOpenChange={(open) => {
          if (!open) setSelectedCheckRow(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-card border-border sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--warning))]" />
              สิ่งที่ต้องตรวจสอบ
            </DialogTitle>
            <DialogDescription>
              {selectedCheckRow?.name ?? "-"} ({selectedCheckRow?.citizenId ?? "-"})
            </DialogDescription>
          </DialogHeader>

          {payoutDetailQuery.isLoading ? (
            <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              กำลังโหลดรายละเอียดการตรวจสอบ...
            </div>
          ) : payoutDetailQuery.isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              โหลดรายละเอียดการตรวจสอบไม่สำเร็จ
            </div>
          ) : (
            <PayrollChecksPanel
              fallbackRow={selectedCheckRow}
              payoutDetail={payoutDetailQuery.data as PayoutDetail | undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
