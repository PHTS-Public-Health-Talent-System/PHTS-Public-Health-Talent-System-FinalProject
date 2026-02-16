"use client"

import { use } from "react"
import { ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { RequestWizard } from "@/features/request/components/wizard/request-wizard"
import { useRequestDetail } from "@/features/request/hooks"
import type { RequestWithDetails } from "@/types/request.types"

type HeadScopeMyRequestEditPageProps = {
  params: Promise<{ id: string }>;
  basePath: string;
}

export function HeadScopeMyRequestEditPage({ params, basePath }: HeadScopeMyRequestEditPageProps) {
  const { id } = use(params)
  const { data: request, isLoading } = useRequestDetail(id)

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="h-96 w-full bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Link
          href={`${basePath}/my-requests`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปรายการคำขอ
        </Link>
        <div className="rounded-lg border border-destructive/50 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <p className="mt-4 text-destructive">ไม่พบคำขอนี้</p>
        </div>
      </div>
    )
  }

  const canEdit = request.status === "DRAFT" || request.status === "RETURNED"

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href={`${basePath}/my-requests`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปรายการคำขอ
        </Link>
        <h1 className="text-2xl font-bold text-foreground">แก้ไขคำขอ พ.ต.ส.</h1>
        <p className="mt-1 text-muted-foreground">
          ปรับข้อมูลและแนบเอกสารเพิ่มเติมก่อนส่งใหม่
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          คำขอนี้ไม่สามารถแก้ไขได้ในสถานะปัจจุบัน
        </div>
      )}

      <RequestWizard
        initialRequest={request as RequestWithDetails}
        returnPath={`${basePath}/my-requests`}
      />
    </div>
  )
}
