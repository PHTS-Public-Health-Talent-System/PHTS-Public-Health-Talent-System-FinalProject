import { describe, expect, test, jest } from "@jest/globals";

const mockRepo = {
  listLeaveRowsForQuota: jest.fn(),
  findQuotaRow: jest.fn(),
  findHolidaysForFiscalYear: jest.fn(),
  findEmployeeServiceDates: jest.fn(),
};

jest.mock("../repositories/leave-records.repository", () => ({
  LeaveRecordsRepository: jest.fn().mockImplementation(() => mockRepo),
}));

import { getLeaveQuotaStatus } from "../services/leave-domain.service";

const baseLeaveRows = [
  {
    id: 1,
    citizen_id: "123",
    leave_type: "personal",
    start_date: "2026-11-02",
    end_date: "2026-11-23",
    document_start_date: null,
    document_end_date: null,
    is_no_pay: 0,
    pay_exception: 0,
  },
];

describe("getLeaveQuotaStatus", () => {
  test("uses repository data and caches results", async () => {
    mockRepo.listLeaveRowsForQuota.mockResolvedValue(baseLeaveRows);
    mockRepo.findQuotaRow.mockResolvedValue({ quota_vacation: 10, quota_personal: 45, quota_sick: 60 });
    mockRepo.findHolidaysForFiscalYear.mockResolvedValue([]);
    mockRepo.findEmployeeServiceDates.mockResolvedValue({ start_work_date: "2026-10-10", first_entry_date: null });

    const result1 = await getLeaveQuotaStatus("123", 2027);
    const result2 = await getLeaveQuotaStatus("123", 2027);

    expect(result1.perType.personal.limit).toBe(15);
    expect(result1.perType.personal.overQuota).toBe(true);
    expect(result2.perType.personal.overQuota).toBe(true);

    expect(mockRepo.listLeaveRowsForQuota).toHaveBeenCalledTimes(1);
    expect(mockRepo.findQuotaRow).toHaveBeenCalledTimes(1);
    expect(mockRepo.findHolidaysForFiscalYear).toHaveBeenCalledTimes(1);
    expect(mockRepo.findEmployeeServiceDates).toHaveBeenCalledTimes(1);
  });
});
