import { UserRole } from "@/types/auth.js";
import { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";
import {
  getPendingPayrollCount,
  getPendingRequestCount,
  getPendingPayrollStatusForApprover,
} from "@/modules/dashboard/services/counters.service.js";

jest.mock("@/modules/request/read/services/query.service.js", () => ({
  requestQueryService: {
    getMyRequests: jest.fn(),
    getPendingForApprover: jest.fn(),
  },
}));

jest.mock("@/modules/finance/repositories/finance.repository.js", () => ({
  FinanceRepository: {
    findFinanceSummary: jest.fn(),
  },
}));

jest.mock("@/modules/payroll/repositories/payroll.repository.js", () => ({
  PayrollRepository: {
    findPeriodsByStatus: jest.fn(),
  },
}));

const { requestQueryService } = jest.requireMock(
  "@/modules/request/read/services/query.service.js",
) as {
  requestQueryService: {
    getMyRequests: jest.Mock;
    getPendingForApprover: jest.Mock;
  };
};

const { FinanceRepository } = jest.requireMock(
  "@/modules/finance/repositories/finance.repository.js",
) as {
  FinanceRepository: {
    findFinanceSummary: jest.Mock;
  };
};

const { PayrollRepository } = jest.requireMock(
  "@/modules/payroll/repositories/payroll.repository.js",
) as {
  PayrollRepository: {
    findPeriodsByStatus: jest.Mock;
  };
};

describe("dashboard counters service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("counts pending requests for USER from my-requests statuses", async () => {
    requestQueryService.getMyRequests.mockResolvedValue([
      { status: "PENDING" },
      { status: "PENDING_RECHECK" },
      { status: "APPROVED" },
    ]);

    const result = await getPendingRequestCount({
      role: UserRole.USER,
      userId: 99,
    });

    expect(requestQueryService.getMyRequests).toHaveBeenCalledWith(99);
    expect(result).toBe(2);
  });

  it("counts pending requests for approver roles from approver query", async () => {
    requestQueryService.getPendingForApprover.mockResolvedValue([{}, {}, {}]);

    const result = await getPendingRequestCount({
      role: UserRole.HEAD_HR,
      userId: 21,
    });

    expect(requestQueryService.getPendingForApprover).toHaveBeenCalledWith(
      UserRole.HEAD_HR,
      21,
    );
    expect(result).toBe(3);
  });

  it("counts pending payroll for finance officer from finance summary", async () => {
    FinanceRepository.findFinanceSummary.mockResolvedValue([
      { pending_count: 0, pending_amount: 0 },
      { pending_count: 1, pending_amount: 0 },
      { pending_count: 0, pending_amount: 100 },
    ]);

    const result = await getPendingPayrollCount(UserRole.FINANCE_OFFICER);

    expect(FinanceRepository.findFinanceSummary).toHaveBeenCalledWith(
      undefined,
      undefined,
      true,
    );
    expect(result).toBe(2);
  });

  it("counts pending payroll for approver roles from payroll periods", async () => {
    PayrollRepository.findPeriodsByStatus.mockResolvedValue([{}, {}]);

    const result = await getPendingPayrollCount(UserRole.DIRECTOR);

    expect(PayrollRepository.findPeriodsByStatus).toHaveBeenCalledWith(
      PeriodStatus.WAITING_DIRECTOR,
      50,
    );
    expect(result).toBe(2);
  });

  it("resolves approver payroll status", () => {
    expect(getPendingPayrollStatusForApprover(UserRole.HEAD_HR)).toBe(
      PeriodStatus.WAITING_HR,
    );
    expect(getPendingPayrollStatusForApprover(UserRole.HEAD_FINANCE)).toBe(
      PeriodStatus.WAITING_HEAD_FINANCE,
    );
  });
});
