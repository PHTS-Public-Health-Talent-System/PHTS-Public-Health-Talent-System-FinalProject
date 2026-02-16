"use client"

import { use } from "react"
import { PayrollDetailContent } from "@/features/payroll/components/PayrollDetailContent"

type PageParams = Promise<{ id: string; code: string }>

export default function HeadHRPayrollProfessionPage({ params }: { params: PageParams }) {
  const { id, code } = use(params)

  return (
    <PayrollDetailContent
      periodId={id}
      selectedProfession={code}
      basePath={`/head-hr/payroll/${id}`}
      compactView
      backHref={`/head-hr/payroll/${id}`}
      showSelector={false}
      showSummary
    />
  )
}
