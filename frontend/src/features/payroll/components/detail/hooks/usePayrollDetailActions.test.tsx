import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { toast } from "sonner"
import { usePayrollDetailActions } from "./usePayrollDetailActions"
import { createPayrollDetailActionsParams } from "./test-fixtures"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe("usePayrollDetailActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("resets filters and routes when selecting profession", () => {
    const params = createPayrollDetailActionsParams()
    const { result } = renderHook(() => usePayrollDetailActions(params))

    result.current.handleSelectProfession("NURSE")
    expect(params.setSearchQuery).toHaveBeenCalledWith("")
    expect(params.setRateFilter).toHaveBeenCalledWith("all")
    expect(params.router.push).toHaveBeenCalledWith("/pts-officer/payroll/1/profession/NURSE")
  })

  it("reject action requires a non-empty comment", async () => {
    const params = createPayrollDetailActionsParams()
    const { result } = renderHook(() => usePayrollDetailActions(params))

    const ok = await result.current.handleAction("reject", "   ")
    expect(ok).toBe(false)
    expect(params.rejectPeriod.mutateAsync).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it("calls role-specific approve mutation", async () => {
    const params = createPayrollDetailActionsParams({
      approvalRole: "HEAD_FINANCE",
    })
    const { result } = renderHook(() => usePayrollDetailActions(params))

    const ok = await result.current.handleAction("approve", "")
    expect(ok).toBe(true)
    expect(params.approveByHeadFinance.mutateAsync).toHaveBeenCalledWith("1")
    expect(params.approveByHR.mutateAsync).not.toHaveBeenCalled()
  })
})
