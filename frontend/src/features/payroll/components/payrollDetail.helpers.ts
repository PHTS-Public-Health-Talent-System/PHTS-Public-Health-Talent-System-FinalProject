"use client"

import type { PeriodStatus, IssueKey, IssueTag } from "./payrollDetail.types"
import { formatThaiDate, formatThaiMonthYear } from "@/shared/utils/thai-locale"

export const parseGroupNumber = (value?: string) => {
  if (!value) return null
  const match = value.match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isNaN(parsed) ? null : parsed
}

export const formatPeriodLabel = (month?: number | null, year?: number | null) => {
  if (!month || !year) return "-"
  return formatThaiMonthYear(month, year)
}

export const formatDate = (value?: string | null) => {
  return formatThaiDate(value)
}

export const formatDateOrEmpty = (value?: string | null) => {
  if (!value) return ""
  const formatted = formatThaiDate(value)
  return formatted === "-" ? "" : formatted
}

export const diffDaysFromNow = (value?: string | null) => {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null
  const ms = target.getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export const buildIssues = (params: {
  retroactiveAmount: number
  deductionAmount: number
  note?: string
  licenseValidUntil?: string | null
}): IssueTag[] => {
  const issues: IssueTag[] = []

  const daysLeft = diffDaysFromNow(params.licenseValidUntil ?? null)
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      issues.push({ key: "LICENSE_EXPIRED", label: "ใบอนุญาตหมดอายุ", level: "ต้องหยุดก่อน" })
    } else if (daysLeft <= 60) {
      issues.push({ key: "LICENSE_SOON", label: "ใบอนุญาตใกล้หมดอายุ", level: "ควรตรวจ" })
    }
  }

  if (params.deductionAmount > 0) {
    issues.push({ key: "HAS_DEDUCTION", label: "มีเงินหัก", level: "ควรตรวจ" })
  }

  if (params.retroactiveAmount > 0) {
    issues.push({ key: "HAS_RETRO", label: "มีตกเบิก", level: "ควรตรวจ" })
  }

  if (params.retroactiveAmount < 0) {
    issues.push({ key: "HAS_RETRO_DEDUCT", label: "มีตกเบิก (หัก)", level: "ควรตรวจ" })
  }

  if (params.note && params.note.trim()) {
    issues.push({ key: "HAS_NOTE", label: "มีหมายเหตุ", level: "ควรตรวจ" })
  }

  return issues
}

export const issueBadgeClass = (key: IssueKey) => {
  switch (key) {
    case "LICENSE_EXPIRED":
      return "bg-rose-50 text-rose-700 border-rose-200"
    case "LICENSE_SOON":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "HAS_DEDUCTION":
      return "bg-orange-50 text-orange-700 border-orange-200"
    case "HAS_RETRO":
      return "bg-sky-50 text-sky-700 border-sky-200"
    case "HAS_RETRO_DEDUCT":
      return "bg-orange-50 text-orange-700 border-orange-200"
    case "HAS_NOTE":
      return "bg-slate-100 text-slate-700 border-slate-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

export const escapeCsvValue = (value: string | number | null | undefined) => {
  const normalized = value === null || value === undefined ? "" : String(value)
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

export const statusConfig: Record<PeriodStatus, { label: string; color: string }> = {
  OPEN: { label: "เปิดรอบ", color: "bg-muted/30 text-muted-foreground border-muted-foreground/30" },
  WAITING_HR: { label: "รอ HR อนุมัติ", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  WAITING_HEAD_FINANCE: { label: "รอหัวหน้าการเงิน", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  WAITING_DIRECTOR: { label: "รอผู้อำนวยการ", color: "bg-primary/20 text-primary border-primary/30" },
  CLOSED: { label: "ปิดงวดแล้ว", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
}

export const resolveProfessionReviewTone = (params: {
  isReviewed: boolean
  totalAmount: number
}) => {
  if (params.isReviewed) {
    return {
      indicatorClassName: "text-emerald-500",
      barClassName: "bg-emerald-500",
      useCheckIcon: true,
    }
  }
  if (params.totalAmount <= 0) {
    return {
      indicatorClassName: "bg-muted-foreground/40",
      barClassName: "bg-muted-foreground/20",
      useCheckIcon: false,
    }
  }
  return {
    indicatorClassName: "bg-amber-400",
    barClassName: "bg-amber-400/50",
    useCheckIcon: false,
  }
}
