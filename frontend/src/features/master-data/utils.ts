export interface NormalizedRate {
  id: number
  professionCode: string
  groupNo: number
  itemNo?: string | null
  subItemNo?: string | null
  code: string
  name: string
  amount: number
  description: string
  requirements: string
  isActive: boolean
  effectiveDate: string
  eligibleCount: number
}

function formatCurrency(amount: number): string {
  return formatThaiNumber(amount)
}

export function normalizeMasterRates(input: Array<Record<string, unknown>>): NormalizedRate[] {
  return input
    // If upstream provides is_active, treat falsy (0/false) as inactive and exclude from UI lists by default.
    .filter((row) => Boolean(row.is_active ?? true))
    .map((row) => {
      const professionCode = String(row.profession_code ?? "")
      const groupNo = Number(row.group_no ?? 0)
      const itemNo = row.item_no ? String(row.item_no) : null
      const subItemNo = row.sub_item_no ? String(row.sub_item_no) : null
      const codeParts = [professionCode, String(groupNo)]
      if (itemNo) codeParts.push(itemNo)
      if (subItemNo) codeParts.push(subItemNo)
      const code = codeParts.filter(Boolean).join("-")
      const amount = Number(row.amount ?? 0)
      const conditionDesc = String(row.condition_desc ?? "")
      const detailedDesc = String(row.detailed_desc ?? "")
      return {
        id: Number(row.rate_id ?? 0),
        professionCode,
        groupNo,
        itemNo,
        subItemNo,
        code: code || `RATE-${row.rate_id ?? "-"}`,
        name: conditionDesc || `อัตรา ${formatCurrency(amount)} บาท/เดือน`,
        amount,
        description: conditionDesc || "-",
        requirements: detailedDesc || conditionDesc || "-",
        isActive: Boolean(row.is_active ?? true),
        effectiveDate: String(row.created_at ?? ""),
        eligibleCount: Number(row.eligible_count ?? 0),
      }
    })
}
import { formatThaiNumber } from "@/shared/utils/thai-locale"
