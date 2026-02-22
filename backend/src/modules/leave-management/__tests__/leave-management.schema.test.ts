import { describe, expect, test } from "@jest/globals";
import {
  createLeaveManagementSchema,
  upsertLeaveManagementExtensionSchema,
  replaceLeaveReturnEventsSchema,
} from "../leave-management.schema";

describe("leave-management schema", () => {
  test("upsert requires leave_management_id or leave_record_id", () => {
    expect(() => upsertLeaveManagementExtensionSchema.parse({ body: {} })).toThrow();
  });

  test("upsert accepts leave_record_id alias", () => {
    const payload = {
      leave_record_id: 10,
      note: "legacy-client",
    };
    const parsed = upsertLeaveManagementExtensionSchema.parse({ body: payload });
    expect(parsed.body.leave_record_id).toBe(10);
  });

  test("upsert accepts optional fields", () => {
    const payload = {
      leave_management_id: 10,
      document_start_date: "2026-02-01",
      document_end_date: "2026-02-10",
      require_return_report: true,
      return_report_status: "PENDING",
      pay_exception: false,
      is_no_pay: false,
      study_institution: "Uni",
    };
    const parsed = upsertLeaveManagementExtensionSchema.parse({ body: payload });
    expect(parsed.body.leave_management_id).toBe(10);
  });

  test("upsert rejects local_status field", () => {
    const payload = {
      leave_management_id: 10,
      local_status: "approved",
    };
    expect(() => upsertLeaveManagementExtensionSchema.parse({ body: payload })).toThrow();
  });

  test("createLeaveManagement requires core fields", () => {
    expect(() => createLeaveManagementSchema.parse({ body: {} })).toThrow();
  });

  test("createLeaveManagement accepts required payload", () => {
    const payload = {
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2026-02-01",
      end_date: "2026-02-03",
    };
    const parsed = createLeaveManagementSchema.parse({ body: payload });
    expect(parsed.body.citizen_id).toBe("123");
  });

  test("createLeaveManagement rejects end_date before start_date", () => {
    const payload = {
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2026-02-16",
      end_date: "2026-02-01",
    };
    expect(() => createLeaveManagementSchema.parse({ body: payload })).toThrow();
  });

  test("createLeaveManagement rejects unsupported leave_type", () => {
    const payload = {
      citizen_id: "123",
      leave_type: "hajj",
      start_date: "2026-02-01",
      end_date: "2026-02-03",
    };
    expect(() => createLeaveManagementSchema.parse({ body: payload })).toThrow();
  });

  test("upsert rejects document dates when only one side provided", () => {
    const payload = {
      leave_management_id: 10,
      document_start_date: "2026-02-01",
    };
    expect(() => upsertLeaveManagementExtensionSchema.parse({ body: payload })).toThrow();
  });

  test("upsert rejects document_end_date before document_start_date", () => {
    const payload = {
      leave_management_id: 10,
      document_start_date: "2026-02-16",
      document_end_date: "2026-02-01",
    };
    expect(() => upsertLeaveManagementExtensionSchema.parse({ body: payload })).toThrow();
  });

  test("upsert accepts ordered return_report_events", () => {
    const payload = {
      leave_management_id: 10,
      return_report_events: [
        { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
        { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
      ],
    };
    const parsed = upsertLeaveManagementExtensionSchema.parse({ body: payload });
    expect(parsed.body.return_report_events?.length).toBe(2);
  });

  test("upsert rejects return_report_events when resume_date is not after report_date", () => {
    const payload = {
      leave_management_id: 10,
      return_report_events: [
        { report_date: "2026-01-31", resume_date: "2026-01-31", resume_study_program: "A" },
      ],
    };
    expect(() => upsertLeaveManagementExtensionSchema.parse({ body: payload })).toThrow();
  });

  test("upsert rejects return_report_events when report_date is unsorted", () => {
    const payload = {
      leave_management_id: 10,
      return_report_events: [
        { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
        { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
      ],
    };
    expect(() => upsertLeaveManagementExtensionSchema.parse({ body: payload })).toThrow();
  });

  test("replaceLeaveReturnEventsSchema accepts sorted events payload", () => {
    const parsed = replaceLeaveReturnEventsSchema.parse({
      params: { leaveManagementId: "12" },
      body: {
        events: [
          { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
          { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
        ],
      },
    });
    expect(parsed.params.leaveManagementId).toBe(12);
    expect(parsed.body.events.length).toBe(2);
  });
});
