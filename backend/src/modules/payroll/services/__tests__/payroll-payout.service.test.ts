import { PayrollPayoutService } from "@/modules/payroll/services/calculation/payroll-payout.service.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { PayrollQueryRepository } from "@/modules/payroll/repositories/query.repository.js";
import { PayrollWorkflowService } from "@/modules/payroll/services/workflow/payroll-workflow.service.js";

jest.mock("@/modules/payroll/repositories/payroll.repository.js", () => ({
  PayrollRepository: {
    findPayoutsByPeriod: jest.fn(),
    findPeriodById: jest.fn(),
    findPayoutDetailById: jest.fn(),
    findPayoutItemsByPayoutId: jest.fn(),
    findPayoutChecksByPayoutId: jest.fn(),
    findPaymentRatesByIds: jest.fn(),
    findHolidayDatesInRange: jest.fn(),
    getConnection: jest.fn(),
    searchPayouts: jest.fn(),
  },
}));

jest.mock("@/modules/payroll/repositories/query.repository.js", () => ({
  PayrollQueryRepository: {
    fetchBatchData: jest.fn(),
  },
}));

jest.mock("@/modules/payroll/services/workflow/payroll-workflow.service.js", () => ({
  PayrollWorkflowService: {
    canRoleViewPeriod: jest.fn(),
  },
}));

