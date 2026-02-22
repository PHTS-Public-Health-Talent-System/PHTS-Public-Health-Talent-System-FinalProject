"use client"

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type IssueStatusBadgeLabels = {
  blocker: string
  warning: string
  normal: string
}

type IssueStatusBadgeProps = {
  checkCount: number
  blockerCount: number
  warningCount: number
  labels?: Partial<IssueStatusBadgeLabels>
}

const DEFAULT_LABELS: IssueStatusBadgeLabels = {
  blocker: "หยุดจ่าย",
  warning: "ตรวจสอบ",
  normal: "ปกติ",
}

export function IssueStatusBadge({
  checkCount,
  blockerCount,
  warningCount,
  labels,
}: IssueStatusBadgeProps) {
  const resolvedLabels = {
    ...DEFAULT_LABELS,
    ...labels,
  }

  if (blockerCount > 0) {
    return (
      <Badge variant="destructive" className="gap-1 px-2">
        <XCircle className="h-3 w-3" />
        <span className="hidden sm:inline">
          {resolvedLabels.blocker} ({blockerCount})
        </span>
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
        <span className="hidden sm:inline">
          {resolvedLabels.warning} ({count})
        </span>
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
      <span className="hidden sm:inline">{resolvedLabels.normal}</span>
    </Badge>
  )
}
