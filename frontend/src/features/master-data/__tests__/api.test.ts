import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/api/axios', () => {
  return {
    default: {
      delete: vi.fn(() => Promise.resolve({ data: { data: { ok: true } } })),
    },
  }
})

import api from '@/shared/api/axios'
import { deleteMasterRate } from '../api'

describe('master-data api', () => {
  it('deleteMasterRate calls delete endpoint', async () => {
    await deleteMasterRate(42)

    expect(api.delete).toHaveBeenCalledWith('/config/rates/42')
  })
})