describe("PayrollPayoutService.getPayoutDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PayrollWorkflowService.canRoleViewPeriod as jest.Mock).mockReturnValue(true);
  });

  test("includes leave impact summary for the payout month", async () => {
    (PayrollRepository.findPayoutDetailById as jest.Mock).mockResolvedValue({
      payout_id: 88,
      citizen_id: "1111111111111",
      period_month: 2,
      period_year: 2026,
      pts_rate_snapshot: 2800,
    });
    (PayrollRepository.findPayoutItemsByPayoutId as jest.Mock).mockResolvedValue([]);
    (PayrollRepository.findPayoutChecksByPayoutId as jest.Mock).mockResolvedValue([]);
    (PayrollRepository.findHolidayDatesInRange as jest.Mock).mockResolvedValue([]);
    const release = jest.fn();
    (PayrollRepository.getConnection as jest.Mock).mockResolvedValue({ release });
    (PayrollQueryRepository.fetchBatchData as jest.Mock).mockResolvedValue({
      eligibilityRows: [
        {
          eligibility_id: 14998,
          master_rate_id: 9001,
          group_no: 1,
          item_no: 2,
          sub_item_no: 3,
          citizen_id: "1111111111111",
          effective_date: new Date("2026-01-31T17:00:00.000Z"),
          expiry_date: new Date("2026-02-14T16:59:59.000Z"),
          rate: 2800,
        },
        {
          eligibility_id: 15556,
          master_rate_id: 9002,
          group_no: 4,
          item_no: 5,
          sub_item_no: 6,
          citizen_id: "1111111111111",
          effective_date: new Date("2026-02-14T17:00:00.000Z"),
          expiry_date: null,
          rate: 1500,
        },
      ],
      leaveRows: [
        {
          id: 12,
          citizen_id: "1111111111111",
          leave_type: "personal",
          start_date: "2026-02-10",
          end_date: "2026-02-13",
          duration_days: 4,
          is_no_pay: 0,
          pay_exception: 0,
        },
      ],
      quotaRows: [{ quota_personal: 2 }],
      noSalaryRows: [],
      returnReportRows: [],
    });

    const result = await PayrollPayoutService.getPayoutDetail(88, "PTS_OFFICER");

    expect(result.leaveImpactSummary).toEqual(
      expect.objectContaining({
        deductedDays: 2,
        deductedAmount: 200,
        leavesInPeriod: expect.arrayContaining([
          expect.objectContaining({
            leaveRecordId: 12,
            leaveType: "personal",
            overQuota: true,
          }),
        ]),
      }),
    );
    expect(result.rateBreakdown).toEqual([
      {
        start_date: "2026-02-01",
        end_date: "2026-02-14",
        days: 14,
        rate: 2800,
        amount: 1400,
        eligibility_id: 14998,
        master_rate_id: 9001,
        group_no: 1,
        item_no: 2,
        sub_item_no: 3,
      },
      {
        start_date: "2026-02-15",
        end_date: "2026-02-28",
        days: 14,
        rate: 1500,
        amount: 750,
        eligibility_id: 15556,
        master_rate_id: 9002,
        group_no: 4,
        item_no: 5,
        sub_item_no: 6,
      },
    ]);
    expect(release).toHaveBeenCalled();
  });

  test("throws forbidden when payout period is not visible for role", async () => {
    (PayrollRepository.findPayoutDetailById as jest.Mock).mockResolvedValue({
      payout_id: 88,
      period_id: 9,
      period_status: "OPEN",
      citizen_id: "1111111111111",
      period_month: 2,
      period_year: 2026,
    });
    (PayrollWorkflowService.canRoleViewPeriod as jest.Mock).mockReturnValue(false);

    await expect(
      PayrollPayoutService.getPayoutDetail(88, "HEAD_HR"),
    ).rejects.toThrow("Forbidden period access");
  });

  test("decorates payout rows with leave counts in the period", async () => {
    (PayrollRepository.findPayoutsByPeriod as jest.Mock).mockResolvedValue([
      { payout_id: 1, citizen_id: "1111111111111" },
      { payout_id: 2, citizen_id: "2222222222222" },
    ]);
    (PayrollRepository.findPeriodById as jest.Mock).mockResolvedValue({
      period_id: 7,
      period_month: 3,
      period_year: 2026,
    });
    const release = jest.fn();
    (PayrollRepository.getConnection as jest.Mock).mockResolvedValue({ release });
    (PayrollQueryRepository.fetchBatchData as jest.Mock).mockResolvedValue({
      leaveRows: [
        {
          citizen_id: "1111111111111",
          leave_type: "personal",
        },
        {
          citizen_id: "1111111111111",
          leave_type: "education",
        },
      ],
      quotaRows: [],
      noSalaryRows: [],
      returnReportRows: [],
    });

    const result = await PayrollPayoutService.getPeriodPayouts(7);

    expect(result).toEqual([
      {
        payout_id: 1,
        citizen_id: "1111111111111",
        leave_count_in_period: 2,
        education_leave_count_in_period: 1,
      },
      {
        payout_id: 2,
        citizen_id: "2222222222222",
        leave_count_in_period: 0,
        education_leave_count_in_period: 0,
      },
    ]);
    expect(release).toHaveBeenCalled();
  });

  test("filters searched payouts by role visibility", async () => {
    (PayrollRepository.searchPayouts as jest.Mock).mockResolvedValue([
      { payout_id: 1, period_status: "OPEN", citizen_id: "111" },
      { payout_id: 2, period_status: "WAITING_HR", citizen_id: "222" },
    ]);
    (PayrollWorkflowService.canRoleViewPeriod as jest.Mock).mockImplementation(
      (role: string | null | undefined, status: string) =>
        !(role === "HEAD_HR" && status === "OPEN"),
    );

    const result = await PayrollPayoutService.searchPayouts({
      q: "test",
      role: "HEAD_HR",
    });

    expect(result).toEqual([{ payout_id: 2, citizen_id: "222" }]);
  });

  test("enriches legacy eligibility evidence with group/item/sub-item from rate metadata", async () => {
    (PayrollRepository.findPayoutDetailById as jest.Mock).mockResolvedValue({
      payout_id: 99,
      citizen_id: "1600100184751",
      period_month: 3,
      period_year: 2026,
      pts_rate_snapshot: 15000,
      period_status: "OPEN",
    });
    (PayrollRepository.findPayoutItemsByPayoutId as jest.Mock).mockResolvedValue([]);
    (PayrollRepository.findPayoutChecksByPayoutId as jest.Mock).mockResolvedValue([
      {
        check_id: 1,
        code: "ELIGIBILITY_GAP",
        severity: "WARNING",
        title: "test",
        evidence_json: JSON.stringify([
          {
            type: "eligibility",
            rate: 10000,
            rate_id: 17,
            effective_date: "2026-03-01",
            expiry_date: "2026-03-09",
          },
        ]),
      },
    ]);
    (PayrollRepository.findPaymentRatesByIds as jest.Mock).mockResolvedValue([
      { rate_id: 17, group_no: 2, item_no: "2.1", sub_item_no: null },
    ]);
    (PayrollRepository.findHolidayDatesInRange as jest.Mock).mockResolvedValue([]);
    const release = jest.fn();
    (PayrollRepository.getConnection as jest.Mock).mockResolvedValue({ release });
    (PayrollQueryRepository.fetchBatchData as jest.Mock).mockResolvedValue({
      eligibilityRows: [],
      leaveRows: [],
      quotaRows: [],
      noSalaryRows: [],
      returnReportRows: [],
      movementRows: [],
    });

    const result = await PayrollPayoutService.getPayoutDetail(99, "PTS_OFFICER");

    expect(result.checks[0].evidence).toEqual([
      expect.objectContaining({
        type: "eligibility",
        rate_id: 17,
        group_no: 2,
        item_no: "2.1",
        sub_item_no: null,
      }),
    ]);
  });

  test("overrides stale eligibility group/item/sub-item with current rate metadata", async () => {
    (PayrollRepository.findPayoutDetailById as jest.Mock).mockResolvedValue({
      payout_id: 100,
      citizen_id: "1600100184751",
      period_month: 3,
      period_year: 2026,
      pts_rate_snapshot: 15000,
      period_status: "OPEN",
    });
    (PayrollRepository.findPayoutItemsByPayoutId as jest.Mock).mockResolvedValue([]);
    (PayrollRepository.findPayoutChecksByPayoutId as jest.Mock).mockResolvedValue([
      {
        check_id: 1,
        code: "ELIGIBILITY_GAP",
        severity: "WARNING",
        title: "test",
        evidence_json: JSON.stringify([
          {
            type: "eligibility",
            rate: 10000,
            rate_id: 17,
            group_no: 2,
            item_no: "2.1",
            sub_item_no: null,
            effective_date: "2026-03-01",
            expiry_date: "2026-03-09",
          },
        ]),
      },
    ]);
    (PayrollRepository.findPaymentRatesByIds as jest.Mock).mockResolvedValue([
      { rate_id: 17, group_no: 1, item_no: "1.1", sub_item_no: null },
    ]);
    (PayrollRepository.findHolidayDatesInRange as jest.Mock).mockResolvedValue([]);
    const release = jest.fn();
    (PayrollRepository.getConnection as jest.Mock).mockResolvedValue({ release });
    (PayrollQueryRepository.fetchBatchData as jest.Mock).mockResolvedValue({
      eligibilityRows: [],
      leaveRows: [],
      quotaRows: [],
      noSalaryRows: [],
      returnReportRows: [],
      movementRows: [],
    });

    const result = await PayrollPayoutService.getPayoutDetail(100, "PTS_OFFICER");

    expect(result.checks[0].evidence).toEqual([
      expect.objectContaining({
        type: "eligibility",
        rate_id: 17,
        group_no: 1,
        item_no: "1.1",
        sub_item_no: null,
      }),
    ]);
  });
});
