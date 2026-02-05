/**
 * PHTS System - Snapshot Freeze Service
 *
 * Handles monthly snapshot freezing.
 * FR-12-01: Lock monthly snapshots when period is closed
 * FR-12-02: Reports must reference frozen snapshots only
 */

import { RowDataPacket } from "mysql2/promise";
import { query, getConnection } from '@config/database.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';

/**
 * Snapshot type
 */
export enum SnapshotType {
  PAYOUT = "PAYOUT",
  SUMMARY = "SUMMARY",
}

/**
 * Period with snapshot info
 */
export interface PeriodWithSnapshot {
  period_id: number;
  period_month: number;
  period_year: number;
  status: string;
  is_frozen: boolean;
  frozen_at: Date | null;
  frozen_by: number | null;
  snapshot_count: number;
}

/**
 * Snapshot record
 */
export interface Snapshot {
  snapshot_id: number;
  period_id: number;
  snapshot_type: SnapshotType;
  snapshot_data: any;
  record_count: number;
  total_amount: number;
  created_at: Date;
}

/**
 * Get period with snapshot info
 */
export async function getPeriodWithSnapshot(
  periodId: number,
): Promise<PeriodWithSnapshot | null> {
  const sql = `
    SELECT p.*,
           (SELECT COUNT(*) FROM pay_snapshots WHERE period_id = p.period_id) AS snapshot_count
    FROM pay_periods p
    WHERE p.period_id = ?
  `;

  const rows = await query<RowDataPacket[]>(sql, [periodId]);

  if (rows.length === 0) return null;

  const row = rows[0] as any;
  return {
    period_id: row.period_id,
    period_month: row.period_month,
    period_year: row.period_year,
    status: row.status,
    is_frozen: row.is_frozen === 1,
    frozen_at: row.frozen_at,
    frozen_by: row.frozen_by,
    snapshot_count: row.snapshot_count,
  };
}

/**
 * Check if period is frozen
 */
export async function isPeriodFrozen(periodId: number): Promise<boolean> {
  const sql = "SELECT is_frozen FROM pay_periods WHERE period_id = ?";
  const rows = await query<RowDataPacket[]>(sql, [periodId]);

  if (rows.length === 0) return false;
  return (rows[0] as any).is_frozen === 1;
}

/**
 * Freeze a period's snapshot
 */
