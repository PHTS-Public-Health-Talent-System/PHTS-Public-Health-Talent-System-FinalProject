import { PayrollPeriodLeaveService } from "@/modules/payroll/services/facade/payroll-period-leave.service.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";

const listLeaveManagementByPeriod = jest.fn();
const countLeaveManagementByPeriod = jest.fn();
const summarizeLeaveManagementByProfessionByPeriod = jest.fn();

jest.mock("@/modules/payroll/repositories/payroll.repository.js", () => ({
  PayrollRepository: {
    findPeriodById: jest.fn(),
    getConnection: jest.fn(),
    findPeriodItemCitizenIds: jest.fn(),
    findPayoutsByPeriod: jest.fn(),
  },
}));

jest.mock("@/modules/leave-management/repositories/leave-management.repository.js", () => ({
  LeaveManagementRepository: jest.fn().mockImplementation(() => ({
    listLeaveManagementByPeriod,
    countLeaveManagementByPeriod,
    summarizeLeaveManagementByProfessionByPeriod,
  })),
}));

describe("PayrollPeriodLeaveService", () => {
  const release = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    release.mockReset();
    (PayrollRepository.getConnection as jest.Mock).mockResolvedValue({
      release,
    });
  });

  test("lists leave rows by payroll period range", async () => {
    (PayrollRepository.findPeriodById as jest.Mock).mockResolvedValue({
      period_id: 9,
      period_month: 3,
      period_year: 2026,
    });
    (PayrollRepository.findPeriodItemCitizenIds as jest.Mock).mockResolvedValue([
      "1111111111111",
      "2222222222222",
    ]);
    (PayrollRepository.findPayoutsByPeriod as jest.Mock).mockResolvedValue([
      { citizen_id: "1111111111111" },
      { citizen_id: "2222222222222" },
    ]);
    listLeaveManagementByPeriod.mockResolvedValue([{ id: 1 }] as any);
    countLeaveManagementByPeriod.mockResolvedValue(1);

    const result = await PayrollPeriodLeaveService.listPeriodLeaves(9, {
      profession_code: "NURSE",
      limit: 50,
      offset: 0,
      sort_by: "start_date",
      sort_dir: "desc",
    });

    expect(listLeaveManagementByPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: "2026-03-01",
        end_date: "2026-03-31",
        profession_code: "NURSE",
        citizen_ids: ["1111111111111", "2222222222222"],
      }),
    );
    expect(PayrollRepository.findPeriodItemCitizenIds).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(result.total).toBe(1);
  });

  test("summarizes leave rows by profession in the payroll period", async () => {
    (PayrollRepository.findPeriodById as jest.Mock).mockResolvedValue({
      period_id: 9,
      period_month: 2,
      period_year: 2569,
    });
    (PayrollRepository.findPeriodItemCitizenIds as jest.Mock).mockResolvedValue([
      "1600100184751",
    ]);
    (PayrollRepository.findPayoutsByPeriod as jest.Mock).mockResolvedValue([
      { citizen_id: "1600100184751" },
    ]);
    summarizeLeaveManagementByProfessionByPeriod.mockResolvedValue([
      { profession_code: "NURSE", profession_name: "พยาบาล", leave_count: 3 },
    ] as any);

    const result = await PayrollPeriodLeaveService.summarizePeriodLeavesByProfession(9, {
      search: "พยาบาล",
    });

    expect(summarizeLeaveManagementByProfessionByPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        search: "พยาบาล",
        citizen_ids: ["1600100184751"],
      }),
    );
    expect(result).toEqual([
      { profession_code: "NURSE", profession_name: "พยาบาล", leave_count: 3 },
    ]);
  });

  test("returns empty result when no payroll citizen exists in that period", async () => {
    (PayrollRepository.findPeriodById as jest.Mock).mockResolvedValue({
      period_id: 33,
      period_month: 3,
      period_year: 2026,
    });
    (PayrollRepository.findPayoutsByPeriod as jest.Mock).mockResolvedValue([]);
    (PayrollRepository.findPeriodItemCitizenIds as jest.Mock).mockResolvedValue([]);

    const listResult = await PayrollPeriodLeaveService.listPeriodLeaves(33, {});
    const summaryResult = await PayrollPeriodLeaveService.summarizePeriodLeavesByProfession(33, {});

    expect(listResult).toEqual({
      items: [],
      total: 0,
      limit: null,
      offset: 0,
      period_start: "2026-03-01",
      period_end: "2026-03-31",
    });
    expect(summaryResult).toEqual([]);
    expect(listLeaveManagementByPeriod).not.toHaveBeenCalled();
    expect(countLeaveManagementByPeriod).not.toHaveBeenCalled();
    expect(summarizeLeaveManagementByProfessionByPeriod).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  test("falls back to period items when payout rows do not exist yet", async () => {
    (PayrollRepository.findPeriodById as jest.Mock).mockResolvedValue({
      period_id: 11,
      period_month: 4,
      period_year: 2026,
    });
    (PayrollRepository.findPayoutsByPeriod as jest.Mock).mockResolvedValue([]);
    (PayrollRepository.findPeriodItemCitizenIds as jest.Mock).mockResolvedValue([
      "9999999999999",
    ]);
    listLeaveManagementByPeriod.mockResolvedValue([{ id: 7 }] as any);
    countLeaveManagementByPeriod.mockResolvedValue(1);

    const result = await PayrollPeriodLeaveService.listPeriodLeaves(11, {});

    expect(listLeaveManagementByPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        citizen_ids: ["9999999999999"],
        start_date: "2026-04-01",
        end_date: "2026-04-30",
      }),
    );
    expect(PayrollRepository.findPeriodItemCitizenIds).toHaveBeenCalledWith(
      11,
      expect.any(Object),
    );
    expect(release).toHaveBeenCalled();
    expect(result.total).toBe(1);
  });
});
