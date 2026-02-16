"use client"

import { useMemo } from "react"
import { usePeriodReviewProgress, useSetPeriodProfessionReview } from "@/features/payroll/hooks"
import { toast } from "sonner"

export function usePayrollReviewProgress(periodId: string) {
  const reviewProgressQuery = usePeriodReviewProgress(periodId || undefined)
  const setReviewMutation = useSetPeriodProfessionReview()

  const setProfessionReviewed = (professionCode: string, reviewed: boolean) => {
    if (!professionCode || !periodId) return
    setReviewMutation.mutate(
      {
        periodId,
        professionCode,
        reviewed,
      },
      {
        onError: () => {
          toast.error("ไม่สามารถบันทึกสถานะการตรวจได้")
        },
      },
    )
  }

  const reviewedCodes = useMemo(() => {
    const rows = reviewProgressQuery.data?.reviewed_profession_codes ?? []
    return rows.map((code) => String(code).toUpperCase())
  }, [reviewProgressQuery.data?.reviewed_profession_codes])

  const reviewedMap = useMemo(() => {
    const map: Record<string, string> = {}
    reviewedCodes.forEach((code) => {
      map[code] = code
    })
    return map
  }, [reviewedCodes])

  const clearAllReviewed = () => {
    if (!periodId) return
    reviewedCodes.forEach((code) => {
      setReviewMutation.mutate({
        periodId,
        professionCode: code,
        reviewed: false,
      })
    })
  }

  const missingProfessionCodes = useMemo(() => {
    const rows = reviewProgressQuery.data?.missing_profession_codes ?? []
    return rows.map((code) => String(code).toUpperCase())
  }, [reviewProgressQuery.data?.missing_profession_codes])

  return {
    reviewedMap,
    reviewedCodes,
    missingProfessionCodes,
    totalRequired: reviewProgressQuery.data?.total_required ?? 0,
    totalReviewed: reviewProgressQuery.data?.total_reviewed ?? 0,
    allReviewed: reviewProgressQuery.data?.all_reviewed ?? false,
    isLoading: reviewProgressQuery.isLoading || setReviewMutation.isPending,
    setProfessionReviewed,
    clearAllReviewed,
    refetch: reviewProgressQuery.refetch,
  }
}
