import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository";

test("leave rows query uses date overlap instead of fiscal year", () => {
  const query = PayrollRepository.buildLeaveRowsQuery("?,?");

  expect(query).toContain("COALESCE(ext.document_start_date, lr.start_date) <= ?");
  expect(query).toContain("COALESCE(ext.document_end_date, lr.end_date) >= ?");
  expect(query).not.toContain("lr.fiscal_year");
});

test("list periods query includes creator name join", () => {
  const query = PayrollRepository.buildListPeriodsQuery();

  expect(query).toContain("created_by");
  expect(query).toContain("created_by_name");
  expect(query).toContain("LEFT JOIN users");
  expect(query).toContain("LEFT JOIN emp_profiles");
});
