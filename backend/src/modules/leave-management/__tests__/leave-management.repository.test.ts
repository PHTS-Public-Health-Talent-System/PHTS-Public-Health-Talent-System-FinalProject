import { describe, expect, test, jest } from "@jest/globals";

jest.mock("@/config/database.js", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
  },
}));

import db from "@/config/database.js";
import { LeaveManagementRepository } from "../repositories/leave-management.repository";

describe("LeaveManagementRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.execute as jest.Mock).mockResolvedValue([{ insertId: 1, affectedRows: 1 }, []]);
    (db.getConnection as jest.Mock).mockResolvedValue({
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }, []]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    });
  });

  test("upsertExtension uses insert on duplicate", async () => {
    const repo = new LeaveManagementRepository();
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
    const repo = new LeaveManagementRepository();
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
    const repo = new LeaveManagementRepository();
    await repo.deleteExtension(10);

    const call = (db.execute as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("DELETE FROM leave_record_extensions");
  });

  test("listLeaveManagementRowsForQuota selects leave records with extensions", async () => {
    (db.query as jest.Mock).mockResolvedValue([[], []]);
    const repo = new LeaveManagementRepository();
    await repo.listLeaveManagementRowsForQuota("123", 2026);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM leave_records lr");
    expect(sql).toContain("LEFT JOIN leave_record_extensions ext");
    expect(sql).toContain("lr.citizen_id = ?");
    expect(sql).toContain("lr.fiscal_year = ?");
  });

  test("listLeaveManagement applies search tokens across profile fields", async () => {
    (db.query as jest.Mock).mockResolvedValue([[], []]);
    const repo = new LeaveManagementRepository();
    await repo.listLeaveManagement({ search: "สมชาย 1100" } as any);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    const values = call[1] as unknown[];
    expect(sql).not.toContain("local_status");
    expect(sql).toContain("LOWER(lr.citizen_id)");
    expect(sql).toContain("COALESCE(ep.first_name, ss.first_name");
    expect(values).toEqual(expect.arrayContaining(["%สมชาย%", "%1100%"]));
  });

  test("insertLeaveManagement stores core fields", async () => {
    const repo = new LeaveManagementRepository();
    await repo.insertLeaveManagement({
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

  test("countLeaveManagement joins employee tables when searching", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ total: 0 }], []]);
    const repo = new LeaveManagementRepository();
    await repo.countLeaveManagement({ search: "test" } as any);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("LEFT JOIN emp_profiles");
    expect(sql).toContain("LEFT JOIN emp_support_staff");
  });

  test("findQuotaRow selects leave_quotas by citizen and fiscal year", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ quota_vacation: 10 }], []]);
    const repo = new LeaveManagementRepository();
    await repo.findQuotaRow("123", 2026);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM leave_quotas");
    expect(sql).toContain("citizen_id = ?");
    expect(sql).toContain("fiscal_year = ?");
  });

  test("findHolidaysForFiscalYear selects active holidays within range", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ holiday_date: "2026-01-01" }], []]);
    const repo = new LeaveManagementRepository();
    await repo.findHolidaysForFiscalYear(2026);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM cfg_holidays");
    expect(sql).toContain("holiday_date BETWEEN");
    expect(sql).toContain("is_active = 1");
  });

  test("findEmployeeServiceDates selects start_work_date and first_entry_date", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ start_work_date: "2020-01-01" }], []]);
    const repo = new LeaveManagementRepository();
    await repo.findEmployeeServiceDates("123");

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    expect(sql).toContain("FROM emp_profiles");
    expect(sql).toContain("start_work_date");
    expect(sql).toContain("first_entry_date");
  });

  test("listLeaveReturnReportEventsByLeaveIds reads event rows when table exists", async () => {
    (db.query as jest.Mock).mockResolvedValue([
      [{ event_id: 1, leave_record_id: 11, report_date: "2026-01-31", resume_date: "2026-02-15" }],
      [],
    ]);
    const repo = new LeaveManagementRepository();
    const rows = await repo.listLeaveReturnReportEventsByLeaveIds([11, 12, 11]);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    const sql = call[0] as string;
    const params = call[1] as unknown[];
    expect(sql).toContain("FROM leave_return_report_events");
    expect(sql).toContain("leave_record_id IN (?,?)");
    expect(params).toEqual([11, 12]);
    expect(rows).toHaveLength(1);
  });

  test("listLeaveReturnReportEventsByLeaveIds returns empty when table is missing", async () => {
    (db.query as jest.Mock).mockRejectedValue({ code: "ER_NO_SUCH_TABLE" });
    const repo = new LeaveManagementRepository();
    const rows = await repo.listLeaveReturnReportEventsByLeaveIds([11]);

    expect(rows).toEqual([]);
  });

  test("replaceLeaveReturnReportEvents replaces rows in transaction", async () => {
    const repo = new LeaveManagementRepository();
    await repo.replaceLeaveReturnReportEvents(
      10,
      [
        { report_date: "2026-01-31", resume_date: "2026-02-15", resume_study_program: "B" },
        { report_date: "2026-03-07", resume_date: "2026-03-17", resume_study_program: "A" },
      ],
      7,
    );

    const conn = await (db.getConnection as jest.Mock).mock.results[0].value;
    expect(conn.beginTransaction).toHaveBeenCalled();
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM leave_return_report_events"),
      [10],
    );
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO leave_return_report_events"),
      [10, "2026-01-31", "2026-02-15", "B", 7],
    );
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  test("findExtensionReturnMeta selects require_return_report", async () => {
    (db.query as jest.Mock).mockResolvedValue([[{ require_return_report: 1 }], []]);
    const repo = new LeaveManagementRepository();
    const row = await repo.findExtensionReturnMeta(10);

    const call = (db.query as jest.Mock).mock.calls.at(-1);
    expect((call[0] as string)).toContain("FROM leave_record_extensions");
    expect(row).toEqual({ require_return_report: 1 });
  });

  test("upsertLegacyReturnReportCompat updates return status/date", async () => {
    const repo = new LeaveManagementRepository();
    await repo.upsertLegacyReturnReportCompat(10, {
      require_return_report: 1,
      return_report_status: "DONE",
      return_date: "2026-01-31",
      actor_id: 7,
    });

    const call = (db.execute as jest.Mock).mock.calls.at(-1);
    expect((call[0] as string)).toContain("INSERT INTO leave_record_extensions");
    expect(call[1]).toEqual([10, 1, "DONE", "2026-01-31", 7, 7]);
  });
});
