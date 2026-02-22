import { SnapshotRepository } from '@/modules/snapshot/repositories/snapshot.repository.js';
import { SnapshotType } from '@/modules/snapshot/entities/snapshot.entity.js';
import {
  resetSnapshotSchema,
  getTestConnection,
} from '@/test/test-db.js';

jest.setTimeout(30000);

describe("SnapshotRepository (integration)", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    await resetSnapshotSchema();
  });

  test("findPeriodWithSnapshot returns snapshot_count", async () => {
    const conn = await getTestConnection();
    let periodId: number;
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      periodId = Number(periodRes.insertId);
      await conn.execute(
        `INSERT INTO pay_snapshots
         (period_id, snapshot_type, snapshot_data, record_count, total_amount)
         VALUES (?, 'SUMMARY', JSON_OBJECT('k', 'v'), 1, 1000)`,
        [periodId],
      );
    } finally {
      await conn.end();
    }

    const row = await SnapshotRepository.findPeriodWithSnapshot(periodId);
    expect(row?.snapshot_count).toBe(1);
  });

  test("createSnapshot + findSnapshot returns data", async () => {
    const conn = await SnapshotRepository.getConnection();
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      const periodId = Number(periodRes.insertId);
      const snapshotId = await SnapshotRepository.createSnapshot(
        periodId,
        SnapshotType.SUMMARY,
        { total: 1 },
        1,
        1000,
        conn,
      );
      const snap = await SnapshotRepository.findSnapshot(
        periodId,
        SnapshotType.SUMMARY,
        conn,
      );
      expect(snap?.snapshot_id).toBe(snapshotId);
      expect(snap?.snapshot_data).toEqual({ total: 1 });
    } finally {
      conn.release();
    }
  });

  test("findPayoutsForSnapshot joins base rate", async () => {
    const conn = await getTestConnection();
    let periodId: number;
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      periodId = Number(periodRes.insertId);
      const [rateRes] = await conn.execute<any>(
        `INSERT INTO cfg_payment_rates
         (amount, group_no, item_no, profession_code)
         VALUES (1000, 1, '1', 'DOC')`,
      );
      const rateId = Number(rateRes.insertId);
      await conn.execute(
        `INSERT INTO pay_results
         (period_id, citizen_id, master_rate_id, calculated_amount, retroactive_amount, total_payable)
         VALUES (?, '700', ?, 900, 0, 900)`,
        [periodId, rateId],
      );
    } finally {
      await conn.end();
    }

    const conn2 = await SnapshotRepository.getConnection();
    try {
      const rows = await SnapshotRepository.findPayoutsForSnapshot(periodId, conn2);
      expect(rows.length).toBe(1);
      expect(Number(rows[0].base_rate)).toBe(1000);
    } finally {
      conn2.release();
    }
  });
});
