"use client"

import { Banknote, Calculator, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatThaiNumber } from "@/shared/utils/thai-locale"

type ChecksCalculationSectionProps = {
  baseRate: number
  eligibleDays: number
  deductedDays: number
  calculatedAmount: number
  deductedAmount: number
  otherLoss: number
  retro: number
  totalPayable: number
}

export function ChecksCalculationSection({
  baseRate,
  eligibleDays,
  deductedDays,
  calculatedAmount,
  deductedAmount,
  otherLoss,
  retro,
  totalPayable,
}: ChecksCalculationSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Calculator className="h-4 w-4 text-primary" />
        รายละเอียดการคำนวณ
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground">
            <FileText className="h-3 w-3" /> ข้อมูลสิทธิ
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">อัตราเงิน</span>
              <span className="font-medium">{formatThaiNumber(baseRate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">วันมีสิทธิ</span>
              <span className="font-medium">{formatThaiNumber(eligibleDays)} วัน</span>
            </div>
            <div className="flex justify-between text-sm text-orange-600/80">
              <span>วันถูกหัก</span>
              <span className="font-medium">-{formatThaiNumber(deductedDays)} วัน</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-secondary/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground">
            <Banknote className="h-3 w-3" /> สรุปยอดเงิน
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">เงินงวดปัจจุบัน</span>
              <span className="font-medium">{formatThaiNumber(calculatedAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ถูกหัก (ตามวันถูกหัก)</span>
              <span className={cn("font-medium tabular-nums", deductedAmount > 0 ? "text-orange-700" : "text-muted-foreground")}>
                -{formatThaiNumber(deductedAmount, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ขาดสิทธิ/ไม่ครอบคลุมงวด</span>
              <span className={cn("font-medium tabular-nums", otherLoss > 0 ? "text-orange-700" : "text-muted-foreground")}>
                -{formatThaiNumber(otherLoss, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ตกเบิก</span>
              <span
                className={cn(
                  "font-medium",
                  retro > 0 ? "text-blue-600" : retro < 0 ? "text-orange-600" : "text-muted-foreground",
                )}
              >
                {retro > 0 ? "+" : ""}
                {formatThaiNumber(retro)}
              </span>
            </div>
            <div className="flex items-end justify-between border-t pt-2">
              <span className="text-sm font-semibold">รวมจ่ายสุทธิ</span>
              <span className="text-lg font-bold text-emerald-600">
                {formatThaiNumber(totalPayable)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
