import type { EligibilityRecord } from "@/features/request/api"

export interface AllowancePerson {
  id: number
  prefix: string
  firstName: string
  lastName: string
  position: string
  professionCode: string
  professionLabel: string
  licenseExpiry: string
  rateGroup: string
  rateItem: string
  baseRate: number
  actualRate: number
  note?: string
}

const backendProfessionMap: Record<string, string> = {
  DOCTOR: "PHYSICIAN",
  DENTIST: "DENTIST",
  PHARMACIST: "PHARMACIST",
  NURSE: "NURSE",
  MED_TECH: "MED_TECH",
  RAD_TECH: "RADIOLOGIST",
  PHYSIO: "PHYSICAL_THERAPY",
  OCC_THERAPY: "OCCUPATIONAL_THERAPY",
  CLIN_PSY: "CLINICAL_PSYCHOLOGIST",
  CARDIO_TECH: "CARDIO_THORACIC_TECH",
}

export const professionLabels: Record<string, string> = {
  NURSE: "พยาบาลวิชาชีพ",
  PHYSICIAN: "แพทย์",
  MED_TECH: "นักเทคนิคการแพทย์",
  PHYSICAL_THERAPY: "นักกายภาพบำบัด",
  OCCUPATIONAL_THERAPY: "นักกิจกรรมบำบัด",
  RADIOLOGIST: "นักรังสีการแพทย์",
  PHARMACIST: "เภสัชกร",
  DENTIST: "ทันตแพทย์",
  CLINICAL_PSYCHOLOGIST: "นักจิตวิทยาคลินิก",
  CARDIO_THORACIC_TECH: "นักเทคโนโลยีหัวใจและทรวงอก",
}

export function normalizeProfessionCode(value?: string | null): string {
  if (!value) return "UNKNOWN"
  const upper = value.toUpperCase()
  return backendProfessionMap[upper] ?? upper
}

export function resolveProfessionLabel(code: string): string {
  return professionLabels[code] ?? code
}

function formatDate(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

export function mapEligibility(row: EligibilityRecord): AllowancePerson {
  const rateValue = Number(row.rate_amount ?? 0)
  const groupNo = row.group_no !== null && row.group_no !== undefined ? String(row.group_no) : "-"
  const itemNo = row.item_no !== null && row.item_no !== undefined ? String(row.item_no) : "-"
  const subItemNo =
    row.sub_item_no !== null && row.sub_item_no !== undefined ? String(row.sub_item_no) : null
  const professionCode = normalizeProfessionCode(row.profession_code)

  return {
    id: row.eligibility_id,
    prefix: row.title ?? "",
    firstName: row.first_name ?? "-",
    lastName: row.last_name ?? "",
    position: row.position_name ?? "-",
    professionCode,
    professionLabel: resolveProfessionLabel(professionCode),
    licenseExpiry: formatDate(row.expiry_date ?? null),
    rateGroup: groupNo,
    rateItem: subItemNo && subItemNo !== "-" ? `${itemNo}.${subItemNo}` : itemNo,
    baseRate: rateValue,
    actualRate: rateValue,
    note: row.request_no ? `อ้างอิงคำขอ ${row.request_no}` : undefined,
  }
}

export function getRateGroupBadgeClass(rateGroup: string): string {
  if (rateGroup === "1") return "bg-primary/10 text-primary"
  if (rateGroup === "2") return "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
  if (rateGroup === "3") return "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
  return "bg-muted text-muted-foreground"
}
