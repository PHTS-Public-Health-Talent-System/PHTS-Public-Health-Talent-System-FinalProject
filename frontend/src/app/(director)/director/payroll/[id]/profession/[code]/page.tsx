"use client"

import { use } from "react"
import { PayrollDetailContent } from "@/features/payroll/components/PayrollDetailContent"

type PageParams = Promise<{ id: string; code: string }>

export default function DirectorPayrollProfessionPage({ params }: { params: PageParams }) {
  const { id, code } = use(params)

  return (
    <PayrollDetailContent
      periodId={id}
      selectedProfession={code}
      basePath={`/director/payroll/${id}`}
      compactView
      backHref={`/director/payroll/${id}`}
      showSelector={false}
      showSummary
      approvalRole="DIRECTOR"
    />
  )
}
