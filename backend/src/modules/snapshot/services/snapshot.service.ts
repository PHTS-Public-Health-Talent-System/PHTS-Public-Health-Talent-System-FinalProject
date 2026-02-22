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

export enum SnapshotStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  READY = "READY",
  FAILED = "FAILED",
}

/**
 * Period with snapshot info
 */
export interface PeriodWithSnapshot {
  period_id: number;
  period_month: number;
  period_year: number;
  status: string;
  is_locked?: boolean;
  snapshot_status?: SnapshotStatus;
  snapshot_ready_at?: Date | null;
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

let snapshotOutboxTableReady = false;
let payPeriodsPhaseAReady = false;

async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND column_name = ?
    `,
    [tableName, columnName],
  );
  return Number((rows[0] as any)?.cnt ?? 0) > 0;
}

async function ensurePayPeriodsPhaseAColumns(): Promise<void> {
  if (payPeriodsPhaseAReady) return;
  if (!(await hasColumn("pay_periods", "is_locked"))) {
    await query(
      `
      ALTER TABLE pay_periods
      ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0
      `,
    );
  }
  if (!(await hasColumn("pay_periods", "snapshot_status"))) {
    await query(
      `
      ALTER TABLE pay_periods
      ADD COLUMN snapshot_status
      ENUM('PENDING','PROCESSING','READY','FAILED')
      NOT NULL DEFAULT 'PENDING'
      `,
    );
  }
  if (!(await hasColumn("pay_periods", "snapshot_ready_at"))) {
    await query(
      `
      ALTER TABLE pay_periods
      ADD COLUMN snapshot_ready_at DATETIME NULL
      `,
    );
  }
  payPeriodsPhaseAReady = true;
}

async function ensureSnapshotOutboxTable(): Promise<void> {
  if (snapshotOutboxTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS pay_snapshot_outbox (
      outbox_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      period_id INT NOT NULL,
      requested_by INT NULL,
      status ENUM('PENDING','PROCESSING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME NULL,
      INDEX idx_snapshot_outbox_status_available (status, available_at),
      INDEX idx_snapshot_outbox_period (period_id)
    )
    `,
  );
  snapshotOutboxTableReady = true;
}

function resolveSnapshotStatus(row: any): SnapshotStatus {
  const fromNew = String(row?.snapshot_status ?? "").toUpperCase();
  if (
    fromNew === SnapshotStatus.PENDING ||
    fromNew === SnapshotStatus.PROCESSING ||
    fromNew === SnapshotStatus.READY ||
    fromNew === SnapshotStatus.FAILED
  ) {
    return fromNew as SnapshotStatus;
  }
  return SnapshotStatus.PENDING;
}

function isSnapshotReady(period: PeriodWithSnapshot): boolean {
  return resolveSnapshotStatus(period as any) === SnapshotStatus.READY;
}

/**
 * Get period with snapshot info
 */
export async function getPeriodWithSnapshot(
  periodId: number,
): Promise<PeriodWithSnapshot | null> {
  await ensurePayPeriodsPhaseAColumns();
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
    is_locked: row.is_locked === 1 || row.is_locked === true,
    snapshot_status: resolveSnapshotStatus(row),
    snapshot_ready_at: row.snapshot_ready_at ?? null,
    frozen_at: row.frozen_at,
    frozen_by: row.frozen_by,
    snapshot_count: row.snapshot_count,
  };
}

/**
 * Check if period snapshot is ready
 */
export async function isPeriodFrozen(periodId: number): Promise<boolean> {
  await ensurePayPeriodsPhaseAColumns();
  const sql = "SELECT snapshot_status FROM pay_periods WHERE period_id = ?";
  const rows = await query<RowDataPacket[]>(sql, [periodId]);

  if (rows.length === 0) return false;
  return String((rows[0] as any).snapshot_status ?? "").toUpperCase() === SnapshotStatus.READY;
}

/**
 * Freeze a period's snapshot
 */
export async function freezePeriod(
  periodId: number,
  frozenBy: number,
): Promise<void> {
  await enqueuePeriodSnapshotGeneration(periodId, frozenBy);
}

