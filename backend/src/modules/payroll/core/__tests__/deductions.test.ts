import { calculateDeductions, LeaveRow } from '@/modules/payroll/core/deductions.js';

describe("payroll core deductions", () => {
  const monthStart = new Date("2026-02-01");
  const monthEnd = new Date("2026-02-28");

  test("returns empty map when no leaves", () => {
    const map = calculateDeductions(
      [],
      {},
      [],
      monthStart,
      monthEnd,
    );
    expect(map.size).toBe(0);
  });

  test("applies no-pay leave deductions for each day", () => {
    const leaves: LeaveRow[] = [
      {
        leave_type: "sick",
        start_date: "2026-02-02",
        end_date: "2026-02-03",
        duration_days: 2,
        is_no_pay: 1,
      },
    ];
    const map = calculateDeductions(
      leaves,
      {},
      [],
      monthStart,
      monthEnd,
    );
    expect(map.get("2026-02-02")).toBe(1);
    expect(map.get("2026-02-03")).toBe(1);
    expect(map.size).toBe(2);
  });

  test("ordain leave with <1 year service applies deduction from day 1", () => {
    const leaves: LeaveRow[] = [
      {
        leave_type: "ordain",
        start_date: "2026-02-01",
        end_date: "2026-02-03",
        duration_days: 3,
      },
    ];
    const serviceStart = new Date("2025-12-01");
    const map = calculateDeductions(
      leaves,
      {},
      [],
      monthStart,
      monthEnd,
      serviceStart,
    );
    expect(map.get("2026-02-01")).toBe(1);
    expect(map.get("2026-02-02")).toBe(1);
    expect(map.get("2026-02-03")).toBe(1);
    expect(map.size).toBe(3);
  });
});
