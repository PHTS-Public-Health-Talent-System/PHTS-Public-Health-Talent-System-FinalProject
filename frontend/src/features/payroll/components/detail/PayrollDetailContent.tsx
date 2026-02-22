"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Banknote, Calendar, Clock, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
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
import type { PayoutDetail, PeriodDetail, PeriodPayoutRow } from "@/features/payroll/api"
import { useRateHierarchy } from "@/features/master-data/hooks"
import type { ProfessionHierarchy } from "@/features/master-data/api"
import { formatThaiNumber } from "@/shared/utils/thai-locale"
import type { PayrollRow, PeriodStatus } from "./model/detail.types"
import { statusConfig } from "./model/detail.helpers"
import { PayrollSummaryCard } from "../common/PayrollSummaryCard"
import { usePayrollDetailActions, usePayrollDetailViewModel } from "./hooks"
import {
  PayrollActionDialog,
  PayrollChecksDialog,
  PayrollEditDialog,
  PayrollDetailHeader,
  PayrollPayoutTableSection,
  PayrollProfessionSelector,
} from "./sections"

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

  const vm = usePayrollDetailViewModel({
    selectedProfession,
    periodDetail,
    payoutsData,
    rateHierarchyData: (rateHierarchyQuery.data ?? []) as ProfessionHierarchy[],
    reviewedProfessionCodes,
    onAvailableProfessionsChange,
    onSubmitForReview,
  })

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
  const canRejectPeriod = approvalRole === "DIRECTOR" || approvalRole === "HR"

  const actions = usePayrollDetailActions({
    router,
    basePath,
    periodId,
    selectedProfession,
    approvalRole,
    canRejectPeriod,
    approveByDirector,
    approveByHeadFinance,
    approveByHR,
    rejectPeriod,
    updatePayoutMutation,
    canEditPayout,
    setSearchQuery: vm.setSearchQuery,
    setRateFilter: vm.setRateFilter,
  })

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
      <PayrollDetailHeader
        backHref={backHref}
        period={period}
        activeProfessionLabel={vm.activeProfessionLabel}
        statusLabel={statusInfo.label}
        statusClassName={statusInfo.color}
        allowApprovalActions={allowApprovalActions}
        approvalStatus={approvalStatus}
        approvalLabel={approvalLabel}
        canRejectPeriod={canRejectPeriod}
        periodStatus={period?.status}
        currentProfessionReviewed={vm.currentProfessionReviewed}
        canSubmitReview={vm.canSubmitReview}
        isSubmittingForReview={isSubmittingForReview}
        filteredCount={vm.filteredPersons.length}
        onApproveClick={() => setActionType("approve")}
        onRejectClick={() => setActionType("reject")}
        onToggleReviewed={
          onSetProfessionReviewed && selectedProfession !== "all"
            ? () => onSetProfessionReviewed(selectedProfession, !vm.currentProfessionReviewed)
            : undefined
        }
        onSubmitForReview={
          onSubmitForReview
            ? async () => {
                if (!vm.canSubmitReview) {
                  const names = vm.remainingProfessions.map((profession) => profession.label).join(", ")
                  toast.error(names ? `ยังตรวจไม่ครบทุกวิชาชีพ: ${names}` : "ยังตรวจไม่ครบทุกวิชาชีพ")
                  return
                }
                await onSubmitForReview()
              }
            : undefined
        }
        onExportCsv={() => actions.handleExportCsv(vm.filteredPersons)}
        onExportPdf={async () => {
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
        isPdfPending={downloadReport.isPending}
      />

      {!compactView && (
        <div className="grid grid-cols-2 gap-4 px-6 md:px-8 lg:grid-cols-4">
          <PayrollSummaryCard
            icon={Users}
            title="จำนวนรายชื่อ"
            value={`${formatThaiNumber(vm.displayStats.count)} คน`}
            iconClassName="text-primary"
            iconBgClassName="bg-primary/10"
          />
          <PayrollSummaryCard
            icon={Banknote}
            title="ยอดสุทธิ"
            value={`${formatThaiNumber(vm.displayStats.amount)} ฿`}
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
      )}

      {showSelector && (
        <PayrollProfessionSelector
          selectedProfession={selectedProfession}
          isSelectorExpanded={vm.isSelectorExpanded}
          setIsSelectorExpanded={vm.setIsSelectorExpanded}
          professionCards={vm.professionCards}
          professionTotals={vm.professionTotals}
          reviewedCodeSet={vm.reviewedCodeSet}
          onSelectProfession={actions.handleSelectProfession}
        />
      )}

      {showSummary && (
        <Card className="mx-6 border-border bg-card md:mx-8">
          <CardHeader>
            <CardTitle className="text-lg">
              สรุปตามอัตราเงิน{vm.activeProfessionLabel ? ` (${vm.activeProfessionLabel})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {(selectedProfession === "all"
                ? Array.from(
                    new Map(
                      vm.filteredPersons
                        .filter((row) => row.baseRate > 0)
                        .map((row) => [row.baseRate, row.baseRate]),
                    ).values(),
                  ).sort((a, b) => a - b)
                : (vm.professionGroups[selectedProfession] ?? []).map(({ rate }) => rate)
              ).map((rate) => {
                const count = vm.filteredPersons.filter((person) => person.baseRate === rate).length
                const amount = vm.filteredPersons
                  .filter((person) => person.baseRate === rate)
                  .reduce((total, person) => total + person.totalAmount, 0)
                if (count === 0) return null
                const groupLabel =
                  selectedProfession === "all"
                    ? "อัตรา"
                    : `กลุ่มที่ ${
                        vm.professionGroups[selectedProfession]?.find((group) => group.rate === rate)?.group ?? "-"
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
        <PayrollPayoutTableSection
          activeProfessionLabel={vm.activeProfessionLabel}
          filteredPersonsCount={vm.filteredPersons.length}
          sortedPersons={vm.sortedPersons}
          searchQuery={vm.searchQuery}
          onSearchChange={vm.setSearchQuery}
          rateFilter={vm.rateFilter}
          onRateFilterChange={vm.setRateFilter}
          availableGroups={vm.availableGroups}
          departmentFilter={vm.departmentFilter}
          onDepartmentFilterChange={vm.setDepartmentFilter}
          availableDepartments={vm.availableDepartments}
          issueFilter={vm.issueFilter}
          onIssueFilterChange={vm.setIssueFilter}
          sortBy={vm.sortBy}
          onSortByChange={vm.setSortBy}
          canEditPayout={canEditPayout}
          onOpenAllowanceDetail={actions.handleOpenAllowanceDetail}
          onOpenChecks={setSelectedCheckRow}
          onEditRow={(person) => {
            setEditRow(person)
            setEditEligibleDays(String(person.workDays ?? 0))
            setEditDeductedDays(String(person.leaveDays ?? 0))
            setEditRetroactiveAmount(String(person.retroactiveAmount ?? 0))
            setEditRemark(person.note ?? "")
          }}
        />
      )}

      <PayrollEditDialog
        open={!!editRow}
        onOpenChange={(open) => {
          if (!open) setEditRow(null)
        }}
        editRow={editRow}
        editEligibleDays={editEligibleDays}
        setEditEligibleDays={setEditEligibleDays}
        editDeductedDays={editDeductedDays}
        setEditDeductedDays={setEditDeductedDays}
        editRetroactiveAmount={editRetroactiveAmount}
        setEditRetroactiveAmount={setEditRetroactiveAmount}
        editRemark={editRemark}
        setEditRemark={setEditRemark}
        periodMonth={period?.period_month}
        periodYear={period?.period_year}
        onSave={async () => {
          const ok = await actions.handleSavePayoutEdit({
            editRow,
            editEligibleDays,
            editDeductedDays,
            editRetroactiveAmount,
            editRemark,
          })
          if (ok) setEditRow(null)
        }}
        saving={updatePayoutMutation.isPending}
        canEditPayout={canEditPayout}
      />

      <PayrollActionDialog
        open={!!actionType}
        onClose={() => {
          setActionType(null)
          setComment("")
        }}
        actionType={actionType}
        setComment={setComment}
        comment={comment}
        approvalLabel={approvalLabel}
        periodMonth={period?.period_month}
        periodYear={period?.period_year}
        totalHeadcount={period?.total_headcount}
        totalAmount={period?.total_amount}
        onConfirm={async () => {
          if (!actionType) return
          const ok = await actions.handleAction(actionType, comment)
          if (ok) {
            periodDetailQuery.refetch()
            setActionType(null)
            setComment("")
          }
        }}
        isPending={approveByHR.isPending || approveByDirector.isPending || rejectPeriod.isPending}
      />

      <PayrollChecksDialog
        open={!!selectedCheckRow}
        onOpenChange={(open) => {
          if (!open) setSelectedCheckRow(null)
        }}
        selectedCheckRow={selectedCheckRow}
        payoutDetailLoading={payoutDetailQuery.isLoading}
        payoutDetailError={payoutDetailQuery.isError}
        payoutDetail={payoutDetailQuery.data as PayoutDetail | undefined}
      />
    </div>
  )
}
