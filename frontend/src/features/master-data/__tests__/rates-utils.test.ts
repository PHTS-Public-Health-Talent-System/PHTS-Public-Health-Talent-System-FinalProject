import { describe, expect, it } from 'vitest'
import { normalizeMasterRates } from '../utils'

describe('normalizeMasterRates', () => {
  it('filters out inactive rates', () => {
    const input = [
      { rate_id: 1, profession_code: 'DOCTOR', group_no: 1, amount: 1000, condition_desc: 'A', is_active: 1 },
      { rate_id: 2, profession_code: 'DOCTOR', group_no: 1, amount: 2000, condition_desc: 'B', is_active: 0 },
    ]

    const result = normalizeMasterRates(input)

    expect(result.map((r) => r.id)).toEqual([1])
  })
})
