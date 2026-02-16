import { describe, expect, test } from "@jest/globals";
import { createLeaveRecordSchema, upsertLeaveRecordExtensionSchema } from "../leave-records.schema";

describe("leave-records schema", () => {
  test("upsert requires leave_record_id", () => {
    expect(() => upsertLeaveRecordExtensionSchema.parse({ body: {} })).toThrow();
  });

  test("upsert accepts optional fields", () => {
    const payload = {
      leave_record_id: 10,
      document_start_date: "2026-02-01",
      document_end_date: "2026-02-10",
      require_return_report: true,
      return_report_status: "PENDING",
      pay_exception: false,
      is_no_pay: false,
      study_institution: "Uni",
    };
    const parsed = upsertLeaveRecordExtensionSchema.parse({ body: payload });
    expect(parsed.body.leave_record_id).toBe(10);
  });

  test("upsert rejects local_status field", () => {
    const payload = {
      leave_record_id: 10,
      local_status: "approved",
    };
    expect(() => upsertLeaveRecordExtensionSchema.parse({ body: payload })).toThrow();
  });

  test("createLeaveRecord requires core fields", () => {
    expect(() => createLeaveRecordSchema.parse({ body: {} })).toThrow();
  });

  test("createLeaveRecord accepts required payload", () => {
    const payload = {
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2026-02-01",
      end_date: "2026-02-03",
    };
    const parsed = createLeaveRecordSchema.parse({ body: payload });
    expect(parsed.body.citizen_id).toBe("123");
  });

  test("createLeaveRecord rejects end_date before start_date", () => {
    const payload = {
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2026-02-16",
      end_date: "2026-02-01",
    };
    expect(() => createLeaveRecordSchema.parse({ body: payload })).toThrow();
  });

  test("upsert rejects document dates when only one side provided", () => {
    const payload = {
      leave_record_id: 10,
      document_start_date: "2026-02-01",
    };
    expect(() => upsertLeaveRecordExtensionSchema.parse({ body: payload })).toThrow();
  });

  test("upsert rejects document_end_date before document_start_date", () => {
    const payload = {
      leave_record_id: 10,
      document_start_date: "2026-02-16",
      document_end_date: "2026-02-01",
    };
    expect(() => upsertLeaveRecordExtensionSchema.parse({ body: payload })).toThrow();
  });
});
