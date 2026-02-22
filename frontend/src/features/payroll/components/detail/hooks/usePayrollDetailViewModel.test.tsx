import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { PeriodDetail, PeriodPayoutRow } from "@/features/payroll/api"
import { usePayrollDetailViewModel } from "./usePayrollDetailViewModel"

const periodDetailFixture: PeriodDetail = {
  period: {
    period_id: 1,
    period_month: 2,
    period_year: 2569,
    status: "OPEN",
    total_amount: 7000,
    total_headcount: 2,
  },
  items: [
    {
      period_item_id: 1,
      period_id: 1,
      request_id: 100,
      citizen_id: "1111111111111",
      snapshot_id: null,
      first_name: "Alice",
      last_name: "A",
      current_department: "Dept A",
    },
  ],
}

const payoutsFixture: PeriodPayoutRow[] = [
  {
    payout_id: 10,
    citizen_id: "1111111111111",
    profession_code: "NURSE",
    first_name: "Alice",
    last_name: "A",
    department: "Dept A",
    group_no: 2,
    item_no: "1",
    rate: 3000,
    total_payable: 3000,
    check_count: 1,
    blocker_count: 1,
    warning_count: 0,
  },
  {
    payout_id: 11,
    citizen_id: "2222222222222",
    profession_code: "DOCTOR",
    first_name: "Bob",
    last_name: "B",
    department: "Dept B",
    group_no: 1,
    item_no: "2",
    rate: 4000,
    total_payable: 4000,
    check_count: 0,
    blocker_count: 0,
    warning_count: 0,
  },
]

describe("usePayrollDetailViewModel", () => {
  it("derives and filters rows with default sort and issue filter", () => {
    const onAvailableProfessionsChange = vi.fn()
    const { result } = renderHook(() =>
      usePayrollDetailViewModel({
        selectedProfession: "all",
        periodDetail: periodDetailFixture,
        payoutsData: payoutsFixture,
        rateHierarchyData: [],
        reviewedProfessionCodes: ["NURSE"],
        onSubmitForReview: async () => undefined,
        onAvailableProfessionsChange,
      }),
    )

    expect(result.current.sortedPersons.map((row) => row.id)).toEqual([11, 10])
    expect(result.current.availableGroups).toEqual(["1", "2"])
    expect(result.current.canSubmitReview).toBe(false)

    act(() => {
      result.current.setIssueFilter("blocker")
    })
    expect(result.current.sortedPersons.map((row) => row.id)).toEqual([10])
  })

  it("calls onAvailableProfessionsChange with normalized profession cards", () => {
    const onAvailableProfessionsChange = vi.fn()
    renderHook(() =>
      usePayrollDetailViewModel({
        selectedProfession: "all",
        periodDetail: periodDetailFixture,
        payoutsData: payoutsFixture,
        rateHierarchyData: [],
        reviewedProfessionCodes: [],
        onAvailableProfessionsChange,
      }),
    )

    expect(onAvailableProfessionsChange).toHaveBeenCalledTimes(1)
    const firstCallArg = onAvailableProfessionsChange.mock.calls[0]?.[0]
    expect(firstCallArg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "NURSE" }),
        expect.objectContaining({ code: "PHYSICIAN" }),
      ]),
    )
  })
})
