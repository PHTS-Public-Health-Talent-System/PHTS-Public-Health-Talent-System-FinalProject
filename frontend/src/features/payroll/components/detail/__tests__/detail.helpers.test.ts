import { describe, expect, it } from 'vitest'

import { resolveProfessionReviewTone } from "../model/detail.helpers"

describe('resolveProfessionReviewTone', () => {
  it('returns reviewed tone when profession is reviewed', () => {
    expect(resolveProfessionReviewTone({ isReviewed: true, totalAmount: 1500 })).toEqual({
      indicatorClassName: 'text-emerald-500',
      barClassName: 'bg-emerald-500',
      useCheckIcon: true,
    })
  })

  it('returns neutral tone when no payout amount and not reviewed', () => {
    expect(resolveProfessionReviewTone({ isReviewed: false, totalAmount: 0 })).toEqual({
      indicatorClassName: 'bg-muted-foreground/40',
      barClassName: 'bg-muted-foreground/20',
      useCheckIcon: false,
    })
  })

  it('returns warning tone when has payout amount and not reviewed', () => {
    expect(resolveProfessionReviewTone({ isReviewed: false, totalAmount: 910.71 })).toEqual({
      indicatorClassName: 'bg-amber-400',
      barClassName: 'bg-amber-400/50',
      useCheckIcon: false,
    })
  })
})
