import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { PayrollQueryRepository } from "@/modules/payroll/repositories/query.repository.js";

describe("PayrollQueryRepository eligibility coverage", () => {
  test("findEligibleCitizenIds should not filter only active eligibility", async () => {
    const conn = {
      query: jest.fn().mockResolvedValue([[] as RowDataPacket[]]),
    } as unknown as PoolConnection;

    await PayrollQueryRepository.findEligibleCitizenIds(2026, 3, conn);

    const sql = String((conn.query as jest.Mock).mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("FROM req_eligibility");
    expect(sql).not.toContain("is_active = 1");
  });

  test("fetchBatchData should include overlapping historical eligibility rows", async () => {
    const conn = {
      query: jest.fn().mockResolvedValue([[] as RowDataPacket[]]),
    } as unknown as PoolConnection;

    await PayrollQueryRepository.fetchBatchData(
      ["1539900235839"],
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-03-31T00:00:00.000Z"),
      2569,
      conn,
    );

    const sql = String((conn.query as jest.Mock).mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("FROM req_eligibility e");
    expect(sql).not.toContain("e.is_active = 1");
  });
});
