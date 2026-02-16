"use client"

import { use } from "react"
import { PayrollDetailContent } from "@/features/payroll/components/PayrollDetailContent"

type PageParams = Promise<{ id: string; code: string }>

export default function HeadFinancePayrollProfessionPage({ params }: { params: PageParams }) {
  const { id, code } = use(params)

  return (
    <PayrollDetailContent
      periodId={id}
      selectedProfession={code}
      basePath={`/head-finance/payroll/${id}`}
      approvalRole="HEAD_FINANCE"
      compactView
      backHref={`/head-finance/payroll/${id}`}
      showSelector={false}
      showSummary
    />
  )
}
