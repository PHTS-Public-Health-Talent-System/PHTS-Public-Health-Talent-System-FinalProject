import {
  formatThaiDate as formatThaiDateCore,
  formatThaiDateTime as formatThaiDateTimeCore,
} from "@/shared/utils/thai-locale"

export function formatThaiDateTime(value?: string | null) {
  return formatThaiDateTimeCore(value)
}

export function formatThaiDate(value?: string | Date | null) {
  return formatThaiDateCore(value, { month: "long" })
}

export function toDateOnly(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}
