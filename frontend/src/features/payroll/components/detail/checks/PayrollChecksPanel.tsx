"use client"

import type { PayoutDetail } from "@/features/payroll/api"
import type { PayrollRow } from "../model/detail.types"
import { ChecksCalculationSection, ChecksItemsSection, ChecksIssuesSection } from "."

export function PayrollChecksPanel({
  payoutDetail,
  fallbackRow,
}: {
  payoutDetail: PayoutDetail | undefined
  fallbackRow: PayrollRow | null
}) {
  const payout = payoutDetail?.payout
  const checks = payoutDetail?.checks ?? []
  const items = payoutDetail?.items ?? []

  const month = Number(payout?.period_month ?? 0)
  const rawYear = Number(payout?.period_year ?? 0)
  const yearAd = rawYear > 2400 ? rawYear - 543 : rawYear
  const daysInMonth = month > 0 && yearAd > 0 ? new Date(yearAd, month, 0).getDate() : 0

  const baseRate = Number(payout?.pts_rate_snapshot ?? fallbackRow?.baseRate ?? 0)
  const eligibleDays = Number(payout?.eligible_days ?? fallbackRow?.workDays ?? 0)
  const deductedDays = Number(payout?.deducted_days ?? fallbackRow?.leaveDays ?? 0)
  const calculatedAmount = Number(payout?.calculated_amount ?? 0)

  const retro = Number(payout?.retroactive_amount ?? fallbackRow?.retroactiveAmount ?? 0)
  const dailyRate = daysInMonth > 0 ? baseRate / daysInMonth : 0
  const deductedAmount = dailyRate > 0 ? dailyRate * deductedDays : 0
  const otherLossRaw = baseRate - calculatedAmount - deductedAmount
  const otherLoss = Number.isFinite(otherLossRaw) && otherLossRaw > 0 ? otherLossRaw : 0
  const totalPayable = Number(payout?.total_payable ?? 0)

  return (
    <div className="space-y-6 p-1">
      <ChecksIssuesSection checks={checks} fallbackIssues={fallbackRow?.issues ?? []} />
      

      <ChecksCalculationSection
        baseRate={baseRate}
        eligibleDays={eligibleDays}
        deductedDays={deductedDays}
        calculatedAmount={calculatedAmount}
        deductedAmount={deductedAmount}
        otherLoss={otherLoss}
        retro={retro}
        totalPayable={totalPayable}
      />

      <ChecksItemsSection items={items} />

      {(payout?.remark || fallbackRow?.note) ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <span className="mr-2 font-semibold">หมายเหตุระบบ:</span>
          {payout?.remark ?? fallbackRow?.note}
        </div>
      ) : null}

    </div>
  )
}
