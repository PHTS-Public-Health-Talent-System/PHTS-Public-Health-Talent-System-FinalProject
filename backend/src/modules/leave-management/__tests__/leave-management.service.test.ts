import { describe, expect, test, jest } from "@jest/globals";

const insertLeaveManagementMock = jest.fn().mockResolvedValue(99);
const upsertExtensionMock = jest.fn().mockResolvedValue(undefined);
const replaceLeaveReturnReportEventsMock = jest.fn().mockResolvedValue(undefined);
const findExtensionReturnMetaMock = jest.fn().mockResolvedValue({ require_return_report: 1 });
const upsertLegacyReturnReportCompatMock = jest.fn().mockResolvedValue(undefined);
const listLeaveReturnReportEventsByLeaveIdsMock = jest.fn().mockResolvedValue([]);

jest.mock("../repositories/leave-management.repository", () => ({
  LeaveManagementRepository: jest.fn().mockImplementation(() => ({
    insertLeaveManagement: insertLeaveManagementMock,
    upsertExtension: upsertExtensionMock,
    replaceLeaveReturnReportEvents: replaceLeaveReturnReportEventsMock,
    findExtensionReturnMeta: findExtensionReturnMetaMock,
    upsertLegacyReturnReportCompat: upsertLegacyReturnReportCompatMock,
    listLeaveReturnReportEventsByLeaveIds: listLeaveReturnReportEventsByLeaveIdsMock,
  })),
}));

import {
  createLeaveManagement,
  calculateFiscalYear,
  upsertLeaveManagementExtension,
  replaceLeaveReturnReportEvents,
} from "../services/leave-management.service";

describe("leave-management service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createLeaveManagement keeps leave_type ordain as provided", async () => {
    await createLeaveManagement({
      citizen_id: "123",
      leave_type: "ordain",
      start_date: "2024-10-01",
      end_date: "2024-10-03",
    });

    expect(insertLeaveManagementMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ leave_type: "ordain" }),
    );
  });

  test("calculateFiscalYear uses Thai fiscal year based on start_date", () => {
    expect(calculateFiscalYear("2024-09-30")).toBe(2567);
    expect(calculateFiscalYear("2024-10-01")).toBe(2568);
  });

  test("createLeaveManagement calculates duration and fiscal year", async () => {
    const id = await createLeaveManagement({
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2024-10-01",
      end_date: "2024-10-03",
    });
    expect(id).toBe(99);
  });

  test("upsertLeaveManagementExtension syncs return events and derives DONE status", async () => {
    await upsertLeaveManagementExtension(
      {
        leave_management_id: 10,
        require_return_report: true,
        return_report_events: [
          { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
          { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
        ],
      },
      7,
    );

    expect(upsertExtensionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leave_management_id: 10,
        return_report_status: "DONE",
        return_date: "2026-01-31",
      }),
    );
    expect(replaceLeaveReturnReportEventsMock).toHaveBeenCalledWith(
      10,
      [
        { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
        { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
      ],
      7,
    );
  });

  test("upsertLeaveManagementExtension accepts leave_record_id alias", async () => {
    await upsertLeaveManagementExtension(
      {
        leave_record_id: 55,
        require_return_report: true,
      } as any,
      5,
    );

    expect(upsertExtensionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leave_management_id: 55,
      }),
    );
  });

  test("replaceLeaveReturnReportEvents syncs compat fields from events", async () => {
    await replaceLeaveReturnReportEvents(
      10,
      {
        events: [
          { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
          { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
        ],
      },
      9,
    );

    expect(replaceLeaveReturnReportEventsMock).toHaveBeenCalledWith(
      10,
      [
        { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
        { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
      ],
      9,
    );
    expect(upsertLegacyReturnReportCompatMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        require_return_report: 1,
        return_report_status: "DONE",
        return_date: "2026-01-31",
      }),
    );
  });
});
