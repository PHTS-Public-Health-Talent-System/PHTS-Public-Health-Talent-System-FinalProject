import { THAI_LOCALE, THAI_TIMEZONE, toGregorianYear } from "@/shared/utils/thai-locale";

export type PayPeriodStatus =
  | "OPEN"
  | "WAITING_HR"
  | "WAITING_HEAD_FINANCE"
  | "WAITING_DIRECTOR"
  | "CLOSED"

// Pay period status progression used by steppers/timelines.
export const PAY_PERIOD_STATUS_STEPS: ReadonlyArray<{ id: PayPeriodStatus; label: string }> = [
  { id: "OPEN", label: "เปิดรอบ/ตรวจสอบ" },
  { id: "WAITING_HR", label: "รอหัวหน้า HR อนุมัติ" },
  { id: "WAITING_HEAD_FINANCE", label: "รอหัวหน้าการเงิน" },
  { id: "WAITING_DIRECTOR", label: "รอ ผอ. อนุมัติ" },
  { id: "CLOSED", label: "ปิดงวด/จ่ายเงิน" },
]

export const PAY_PERIOD_STATUS_CONFIG: Record<PayPeriodStatus, { label: string; className: string }> =
  {
    OPEN: {
      label: "เปิดรอบ",
      className: "bg-secondary",
    },
    WAITING_HR: {
      label: "รอ HR อนุมัติ",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    WAITING_HEAD_FINANCE: {
      label: "รอหัวหน้าการเงิน",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    WAITING_DIRECTOR: {
      label: "รอผู้อำนวยการ",
      className: "bg-primary/10 text-primary border-primary/30",
    },
    CLOSED: {
      label: "ปิดงวดแล้ว",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
  }

export function asPayPeriodStatus(value?: string | null): PayPeriodStatus {
  switch ((value ?? "").toUpperCase()) {
    case "OPEN":
      return "OPEN"
    case "WAITING_HR":
      return "WAITING_HR"
    case "WAITING_HEAD_FINANCE":
      return "WAITING_HEAD_FINANCE"
    case "WAITING_DIRECTOR":
      return "WAITING_DIRECTOR"
    case "CLOSED":
      return "CLOSED"
    default:
      return "OPEN"
  }
}

export function formatThaiDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString(
    THAI_LOCALE,
    options ?? {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: THAI_TIMEZONE,
    },
  )
}

export function getThaiMonthName(month1to12: number): string {
  const month = Number(month1to12)
  if (!Number.isFinite(month) || month < 1 || month > 12) return "-"
  // Month names are locale-provided (th-TH) instead of hardcoding.
  return new Date(2020, month - 1, 1).toLocaleDateString(THAI_LOCALE, {
    month: "long",
    timeZone: THAI_TIMEZONE,
  })
}

export function formatPayrollPeriodLabel(month?: number | null, year?: number | null): string {
  if (!month || !year) return "-"
  const date = new Date(toGregorianYear(year), month - 1, 1)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString(THAI_LOCALE, { month: "long", year: "numeric", timeZone: THAI_TIMEZONE })
}
