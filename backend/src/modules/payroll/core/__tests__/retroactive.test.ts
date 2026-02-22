import { calculateRetroactive } from "@/modules/payroll/core/retroactive";
import { calculateMonthly } from "@/modules/payroll/core/calculator";

jest.mock("@/modules/payroll/core/calculator.js", () => ({
  calculateMonthly: jest.fn(),
}));

type QueryHandler = (sql: string, params: any[]) => any[];

const makeConnection = (handler: QueryHandler) => ({
  query: jest.fn(async (sql: string, params: any[] = []) => [
    handler(sql, params),
  ]),
});

const mockedCalculateMonthly = calculateMonthly as jest.MockedFunction<
  typeof calculateMonthly
>;

describe("payroll core retroactive", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns empty result when no closed period found in lookback", async () => {
    const conn = makeConnection((sql) => {
      if (sql.includes("FROM pay_periods")) return [];
      return [];
    });

    const result = await calculateRetroactive("1111111111111", 2026, 2, 2, conn as any);

    expect(result.totalRetro).toBe(0);
    expect(result.retroDetails).toEqual([]);
    expect(mockedCalculateMonthly).not.toHaveBeenCalled();
  });

  test("skips period that is not CLOSED", async () => {
    const conn = makeConnection((sql) => {
      if (sql.includes("FROM pay_periods")) {
        return [{ period_id: 10, status: "OPEN" }];
      }
      return [];
    });

    const result = await calculateRetroactive("1111111111111", 2026, 2, 1, conn as any);

    expect(result.totalRetro).toBe(0);
    expect(result.retroDetails).toHaveLength(0);
    expect(mockedCalculateMonthly).not.toHaveBeenCalled();
  });

  test("creates positive retro detail when recalculated amount is higher than paid", async () => {
    mockedCalculateMonthly.mockResolvedValue({
      netPayment: 5500,
    } as any);

    const conn = makeConnection((sql) => {
      if (sql.includes("FROM pay_periods")) {
        return [{ period_id: 20, status: "CLOSED" }];
      }
      if (sql.includes("FROM pay_results WHERE citizen_id = ? AND period_id = ?")) {
        return [{ calculated_amount: 5000 }];
      }
      if (sql.includes("FROM pay_result_items pi")) {
        return [];
      }
      return [];
    });

    const result = await calculateRetroactive("1111111111111", 2026, 2, 1, conn as any);

    expect(result.totalRetro).toBe(500);
    expect(result.retroDetails).toEqual([
      {
        month: 1,
        year: 2026,
        diff: 500,
        remark: "ตกเบิกยอดเดือน 1/2026",
      },
    ]);
    expect(mockedCalculateMonthly).toHaveBeenCalledWith(
      "1111111111111",
      2026,
      1,
      conn,
    );
  });

  test("applies historical retro adjustment before computing diff", async () => {
    mockedCalculateMonthly.mockResolvedValue({
      netPayment: 5200,
    } as any);

    const conn = makeConnection((sql) => {
      if (sql.includes("FROM pay_periods")) {
        return [{ period_id: 21, status: "CLOSED" }];
      }
      if (sql.includes("FROM pay_results WHERE citizen_id = ? AND period_id = ?")) {
        return [{ calculated_amount: 5000 }];
      }
      if (sql.includes("FROM pay_result_items pi")) {
        return [
          { item_type: "RETROACTIVE_ADD", amount: 50 },
          { item_type: "RETROACTIVE_DEDUCT", amount: 10 },
        ];
      }
      return [];
    });

    const result = await calculateRetroactive("1111111111111", 2026, 2, 1, conn as any);

    // paid amount = 5000 + 50 - 10 = 5040, diff = 5200 - 5040 = 160
    expect(result.totalRetro).toBe(160);
    expect(result.retroDetails[0]?.diff).toBe(160);
  });

  test("ignores tiny diff up to 0.01", async () => {
    mockedCalculateMonthly.mockResolvedValue({
      netPayment: 5000.005,
    } as any);

    const conn = makeConnection((sql) => {
      if (sql.includes("FROM pay_periods")) {
        return [{ period_id: 22, status: "CLOSED" }];
      }
      if (sql.includes("FROM pay_results WHERE citizen_id = ? AND period_id = ?")) {
        return [{ calculated_amount: 5000 }];
      }
      if (sql.includes("FROM pay_result_items pi")) {
        return [];
      }
      return [];
    });

    const result = await calculateRetroactive("1111111111111", 2026, 2, 1, conn as any);

    expect(result.totalRetro).toBe(0);
    expect(result.retroDetails).toHaveLength(0);
  });

  test("aggregates multiple months and rounds total to 2 decimals", async () => {
    mockedCalculateMonthly
      .mockResolvedValueOnce({ netPayment: 1000.115 } as any) // Jan 2026
      .mockResolvedValueOnce({ netPayment: 900.225 } as any); // Dec 2025

    const conn = makeConnection((sql, params) => {
      if (sql.includes("FROM pay_periods")) {
        const [month, year] = params;
        if (month === 1 && year === 2026) {
          return [{ period_id: 31, status: "CLOSED" }];
        }
        if (month === 12 && year === 2025) {
          return [{ period_id: 32, status: "CLOSED" }];
        }
        return [];
      }
      if (sql.includes("FROM pay_results WHERE citizen_id = ? AND period_id = ?")) {
        const periodId = params[1];
        if (periodId === 31) return [{ calculated_amount: 1000 }];
        if (periodId === 32) return [{ calculated_amount: 900 }];
        return [];
      }
      if (sql.includes("FROM pay_result_items pi")) return [];
      return [];
    });

    const result = await calculateRetroactive("1111111111111", 2026, 2, 2, conn as any);

    expect(result.retroDetails).toHaveLength(2);
    expect(result.retroDetails[0]?.month).toBe(1);
    expect(result.retroDetails[1]?.month).toBe(12);
    // diff รายเดือนถูกปัด 2 ตำแหน่งก่อนรวม: 0.12 + 0.23 = 0.35
    expect(result.totalRetro).toBe(0.35);
  });

  test("august partial license then backdated renewal in september yields retro 774.19", async () => {
    mockedCalculateMonthly.mockResolvedValue({
      netPayment: 1500,
    } as any);

    const conn = makeConnection((sql, params) => {
      if (sql.includes("FROM pay_periods")) {
        const [month, year] = params;
        if (month === 8 && year === 2026) {
          return [{ period_id: 81, status: "CLOSED" }];
        }
        return [];
      }
      if (sql.includes("FROM pay_results WHERE citizen_id = ? AND period_id = ?")) {
        return [{ calculated_amount: 725.81 }];
      }
      if (sql.includes("FROM pay_result_items pi")) {
        return [];
      }
      return [];
    });

    const result = await calculateRetroactive("1111111111111", 2026, 9, 1, conn as any);

    expect(result.retroDetails).toEqual([
      {
        month: 8,
        year: 2026,
        diff: 774.19,
        remark: "ตกเบิกยอดเดือน 8/2026",
      },
    ]);
    expect(result.totalRetro).toBe(774.19);
  });
});
