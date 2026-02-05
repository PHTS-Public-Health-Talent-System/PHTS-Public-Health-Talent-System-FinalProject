import { PayrollRepository } from '@/modules/payroll/repositories/payroll.repository.js';
import { PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';
import {
  resetPayrollSchema,
  getTestConnection,
} from '@/test/test-db.js';

jest.setTimeout(30000);

describe("PayrollRepository (integration)", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    await resetPayrollSchema();
  });

  test("insert/find period by month/year", async () => {
    const id = await PayrollRepository.insertPeriod(2, 2026, PeriodStatus.OPEN);
    const period = await PayrollRepository.findPeriodByMonthYear(2, 2026);
    expect(period?.period_id).toBe(id);
    expect(period?.status).toBe(PeriodStatus.OPEN);
  });

  test("insert/find period items", async () => {
    const conn = await PayrollRepository.getConnection();
    try {
      const periodId = await PayrollRepository.insertPeriod(
        2,
        2026,
        PeriodStatus.OPEN,
      );
      const [reqRes] = await conn.execute<any>(
        `INSERT INTO req_submissions
         (user_id, citizen_id, status, current_step, created_at, updated_at)
         VALUES (1, '700', 'PENDING', 3, NOW(), NOW())`,
      );
      const requestId = Number(reqRes.insertId);
      await PayrollRepository.insertPeriodItem(
        periodId,
        requestId,
        "700",
        null,
        conn,
      );
      const items = await PayrollRepository.findPeriodItems(periodId);
      expect(items.length).toBe(1);
      expect(items[0].citizen_id).toBe("700");
    } finally {
      conn.release();
    }
  });

  test("update period status closes period", async () => {
    const conn = await PayrollRepository.getConnection();
    try {
      const periodId = await PayrollRepository.insertPeriod(
        2,
        2026,
        PeriodStatus.OPEN,
      );
      await PayrollRepository.updatePeriodStatus(
        periodId,
        PeriodStatus.CLOSED,
        conn,
      );
      const period = await PayrollRepository.findPeriodById(periodId, conn);
      expect(period?.status).toBe(PeriodStatus.CLOSED);
      expect(period?.closed_at).not.toBeNull();
    } finally {
      conn.release();
    }
  });
});