export async function enqueuePeriodSnapshotGeneration(
  periodId: number,
  requestedBy: number | null,
): Promise<void> {
  await ensurePayPeriodsPhaseAColumns();
  await ensureSnapshotOutboxTable();
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [periods] = await connection.query<RowDataPacket[]>(
      "SELECT period_id, period_month, period_year, status FROM pay_periods WHERE period_id = ? FOR UPDATE",
      [periodId],
    );
    if (!periods.length) {
      throw new Error("Period not found");
    }
    const period = periods[0] as any;
    if (String(period.status ?? "").toUpperCase() !== "CLOSED") {
      throw new Error("Can only enqueue snapshot for closed periods");
    }

    await connection.execute(
      `UPDATE pay_periods
       SET snapshot_status = 'PENDING', snapshot_ready_at = NULL, updated_at = NOW()
       WHERE period_id = ?`,
      [periodId],
    );
    await connection.execute(
      `INSERT INTO pay_snapshot_outbox (period_id, requested_by, status, attempts, available_at)
       VALUES (?, ?, 'PENDING', 0, NOW())`,
      [periodId, requestedBy],
    );
    await connection.commit();
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

export async function processSnapshotOutboxBatch(limit: number = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  await ensurePayPeriodsPhaseAColumns();
  await ensureSnapshotOutboxTable();
  const conn = await getConnection();
  let processed = 0;
  let sent = 0;
  let failed = 0;
  try {
    await conn.beginTransaction();
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const [rows] = await conn.query<RowDataPacket[]>(
      `
      SELECT outbox_id, period_id, requested_by, attempts
      FROM pay_snapshot_outbox
      WHERE status IN ('PENDING', 'FAILED') AND available_at <= NOW()
      ORDER BY status ASC, available_at ASC, outbox_id ASC
      LIMIT ${safeLimit}
      FOR UPDATE SKIP LOCKED
      `,
    );

    for (const row of rows as any[]) {
      processed += 1;
      const outboxId = Number(row.outbox_id);
      const periodId = Number(row.period_id);
      const requestedBy =
        row.requested_by === null || row.requested_by === undefined
          ? null
          : Number(row.requested_by);
      try {
        await conn.execute(
          `UPDATE pay_snapshot_outbox SET status = 'PROCESSING' WHERE outbox_id = ?`,
          [outboxId],
        );
        await generateSnapshotForPeriod(conn, periodId, requestedBy);
        await conn.execute(
          `UPDATE pay_snapshot_outbox
           SET status = 'SENT', processed_at = NOW(), last_error = NULL
           WHERE outbox_id = ?`,
          [outboxId],
        );
        sent += 1;
      } catch (error: any) {
        failed += 1;
        await conn.execute(
          `UPDATE pay_snapshot_outbox
           SET status = 'FAILED', attempts = attempts + 1, last_error = ?
           WHERE outbox_id = ?`,
          [String(error?.message ?? "snapshot generation failed").slice(0, 2000), outboxId],
        );
        await conn.execute(
          `UPDATE pay_periods
           SET snapshot_status = 'FAILED', updated_at = NOW()
           WHERE period_id = ?`,
          [periodId],
        );
        await emitAuditEvent({
          eventType: AuditEventType.OTHER,
          entityType: "snapshot",
          entityId: periodId,
          actorId: requestedBy,
          actionDetail: {
            code: "SNAPSHOT_GENERATION_FAILED",
            period_id: periodId,
            message: error?.message ?? String(error),
          },
        }, conn);
      }
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  return { processed, sent, failed };
}

async function generateSnapshotForPeriod(
  connection: Awaited<ReturnType<typeof getConnection>>,
  periodId: number,
  requestedBy: number | null,
): Promise<void> {
  const [periodRows] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE",
    [periodId],
  );
  if (!periodRows.length) throw new Error("Period not found");
  const period = periodRows[0] as any;
  if (String(period.status ?? "").toUpperCase() !== "CLOSED") {
    throw new Error("Can only freeze closed periods");
  }

  await connection.execute(
    `UPDATE pay_periods SET snapshot_status = 'PROCESSING', updated_at = NOW() WHERE period_id = ?`,
    [periodId],
  );

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

  let totalAmount = 0;
  for (const payout of payouts as any[]) totalAmount += payout.total_payable || 0;

  await connection.execute(
    "DELETE FROM pay_snapshots WHERE period_id = ?",
    [periodId],
  );

  await connection.execute(
    `INSERT INTO pay_snapshots
     (period_id, snapshot_type, snapshot_data, record_count, total_amount)
     VALUES (?, 'PAYOUT', ?, ?, ?)`,
    [periodId, JSON.stringify(payouts), payouts.length, totalAmount],
  );

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

  await connection.execute(
    `
    UPDATE pay_periods
    SET frozen_at = NOW(),
        frozen_by = ?,
        snapshot_status = 'READY',
        snapshot_ready_at = NOW(),
        updated_at = NOW()
    WHERE period_id = ?
    `,
    [requestedBy, periodId],
  );

  await emitAuditEvent({
    eventType: AuditEventType.SNAPSHOT_FREEZE,
    entityType: "period",
    entityId: periodId,
    actorId: requestedBy,
    actionDetail: {
      period_month: period.period_month,
      period_year: period.period_year,
      record_count: payouts.length,
      total_amount: totalAmount,
      status: "READY",
    },
  }, connection);
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
 * Get payout data for report (snapshot-only gate)
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
  if (!isSnapshotReady(period)) {
    throw new Error("SNAPSHOT_NOT_READY");
  }

  const snapshot = await getSnapshot(periodId, SnapshotType.PAYOUT);

  if (!snapshot) {
    throw new Error("SNAPSHOT_NOT_READY");
  }

  return {
    source: "snapshot",
    data: snapshot.snapshot_data,
    recordCount: snapshot.record_count,
    totalAmount: snapshot.total_amount,
  };
}

/**
 * Get summary data for report (snapshot-only gate)
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
  if (!isSnapshotReady(period)) {
    throw new Error("SNAPSHOT_NOT_READY");
  }

  const snapshot = await getSnapshot(periodId, SnapshotType.SUMMARY);

  if (!snapshot) {
    throw new Error("SNAPSHOT_NOT_READY");
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
  await ensurePayPeriodsPhaseAColumns();
  if (!reason || reason.trim() === "") {
    throw new Error("Reason is required for unfreezing");
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Check period snapshot is currently ready
    const [periods] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE",
      [periodId],
    );

    if (periods.length === 0) {
      throw new Error("Period not found");
    }

    const period = periods[0] as any;

    if (resolveSnapshotStatus(period) !== SnapshotStatus.READY) {
      throw new Error("Period is not frozen");
    }

    // Unfreeze (keep snapshots for audit trail)
    await connection.execute(
      `UPDATE pay_periods
       SET frozen_at = NULL,
           frozen_by = NULL,
           snapshot_status = 'PENDING',
           snapshot_ready_at = NULL,
           updated_at = NOW()
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
