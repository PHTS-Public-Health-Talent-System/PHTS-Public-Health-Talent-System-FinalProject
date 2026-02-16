"use client"
export const dynamic = 'force-dynamic'

import { use } from "react"
import Link from "next/link"
import { PayrollDetailContent } from "@/features/payroll/components/PayrollDetailContent"
import { usePayrollReviewProgress } from "@/features/payroll/usePayrollReviewProgress"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"

type PageParams = Promise<{ id: string; code: string }>

export default function PTSOfficerPayrollProfessionPage({ params }: { params: PageParams }) {
  const { id, code } = use(params)
  const { reviewedCodes, setProfessionReviewed } = usePayrollReviewProgress(id)

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="flex items-center justify-between border-b bg-muted/20 px-6 py-4 md:px-8">
        <div>
          <h1 className="text-lg font-semibold text-foreground">ตรวจสอบรายละเอียดรายวิชาชีพ</h1>
          <p className="text-xs text-muted-foreground">
            โปรดตรวจสอบความถูกต้องและยืนยันสถานะการตรวจ
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="hidden md:flex">
          <Link href={`/pts-officer/payroll/${id}`}>
            <Users className="mr-2 h-4 w-4" />
            กลับไปหน้าภาพรวมงวด
          </Link>
        </Button>
      </div>

      <PayrollDetailContent
        periodId={id}
        selectedProfession={code}
        basePath={`/pts-officer/payroll/${id}`}
        backHref={`/pts-officer/payroll/${id}`}
        compactView
        showSelector={false}
        showSummary={true}
        showTable={true}
        allowApprovalActions={false}
        reviewedProfessionCodes={reviewedCodes}
        onSetProfessionReviewed={setProfessionReviewed}
      />
    </div>
  )
}
