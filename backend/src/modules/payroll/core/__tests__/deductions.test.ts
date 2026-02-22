import {
  calculateDeductions,
  LeaveRow,
  QuotaDecision,
} from '@/modules/payroll/core/deductions.js';

describe("payroll core deductions", () => {
  const monthStart = new Date("2026-02-01");
  const monthEnd = new Date("2026-02-28");

  test("returns empty map when no leaves", () => {
    const { deductionMap: map } = calculateDeductions(
      [],
      [],
      monthStart,
      monthEnd,
      new Map<number, QuotaDecision>(),
      [],
      new Map(),
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
    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map<number, QuotaDecision>(),
      [],
      new Map(),
    );
    expect(map.get("2026-02-02")).toBe(1);
    expect(map.get("2026-02-03")).toBe(1);
    expect(map.size).toBe(2);
  });

  test("applies deduction from precomputed decision for ordain leave", () => {
    const leaves: LeaveRow[] = [
      {
        id: 11,
        leave_type: "ordain",
        start_date: "2026-02-01",
        end_date: "2026-02-03",
        duration_days: 3,
      },
    ];
    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[11, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      new Map(),
    );
    expect(map.get("2026-02-01")).toBe(1);
    expect(map.get("2026-02-02")).toBe(1);
    expect(map.get("2026-02-03")).toBe(1);
    expect(map.size).toBe(3);
  });

  test("uses document dates when provided", () => {
    const leaves: LeaveRow[] = [
      {
        id: 98,
        leave_type: "sick",
        start_date: "2026-02-01",
        end_date: "2026-02-05",
        document_start_date: "2026-02-03",
        document_end_date: "2026-02-03",
        duration_days: 5,
      },
    ];
    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([
        [98, { overQuota: true, exceedDate: new Date("2026-02-03") }],
      ]),
      [],
      new Map(),
    );
    expect(map.has("2026-02-01")).toBe(false);
    expect(map.has("2026-02-02")).toBe(false);
    expect(map.get("2026-02-03")).toBe(1);
  });

  test("uses precomputed quota decisions when provided", () => {
    const leaves: LeaveRow[] = [
      {
        id: 99,
        leave_type: "sick",
        start_date: "2026-02-01",
        end_date: "2026-02-03",
        duration_days: 3,
      },
    ];
    const quotaDecisions = new Map<number, QuotaDecision>([
      [99, { overQuota: true, exceedDate: new Date("2026-02-02") }],
    ]);
    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      quotaDecisions,
      [],
      new Map(),
    );
    expect(map.get("2026-02-01")).toBeUndefined();
    expect(map.get("2026-02-02")).toBe(1);
    expect(map.get("2026-02-03")).toBe(1);
  });

  test("throws when quota decisions are not provided for paid leave", () => {
    const leaves: LeaveRow[] = [
      {
        id: 100,
        leave_type: "sick",
        start_date: "2026-02-01",
        end_date: "2026-02-03",
        duration_days: 3,
      },
    ];

    expect(() =>
      calculateDeductions(
        leaves,
        [],
        monthStart,
        monthEnd,
        undefined as unknown as Map<number, QuotaDecision>,
        [],
        new Map(),
      ),
    ).toThrow("quota decisions required");
  });

  test("throws when leave id is missing from precomputed quota decisions", () => {
    const leaves: LeaveRow[] = [
      {
        id: 101,
        leave_type: "sick",
        start_date: "2026-02-01",
        end_date: "2026-02-03",
        duration_days: 3,
      },
    ];
    const quotaDecisions = new Map<number, QuotaDecision>();

    expect(() =>
      calculateDeductions(
        leaves,
        [],
        monthStart,
        monthEnd,
        quotaDecisions,
        [],
        new Map(),
      ),
    ).toThrow("quota decision missing for leave id=101");
  });

  test("throws when paid leave does not have leave id", () => {
    const leaves: LeaveRow[] = [
      {
        leave_type: "sick",
        start_date: "2026-02-10",
        end_date: "2026-02-10",
        duration_days: 1,
      },
    ];

    expect(() =>
      calculateDeductions(
        leaves,
        [],
        monthStart,
        monthEnd,
        new Map<number, QuotaDecision>(),
        [],
        new Map(),
      ),
    ).toThrow("paid leave requires id");
  });

  test("does not exceed 1 deduction day when no-pay sources overlap", () => {
    const leaves: LeaveRow[] = [
      {
        id: 201,
        leave_type: "sick",
        start_date: "2026-02-10",
        end_date: "2026-02-11",
        duration_days: 2,
        is_no_pay: 1,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map<number, QuotaDecision>(),
      [
        {
          leave_record_id: 201,
          leave_type: "sick",
          start_date: "2026-02-11",
          end_date: "2026-02-12",
        },
      ],
      new Map(),
    );

    expect(map.get("2026-02-10")).toBe(1);
    expect(map.get("2026-02-11")).toBe(1);
    expect(map.get("2026-02-12")).toBe(1);
    expect(map.size).toBe(3);
  });

  test("does not deduct when decision says not over quota", () => {
    const leaves: LeaveRow[] = [
      {
        id: 202,
        leave_type: "sick",
        start_date: "2026-02-03",
        end_date: "2026-02-05",
        duration_days: 3,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[202, { overQuota: false, exceedDate: null }]]),
      [],
      new Map(),
    );

    expect(map.size).toBe(0);
  });

  test("applies half-day deduction as 0.5", () => {
    const leaves: LeaveRow[] = [
      {
        id: 203,
        leave_type: "sick",
        start_date: "2026-02-03",
        end_date: "2026-02-03",
        duration_days: 1,
        document_duration_days: 0.5,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[203, { overQuota: true, exceedDate: new Date("2026-02-03") }]]),
      [],
      new Map(),
    );

    expect(map.get("2026-02-03")).toBe(0.5);
  });

  test("business-day leave skips weekend and holiday while deducting", () => {
    const leaves: LeaveRow[] = [
      {
        id: 204,
        leave_type: "sick",
        start_date: "2026-02-06",
        end_date: "2026-02-10",
        duration_days: 5,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      ["2026-02-09"],
      monthStart,
      monthEnd,
      new Map([[204, { overQuota: true, exceedDate: new Date("2026-02-06") }]]),
      [],
      new Map(),
    );

    expect(map.get("2026-02-06")).toBe(1); // Fri
    expect(map.get("2026-02-07")).toBeUndefined(); // Sat
    expect(map.get("2026-02-08")).toBeUndefined(); // Sun
    expect(map.get("2026-02-09")).toBeUndefined(); // Holiday
    expect(map.get("2026-02-10")).toBe(1); // Tue
    expect(map.size).toBe(2);
  });

  test("education leave is shortened by return report date", () => {
    const leaves: LeaveRow[] = [
      {
        id: 205,
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        duration_days: 28,
      },
    ];
    const returnReports = new Map<number, Date>([
      [205, new Date("2026-02-10")], // deduct until 2026-02-09
    ]);

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[205, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      returnReports,
    );

    expect(map.get("2026-02-09")).toBe(1);
    expect(map.get("2026-02-10")).toBeUndefined();
    expect(map.size).toBe(9);
  });

  test("ordain leave is shortened by return report date", () => {
    const leaves: LeaveRow[] = [
      {
        id: 207,
        leave_type: "ordain",
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        duration_days: 28,
      },
    ];
    const returnReports = new Map<number, Date>([
      [207, new Date("2026-02-10")], // deduct until 2026-02-09
    ]);

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[207, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      returnReports,
    );

    expect(map.get("2026-02-09")).toBe(1);
    expect(map.get("2026-02-10")).toBeUndefined();
    expect(map.size).toBe(9);
  });

  test("military leave is shortened by return report date", () => {
    const leaves: LeaveRow[] = [
      {
        id: 208,
        leave_type: "military",
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        duration_days: 28,
      },
    ];
    const returnReports = new Map<number, Date>([
      [208, new Date("2026-02-10")], // deduct until 2026-02-09
    ]);

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[208, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      returnReports,
    );

    expect(map.get("2026-02-09")).toBe(1);
    expect(map.get("2026-02-10")).toBeUndefined();
    expect(map.size).toBe(9);
  });

  test("education without return report does not extend deduction to month end", () => {
    const leaves: LeaveRow[] = [
      {
        id: 209,
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-10",
        duration_days: 10,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[209, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      new Map(),
    );

    expect(map.get("2026-02-10")).toBe(1);
    expect(map.get("2026-02-11")).toBeUndefined();
    expect(map.size).toBe(10);
  });

  test("ignores unknown leave type without throwing", () => {
    const leaves: LeaveRow[] = [
      {
        id: 206,
        leave_type: "special_unknown",
        start_date: "2026-02-05",
        end_date: "2026-02-06",
        duration_days: 2,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map<number, QuotaDecision>(),
      [],
      new Map(),
    );

    expect(map.size).toBe(0);
  });

  test("caps same-day overlap between over-quota half-day and no-pay at 1 with reasons", () => {
    const targetDate = "2026-02-13"; // Friday
    const leaves: LeaveRow[] = [
      {
        id: 300,
        leave_type: "sick",
        start_date: targetDate,
        end_date: targetDate,
        duration_days: 1,
        document_duration_days: 0.5,
      },
      {
        leave_type: "personal",
        start_date: targetDate,
        end_date: targetDate,
        duration_days: 1,
        is_no_pay: 1,
      },
    ];

    const { deductionMap: map, reasonsByDate } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[300, { overQuota: true, exceedDate: new Date(targetDate) }]]),
      [],
      new Map(),
    );

    const reasons = reasonsByDate.get(targetDate) ?? [];
    const totalReasonWeight = reasons.reduce((sum, r) => sum + r.weight, 0);

    expect(map.get(targetDate)).toBe(1);
    expect(totalReasonWeight).toBe(1);
    expect(reasons.some((r) => r.code === "OVER_QUOTA")).toBe(true);
    expect(reasons.some((r) => r.code === "NO_PAY")).toBe(true);
  });
});
