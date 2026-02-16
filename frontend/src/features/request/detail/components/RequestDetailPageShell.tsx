"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, AlertCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatThaiDateTime } from "@/features/request/detail/requestDetail.format"
import { getStatusColor, getStatusLabel } from "@/features/request/detail/requestDetail.status"

type ShellState = "loading" | "notFound" | "ready"

export function RequestDetailPageShell({
  state,
  backHref,
  backLabel,
  displayId,
  status,
  currentStep,
  createdAt,
  headerActions,
  left,
  right,
  after,
}: {
  state: ShellState
  backHref: string
  backLabel: string
  displayId?: string
  status?: string
  currentStep?: number | null
  createdAt?: string | null
  headerActions?: ReactNode
  left?: ReactNode
  right?: ReactNode
  after?: ReactNode
}) {
  if (state === "loading") {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8 space-y-4">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="flex justify-between items-center">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-64 w-full bg-muted animate-pulse rounded-xl" />
            <div className="h-48 w-full bg-muted animate-pulse rounded-xl" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="h-96 w-full bg-muted animate-pulse rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (state === "notFound") {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-foreground">ไม่พบข้อมูลคำขอ</h2>
        <p className="text-muted-foreground mb-6">คำขอที่ต้องการตรวจสอบอาจไม่มีอยู่ในระบบ</p>
        <Link href={backHref}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับไป{backLabel}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24">
      <div className="mb-8">
        <nav className="flex items-center text-sm text-muted-foreground mb-4">
          <Link href={backHref} className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
          <span className="text-foreground font-medium">รายละเอียด</span>
        </nav>

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{displayId}</h1>
              {status && (
                <Badge
                  variant="outline"
                  className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(status)}`}
                >
                  {getStatusLabel(status, currentStep)}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              สร้างเมื่อ {formatThaiDateTime(createdAt ?? null)}
            </p>
          </div>

          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="space-y-8 lg:col-span-8">{left}</div>
        <div className="space-y-6 lg:col-span-4 sticky top-6">{right}</div>
      </div>

      {after}
    </div>
  )
}