export async function freezePeriod(
  periodId: number,
  frozenBy: number,
): Promise<void> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Check period exists and is closed
    const [periods] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE",
      [periodId],
    );

    if (periods.length === 0) {
      throw new Error("Period not found");
    }

    const period = periods[0] as any;

    if (period.is_frozen) {
      throw new Error("Period is already frozen");
    }

    if (period.status !== "CLOSED") {
      throw new Error("Can only freeze closed periods");
    }

    // Get payout data for snapshot
    const [payouts] = await connection.query<RowDataPacket[]>(
      `
      SELECT po.*,
             COALESCE(e.first_name, s.first_name, '') AS first_name,
             COALESCE(e.last_name, s.last_name, '') AS last_name,
             COALESCE(e.department, s.department, '') AS department,
             COALESCE(e.position_name, s.position_name, '') AS position_name,
             mr.amount AS base_rate,
             mr.group_no,
             mr.item_no,
             mr.profession_code
      FROM pay_results po
      LEFT JOIN emp_profiles e ON po.citizen_id = e.citizen_id
      LEFT JOIN emp_support_staff s ON po.citizen_id = s.citizen_id
      LEFT JOIN cfg_payment_rates mr ON po.master_rate_id = mr.rate_id
      WHERE po.period_id = ?
      ORDER BY last_name, first_name
    `,
      [periodId],
    );

    // Calculate totals
    let totalAmount = 0;
    for (const payout of payouts as any[]) {
      totalAmount += payout.total_payable || 0;
    }

    // Create payout snapshot
    await connection.execute(
      `INSERT INTO pay_snapshots
       (period_id, snapshot_type, snapshot_data, record_count, total_amount)
       VALUES (?, 'PAYOUT', ?, ?, ?)`,
      [periodId, JSON.stringify(payouts), payouts.length, totalAmount],
    );

    // Create summary snapshot
    const summary = {
      period_id: periodId,
      period_month: period.period_month,
      period_year: period.period_year,
      total_employees: payouts.length,
      total_amount: totalAmount,
      frozen_at: new Date().toISOString(),
      by_department: calculateDepartmentSummary(payouts as any[]),
    };

    await connection.execute(
      `INSERT INTO pay_snapshots
       (period_id, snapshot_type, snapshot_data, record_count, total_amount)
       VALUES (?, 'SUMMARY', ?, ?, ?)`,
      [periodId, JSON.stringify(summary), payouts.length, totalAmount],
    );

    // Mark period as frozen
    await connection.execute(
      `UPDATE pay_periods
       SET is_frozen = 1, frozen_at = NOW(), frozen_by = ?
       WHERE period_id = ?`,
      [frozenBy, periodId],
    );

    await connection.commit();

    // Log audit
    await emitAuditEvent({
      eventType: AuditEventType.SNAPSHOT_FREEZE,
      entityType: "period",
      entityId: periodId,
      actorId: frozenBy,
      actionDetail: {
        period_month: period.period_month,
        period_year: period.period_year,
        record_count: payouts.length,
        total_amount: totalAmount,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Helper to calculate department summary
 */
function calculateDepartmentSummary(
  payouts: any[],
): { department: string; count: number; amount: number }[] {
  const deptMap: Record<string, { count: number; amount: number }> = {};

  for (const payout of payouts) {
    const dept = payout.department || "Unknown";
    if (!deptMap[dept]) {
      deptMap[dept] = { count: 0, amount: 0 };
    }
    deptMap[dept].count++;
    deptMap[dept].amount += payout.total_payable || 0;
  }

  return Object.entries(deptMap)
    .map(([department, data]) => ({
      department,
      count: data.count,
      amount: data.amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Get snapshot data
 */
export async function getSnapshot(
  periodId: number,
  snapshotType: SnapshotType,
): Promise<Snapshot | null> {
  const sql = `
    SELECT * FROM pay_snapshots
    WHERE period_id = ? AND snapshot_type = ?
    ORDER BY created_at DESC LIMIT 1
  `;

  const rows = await query<RowDataPacket[]>(sql, [periodId, snapshotType]);

  if (rows.length === 0) return null;

  const row = rows[0] as any;
  return {
    snapshot_id: row.snapshot_id,
    period_id: row.period_id,
    snapshot_type: row.snapshot_type,
    snapshot_data: JSON.parse(row.snapshot_data),
    record_count: row.record_count,
    total_amount: Number(row.total_amount),
    created_at: row.created_at,
  };
}

/**
 * Get payout data for report (from snapshot if frozen, otherwise live)
 */
export async function getPayoutDataForReport(periodId: number): Promise<{
  source: "snapshot";
  data: any[];
  recordCount: number;
  totalAmount: number;
}> {
  const period = await getPeriodWithSnapshot(periodId);
  if (!period) {
    throw new Error("Period not found");
  }
  if (period.status !== "CLOSED") {
    throw new Error("Report is available only for closed periods");
  }
  if (!period.is_frozen) {
    throw new Error("Report requires frozen snapshot");
  }

  const snapshot = await getSnapshot(periodId, SnapshotType.PAYOUT);

  if (!snapshot) {
    throw new Error("Snapshot not found for frozen period");
  }

  return {
    source: "snapshot",
    data: snapshot.snapshot_data,
    recordCount: snapshot.record_count,
    totalAmount: snapshot.total_amount,
  };
}

/**
 * Get summary data for report (from snapshot if frozen, otherwise calculate)
 */
export async function getSummaryDataForReport(periodId: number): Promise<{
  source: "snapshot";
  data: any;
}> {
  const period = await getPeriodWithSnapshot(periodId);
  if (!period) {
    throw new Error("Period not found");
  }
  if (period.status !== "CLOSED") {
    throw new Error("Report is available only for closed periods");
  }
  if (!period.is_frozen) {
    throw new Error("Report requires frozen snapshot");
  }

  const snapshot = await getSnapshot(periodId, SnapshotType.SUMMARY);

  if (!snapshot) {
    throw new Error("Summary snapshot not found for frozen period");
  }

  return {
    source: "snapshot",
    data: snapshot.snapshot_data,
  };
}

/**
 * Unfreeze a period (admin only, for corrections)
 */
export async function unfreezePeriod(
  periodId: number,
  unfrozenBy: number,
  reason: string,
): Promise<void> {
  if (!reason || reason.trim() === "") {
    throw new Error("Reason is required for unfreezing");
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Check period is frozen
    const [periods] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE",
      [periodId],
    );

    if (periods.length === 0) {
      throw new Error("Period not found");
    }

    const period = periods[0] as any;

    if (!period.is_frozen) {
      throw new Error("Period is not frozen");
    }

    // Unfreeze (keep snapshots for audit trail)
    await connection.execute(
      `UPDATE pay_periods
       SET is_frozen = 0, frozen_at = NULL, frozen_by = NULL
       WHERE period_id = ?`,
      [periodId],
    );

    await connection.commit();

    // Log audit
    await emitAuditEvent({
      eventType: AuditEventType.SNAPSHOT_UNFREEZE,
      entityType: "period",
      entityId: periodId,
      actorId: unfrozenBy,
      actionDetail: {
        period_month: period.period_month,
        period_year: period.period_year,
        reason,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all snapshots for a period
 */
export async function getSnapshotsForPeriod(
  periodId: number,
): Promise<Snapshot[]> {
  const sql = `
    SELECT * FROM pay_snapshots
    WHERE period_id = ?
    ORDER BY created_at DESC
  `;

  const rows = await query<RowDataPacket[]>(sql, [periodId]);

  return (rows as any[]).map((row) => ({
    snapshot_id: row.snapshot_id,
    period_id: row.period_id,
    snapshot_type: row.snapshot_type,
    snapshot_data: JSON.parse(row.snapshot_data),
    record_count: row.record_count,
    total_amount: Number(row.total_amount),
    created_at: row.created_at,
  }));
}
