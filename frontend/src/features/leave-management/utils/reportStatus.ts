import type { LeaveReturnReportEvent } from "@/features/leave-management/api"

export type ReturnReportStatus = "pending" | "reported"

export function deriveReturnReportStatus(params: {
  requireReport: boolean
  returnDate?: string | null
  events?: LeaveReturnReportEvent[] | null
}): ReturnReportStatus | undefined {
  const { requireReport, returnDate, events } = params
  if (!requireReport) return undefined

  const hasEvent = Array.isArray(events) && events.length > 0
  if (hasEvent) return "reported"

  return returnDate ? "reported" : "pending"
}
