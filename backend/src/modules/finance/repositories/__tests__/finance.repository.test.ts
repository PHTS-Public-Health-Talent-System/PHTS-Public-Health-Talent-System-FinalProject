import { FinanceRepository } from '@/modules/finance/repositories/finance.repository.js';
import { PaymentStatus } from '@/modules/finance/entities/finance.entity.js';
import {
  resetFinanceSchema,
  getTestConnection,
} from '@/test/test-db.js';

jest.setTimeout(30000);

describe("FinanceRepository (integration)", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    await resetFinanceSchema();
  });

  test("findPayoutById and updatePayoutStatus", async () => {
    const conn = await getTestConnection();
    let payoutId: number;
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      const periodId = Number(periodRes.insertId);
      const [payoutRes] = await conn.execute<any>(
        `INSERT INTO pay_results
         (period_id, citizen_id, total_payable, payment_status)
         VALUES (?, '800', 1000, 'PENDING')`,
        [periodId],
      );
      payoutId = Number(payoutRes.insertId);
    } finally {
      await conn.end();
    }

    const initial = await FinanceRepository.findPayoutById(payoutId);
    expect(initial?.payment_status).toBe("PENDING");

    const conn2 = await FinanceRepository.getConnection();
    try {
      await FinanceRepository.updatePayoutStatus(
        payoutId,
        PaymentStatus.PAID,
        1,
        conn2,
      );
    } finally {
      conn2.release();
    }

    const updated = await FinanceRepository.findPayoutById(payoutId);
    expect(updated?.payment_status).toBe("PAID");
  });

  test("findPayoutsByPeriod returns mapped rows", async () => {
    const conn = await getTestConnection();
    let periodId: number;
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      periodId = Number(periodRes.insertId);
      await conn.execute(
        `INSERT INTO emp_profiles
         (citizen_id, first_name, last_name, department_code)
         VALUES ('900', 'A', 'B', 'D1')`,
      );
      await conn.execute(
        `INSERT INTO pay_results
         (period_id, citizen_id, pts_rate_snapshot, calculated_amount, retroactive_amount, total_payable, payment_status)
         VALUES (?, '900', 1000, 900, 0, 900, 'PENDING')`,
        [periodId],
      );
    } finally {
      await conn.end();
    }

    const rows = await FinanceRepository.findPayoutsByPeriod(periodId);
    expect(rows.length).toBe(1);
    expect(rows[0].employee_name).toBe("A B");
  });

  test("findFinanceSummary and findYearlySummary read from view", async () => {
    const conn = await getTestConnection();
    try {
      await conn.execute(
        `INSERT INTO vw_finance_period_summary
         (period_year, period_month, total_employees, total_amount, paid_amount, pending_amount)
         VALUES (2026, 2, 1, 1000, 0, 1000)`,
      );
    } finally {
      await conn.end();
    }

    const summary = await FinanceRepository.findFinanceSummary(2026);
    expect(summary.length).toBe(1);

    const yearly = await FinanceRepository.findYearlySummary(2026);
    expect(yearly.length).toBe(1);
  });
});
