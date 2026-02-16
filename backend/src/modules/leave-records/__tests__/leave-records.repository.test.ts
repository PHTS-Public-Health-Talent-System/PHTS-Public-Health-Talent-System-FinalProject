import { describe, expect, test, jest } from "@jest/globals";

jest.mock("@/config/database.js", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
    query: jest.fn(),
  },
}));

import db from "@/config/database.js";
import { LeaveRecordsRepository } from "../repositories/leave-records.repository";

describe("LeaveRecordsRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.execute as jest.Mock).mockResolvedValue([{ insertId: 1, affectedRows: 1 }, []]);
  });

  test("upsertExtension uses insert on duplicate", async () => {
    const repo = new LeaveRecordsRepository();
    await repo.upsertExtension({
      leave_record_id: 1,
      document_start_date: "2026-02-01",
      document_end_date: "2026-02-10",
      require_return_report: 1,
      return_report_status: "PENDING",
      return_date: null,
      return_remark: null,
      pay_exception: 0,
      is_no_pay: 0,
      pay_exception_reason: null,
      study_institution: null,
      study_program: null,
      study_major: null,
      study_start_date: null,
      study_note: null,
      note: null,
      created_by: 1,
      updated_by: 1,
    });

    const call = (db.execute as jest.Mock).mock.calls[0];
    const sql = call[0] as string;
    expect(sql).toContain("INSERT INTO leave_record_extensions");
    expect(sql).toContain("ON DUPLICATE KEY UPDATE");
    expect(sql).not.toContain("local_status");
  });

  test("insertDocument stores metadata", async () => {
    const repo = new LeaveRecordsRepository();
    await repo.insertDocument({
      leave_record_id: 1,
      file_name: "doc.pdf",
      file_type: "application/pdf",
      file_size: 100,
      file_path: "uploads/documents/doc.pdf",
      uploaded_by: 2,
    });

    const call = (db.execute as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("INSERT INTO leave_record_documents");
  });

  test("deleteExtension removes extension row", async () => {
    const repo = new LeaveRecordsRepository();
    await repo.deleteExtension(10);

    const call = (db.execute as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("DELETE FROM leave_record_extensions");
  });

  test("listLeaveRowsForQuota selects leave records with extensions", async () => {
    (db.query as jest.Mock).mockResolvedValue([[], []]);
    const repo = new LeaveRecordsRepository();
    await repo.listLeaveRowsForQuota("123", 2026);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM leave_records lr");
    expect(sql).toContain("LEFT JOIN leave_record_extensions ext");
    expect(sql).toContain("lr.citizen_id = ?");
    expect(sql).toContain("lr.fiscal_year = ?");
  });

  test("listLeaveRecords applies search tokens across profile fields", async () => {
    (db.query as jest.Mock).mockResolvedValue([[], []]);
    const repo = new LeaveRecordsRepository();
    await repo.listLeaveRecords({ search: "สมชาย 1100" } as any);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    const values = call[1] as unknown[];
    expect(sql).not.toContain("local_status");
    expect(sql).toContain("LOWER(lr.citizen_id)");
    expect(sql).toContain("COALESCE(ep.first_name, ss.first_name");
    expect(values).toEqual(expect.arrayContaining(["%สมชาย%", "%1100%"]));
  });

  test("insertLeaveRecord stores core fields", async () => {
    const repo = new LeaveRecordsRepository();
    await repo.insertLeaveRecord({
      citizen_id: "123",
      leave_type: "personal",
      start_date: "2026-02-01",
      end_date: "2026-02-03",
      duration_days: 3,
      fiscal_year: 2569,
      remark: "manual",
    });

    const call = (db.execute as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("INSERT INTO leave_records");
    expect(sql).toContain("fiscal_year");
  });

  test("countLeaveRecords joins employee tables when searching", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ total: 0 }], []]);
    const repo = new LeaveRecordsRepository();
    await repo.countLeaveRecords({ search: "test" } as any);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("LEFT JOIN emp_profiles");
    expect(sql).toContain("LEFT JOIN emp_support_staff");
  });

  test("findQuotaRow selects leave_quotas by citizen and fiscal year", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ quota_vacation: 10 }], []]);
    const repo = new LeaveRecordsRepository();
    await repo.findQuotaRow("123", 2026);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM leave_quotas");
    expect(sql).toContain("citizen_id = ?");
    expect(sql).toContain("fiscal_year = ?");
  });

  test("findHolidaysForFiscalYear selects active holidays within range", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ holiday_date: "2026-01-01" }], []]);
    const repo = new LeaveRecordsRepository();
    await repo.findHolidaysForFiscalYear(2026);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM cfg_holidays");
    expect(sql).toContain("holiday_date BETWEEN");
    expect(sql).toContain("is_active = 1");
  });

  test("findEmployeeServiceDates selects start_work_date and first_entry_date", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ start_work_date: "2020-01-01" }], []]);
    const repo = new LeaveRecordsRepository();
    await repo.findEmployeeServiceDates("123");

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM emp_profiles");
    expect(sql).toContain("start_work_date");
    expect(sql).toContain("first_entry_date");
  });
});
