import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { vi } from 'vitest'
import type { PeriodDetail, PeriodPayoutRow } from '@/features/payroll/api'
import { usePayrollDetailActions } from './usePayrollDetailActions'

export const createRouter = (): AppRouterInstance =>
  ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(async () => undefined),
    back: vi.fn(),
    forward: vi.fn(),
  }) as AppRouterInstance

export const createPayrollDetailActionsParams = (
  override?: Partial<Parameters<typeof usePayrollDetailActions>[0]>,
) => {
  const base = {
    router: createRouter(),
    basePath: '/pts-officer/payroll/1',
    periodId: '1',
    selectedProfession: 'all',
    approvalRole: 'HR' as const,
    canRejectPeriod: true,
    approveByDirector: { mutateAsync: vi.fn(async () => undefined) },
    approveByHeadFinance: { mutateAsync: vi.fn(async () => undefined) },
    approveByHR: { mutateAsync: vi.fn(async () => undefined) },
    rejectPeriod: { mutateAsync: vi.fn(async () => undefined) },
    updatePayoutMutation: { mutateAsync: vi.fn(async () => undefined) },
    canEditPayout: true,
    setSearchQuery: vi.fn(),
    setRateFilter: vi.fn(),
  }
  return { ...base, ...override }
}

export const periodDetailFixture: PeriodDetail = {
  period: {
    period_id: 1,
    period_month: 2,
    period_year: 2569,
    status: 'OPEN',
    total_amount: 7000,
    total_headcount: 2,
  },
  items: [
    {
      period_item_id: 1,
      period_id: 1,
      request_id: 100,
      citizen_id: '1111111111111',
      snapshot_id: null,
      first_name: 'Alice',
      last_name: 'A',
      current_department: 'Dept A',
    },
  ],
}

export const payoutsFixture: PeriodPayoutRow[] = [
  {
    payout_id: 10,
    citizen_id: '1111111111111',
    profession_code: 'NURSE',
    first_name: 'Alice',
    last_name: 'A',
    department: 'Dept A',
    group_no: 2,
    item_no: '1',
    rate: 3000,
    total_payable: 3000,
    check_count: 1,
    blocker_count: 1,
    warning_count: 0,
    leave_count_in_period: 2,
    education_leave_count_in_period: 1,
  },
  {
    payout_id: 11,
    citizen_id: '2222222222222',
    profession_code: 'DOCTOR',
    first_name: 'Bob',
    last_name: 'B',
    department: 'Dept B',
    group_no: 1,
    item_no: '2',
    rate: 4000,
    total_payable: 4000,
    check_count: 0,
    blocker_count: 0,
    warning_count: 0,
    leave_count_in_period: 0,
    education_leave_count_in_period: 0,
  },
]
