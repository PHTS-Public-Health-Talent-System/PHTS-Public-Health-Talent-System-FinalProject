export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  return start.getTime() <= end.getTime()
}

export function validateOptionalDateRange(
  startDate: string,
  endDate: string,
  label: string,
): string | null {
  const hasStart = Boolean(startDate)
  const hasEnd = Boolean(endDate)
  if (!hasStart && !hasEnd) return null
  if (hasStart !== hasEnd) return `กรุณาระบุวันที่เริ่มและวันที่สิ้นสุดให้ครบ (${label})`
  if (!isValidDateRange(startDate, endDate)) return `วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม (${label})`
  return null
}

