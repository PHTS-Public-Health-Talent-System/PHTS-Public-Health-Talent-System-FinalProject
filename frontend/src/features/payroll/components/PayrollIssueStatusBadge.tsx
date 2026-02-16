"use client"

import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

export function PayrollIssueStatusBadge({
  checkCount,
  blockerCount,
  warningCount,
}: {
  checkCount: number
  blockerCount: number
  warningCount: number
}) {
  if (blockerCount > 0) {
    return (
      <Badge variant="destructive" className="gap-1 px-2">
        <XCircle className="h-3 w-3" />
        <span className="hidden sm:inline">หยุดจ่าย ({blockerCount})</span>
        <span className="sm:hidden">{blockerCount}</span>
      </Badge>
    )
  }

  const count = warningCount > 0 ? warningCount : checkCount
  if (count > 0) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 border border-amber-200 bg-amber-100 px-2 text-amber-700 hover:bg-amber-100"
      >
        <AlertTriangle className="h-3 w-3" />
        <span className="hidden sm:inline">ตรวจสอบ ({count})</span>
        <span className="sm:hidden">{count}</span>
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-emerald-200 bg-emerald-50 px-2 text-emerald-600"
    >
      <CheckCircle2 className="h-3 w-3" />
      <span className="hidden sm:inline">ปกติ</span>
    </Badge>
  )
}

