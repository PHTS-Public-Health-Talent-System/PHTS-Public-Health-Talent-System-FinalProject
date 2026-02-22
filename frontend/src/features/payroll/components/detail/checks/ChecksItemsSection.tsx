"use client"

import { Calendar, List } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { PayoutDetail } from "@/features/payroll/api"
import { formatThaiNumber } from "@/shared/utils/thai-locale"

type ChecksItemsSectionProps = {
  items: PayoutDetail["items"]
}

export function ChecksItemsSection({ items }: ChecksItemsSectionProps) {
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <List className="h-4 w-4 text-primary" />
        รายการ
      </h3>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="p-3 font-medium text-muted-foreground">รายการ</th>
              <th className="p-3 text-right font-medium text-muted-foreground">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.item_id}>
                <td className="p-3">
                  <p className="font-medium">{item.description ?? "-"}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {Number(item.reference_month ?? 0) === 0 && Number(item.reference_year ?? 0) === 0
                      ? "แก้ไขด้วยมือ"
                      : `อ้างอิง ${item.reference_month}/${item.reference_year}`}
                    {item.item_type !== "CURRENT" ? (
                      <Badge variant="outline" className="ml-2 h-4 text-[10px]">
                        {item.item_type === "RETROACTIVE_ADD"
                          ? "ตกเบิก (เพิ่ม)"
                          : item.item_type === "RETROACTIVE_DEDUCT"
                            ? "ตกเบิก (หัก)"
                            : item.item_type}
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums">
                  {(() => {
                    const amount = Number(item.amount ?? 0)
                    if (!Number.isFinite(amount)) return "-"
                    if (item.item_type === "RETROACTIVE_DEDUCT") {
                      return <span className="font-medium text-orange-700">-{formatThaiNumber(amount)}</span>
                    }
                    if (item.item_type === "RETROACTIVE_ADD") {
                      return <span className="font-medium text-blue-600">+{formatThaiNumber(amount)}</span>
                    }
                    return formatThaiNumber(amount)
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
