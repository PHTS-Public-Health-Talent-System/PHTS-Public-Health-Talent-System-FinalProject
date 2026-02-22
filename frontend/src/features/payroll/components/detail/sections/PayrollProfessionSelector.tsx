"use client"

import type React from "react"
import { ChevronDown, ChevronUp, CheckCircle2, Filter, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatThaiNumber } from "@/shared/utils/thai-locale"
import { resolveProfessionReviewTone } from "../model/detail.helpers"
import type { ProfessionCardViewModel } from "../model/detail.view-model"

type PayrollProfessionSelectorProps = {
  selectedProfession: string
  isSelectorExpanded: boolean
  setIsSelectorExpanded: React.Dispatch<React.SetStateAction<boolean>>
  professionCards: ProfessionCardViewModel[]
  professionTotals: Map<string, number>
  reviewedCodeSet: Set<string>
  onSelectProfession: (code: string) => void
}

export function PayrollProfessionSelector({
  selectedProfession,
  isSelectorExpanded,
  setIsSelectorExpanded,
  professionCards,
  professionTotals,
  reviewedCodeSet,
  onSelectProfession,
}: PayrollProfessionSelectorProps) {
  return (
    <div className="space-y-3 px-6 md:px-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <LayoutGrid className="h-5 w-5 text-muted-foreground" />
          สถานะการตรวจสอบรายวิชาชีพ
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsSelectorExpanded((prev) => !prev)}
          title={isSelectorExpanded ? "ย่อ" : "ขยาย"}
        >
          {isSelectorExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {isSelectorExpanded && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {professionCards.map((profession) => {
            const isActive = selectedProfession === profession.code
            const isReviewed = reviewedCodeSet.has(profession.code.toUpperCase())
            const totalAmount = Number(professionTotals.get(profession.code) ?? 0)
            const reviewTone = resolveProfessionReviewTone({
              isReviewed,
              totalAmount,
            })
            return (
              <button
                key={profession.code}
                type="button"
                onClick={() => onSelectProfession(profession.code)}
                className={[
                  "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:shadow-md",
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card hover:border-primary/50",
                ].join(" ")}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="truncate pr-2 text-sm font-semibold">{profession.label}</span>
                  {reviewTone.useCheckIcon ? (
                    <CheckCircle2 className={cn("h-4 w-4 shrink-0", reviewTone.indicatorClassName)} />
                  ) : (
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        reviewTone.indicatorClassName,
                      )}
                    />
                  )}
                </div>
                <div className="mt-auto w-full">
                  <p className="text-xl font-bold tracking-tight text-foreground">
                    {formatThaiNumber(totalAmount)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">บาท</span>
                  </p>
                </div>
                <div
                  className={[
                    "absolute bottom-0 left-0 h-1 w-full rounded-b-xl",
                    reviewTone.barClassName,
                  ].join(" ")}
                />
              </button>
            )
          })}
        </div>
      )}

      {selectedProfession !== "all" && !isSelectorExpanded && (
        <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Filter className="h-3 w-3" />
          กำลังแสดงข้อมูล:{" "}
          <span className="font-medium text-foreground">
            {professionCards.find((p) => p.code === selectedProfession)?.label ?? selectedProfession}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ml-auto h-auto p-0"
            onClick={() => onSelectProfession("all")}
          >
            แสดงทั้งหมด
          </Button>
        </div>
      )}
    </div>
  )
}
