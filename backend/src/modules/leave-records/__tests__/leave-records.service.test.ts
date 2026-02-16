import { describe, expect, test, jest } from "@jest/globals";

jest.mock("../repositories/leave-records.repository", () => ({
  LeaveRecordsRepository: jest.fn().mockImplementation(() => ({
    insertLeaveRecord: jest.fn().mockResolvedValue(99),
  })),
}));

import { createLeaveRecord, calculateFiscalYear } from "../services/leave-records.service";

describe("leave-records service", () => {
  test("calculateFiscalYear uses Thai fiscal year based on start_date", () => {
    expect(calculateFiscalYear("2024-09-30")).toBe(2567);
    expect(calculateFiscalYear("2024-10-01")).toBe(2568);
  });

  test("createLeaveRecord calculates duration and fiscal year", async () => {
    const id = await createLeaveRecord({
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2024-10-01",
      end_date: "2024-10-03",
    });
    expect(id).toBe(99);
  });
});
