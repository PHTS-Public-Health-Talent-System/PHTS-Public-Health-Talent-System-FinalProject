"use client"

import { formatThaiDate } from "@/shared/utils/thai-locale"
import { getLeaveTypeLabel } from "@/features/leave-records/leave-type-definitions"

export const formatThaiShortDate = (value: unknown) => {
  const raw = typeof value === "string" ? value : ""
  const ymd = raw.length >= 10 ? raw.slice(0, 10) : ""
  if (!ymd) return "-"
  return formatThaiDate(`${ymd}T00:00:00`)
}

export const leaveTypeLabel = (leaveType: string) => {
  return getLeaveTypeLabel(leaveType)
}

export const quotaUnitLabel = (unit: string) => {
  if (unit === "business_days") return "วันทำการ"
  if (unit === "calendar_days") return "วันปฏิทิน (นับต่อเนื่องรวมวันหยุด)"
  return unit || "-"
}

export const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
