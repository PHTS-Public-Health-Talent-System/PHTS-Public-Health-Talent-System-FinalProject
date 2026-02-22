import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { toast } from "sonner"
import { usePayrollDetailActions } from "./usePayrollDetailActions"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const createRouter = (): AppRouterInstance => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(async () => undefined),
  back: vi.fn(),
  forward: vi.fn(),
}) as AppRouterInstance

const createHook = (override?: Partial<Parameters<typeof usePayrollDetailActions>[0]>) => {
  const base = {
    router: createRouter(),
    basePath: "/pts-officer/payroll/1",
    periodId: "1",
    selectedProfession: "all",
    approvalRole: "HR" as const,
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

describe("usePayrollDetailActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("resets filters and routes when selecting profession", () => {
    const params = createHook()
    const { result } = renderHook(() => usePayrollDetailActions(params))

    result.current.handleSelectProfession("NURSE")
    expect(params.setSearchQuery).toHaveBeenCalledWith("")
    expect(params.setRateFilter).toHaveBeenCalledWith("all")
    expect(params.router.push).toHaveBeenCalledWith("/pts-officer/payroll/1/profession/NURSE")
  })

  it("reject action requires a non-empty comment", async () => {
    const params = createHook()
    const { result } = renderHook(() => usePayrollDetailActions(params))

    const ok = await result.current.handleAction("reject", "   ")
    expect(ok).toBe(false)
    expect(params.rejectPeriod.mutateAsync).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it("calls role-specific approve mutation", async () => {
    const params = createHook({
      approvalRole: "HEAD_FINANCE",
    })
    const { result } = renderHook(() => usePayrollDetailActions(params))

    const ok = await result.current.handleAction("approve", "")
    expect(ok).toBe(true)
    expect(params.approveByHeadFinance.mutateAsync).toHaveBeenCalledWith("1")
    expect(params.approveByHR.mutateAsync).not.toHaveBeenCalled()
  })
})
