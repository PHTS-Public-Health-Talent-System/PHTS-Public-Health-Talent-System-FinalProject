import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';
import type { PersonnelMovementRecord } from '@/modules/alerts/entities/alerts.entity.js';
import { MOVEMENT_RETURN_TYPES } from '@/modules/alerts/constants/alert-policy.js';

export type MovementOutRow = {
  citizen_id: string;
  movement_type: string;
  effective_date: Date;
};

export type LeaveReportCandidate = {
  leave_record_id: number;
  citizen_id: string;
  leave_type: string;
  end_date: Date;
  days_since_end: number;
};

export class AlertsRepository {
  static async getPersonnelMovements(
    conn?: PoolConnection,
  ): Promise<PersonnelMovementRecord[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `
       SELECT
         mm.movement_id,
         mm.citizen_id,
         mm.movement_type,
         mm.effective_date,
         mm.remark,
         e.first_name,
         e.last_name,
         e.position_name,
         e.department
       FROM (
         -- De-dup sync noise: some sources insert the same movement multiple times.
         SELECT
           MAX(m.movement_id) AS movement_id,
           m.citizen_id,
           m.movement_type,
           DATE(m.effective_date) AS effective_date,
           m.remark
         FROM emp_movements m
         WHERE m.movement_type IN ('RESIGN', 'TRANSFER_OUT')
         GROUP BY
           m.citizen_id,
           m.movement_type,
           DATE(m.effective_date),
           m.remark
       ) mm
       LEFT JOIN emp_profiles e ON e.citizen_id = mm.citizen_id
       ORDER BY mm.effective_date DESC, mm.movement_id DESC
      `,
    );
    return rows as PersonnelMovementRecord[];
  }

  static async createPersonnelMovement(payload: {
    citizen_id: string;
    movement_type: "RESIGN" | "TRANSFER_OUT";
    effective_date: string;
    remark?: string;
  }): Promise<number> {
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO emp_movements
        (citizen_id, movement_type, effective_date, remark)
       VALUES (?, ?, ?, ?)`,
      [
        payload.citizen_id,
        payload.movement_type,
        payload.effective_date,
        payload.remark ?? null,
      ],
    );
    return result.insertId;
  }

  static async updatePersonnelMovement(
    movementId: number,
    payload: {
      citizen_id: string;
      movement_type: "RESIGN" | "TRANSFER_OUT";
      effective_date: string;
      remark?: string;
    },
  ): Promise<void> {
    await db.execute<ResultSetHeader>(
      `UPDATE emp_movements
       SET citizen_id = ?, movement_type = ?, effective_date = ?, remark = ?
       WHERE movement_id = ?
         AND movement_type IN ('RESIGN', 'TRANSFER_OUT')`,
      [
        payload.citizen_id,
        payload.movement_type,
        payload.effective_date,
        payload.remark ?? null,
        movementId,
      ],
    );
  }

  static async deletePersonnelMovement(movementId: number): Promise<void> {
    await db.execute<ResultSetHeader>(
      `DELETE FROM emp_movements
       WHERE movement_id = ?
         AND movement_type IN ('RESIGN', 'TRANSFER_OUT')`,
      [movementId],
    );
  }

  static async findUserIdByCitizenId(
    citizenId: string,
    conn?: PoolConnection,
  ): Promise<number | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE citizen_id = ? LIMIT 1",
      [citizenId],
    );
    return rows.length ? Number((rows[0] as any).id) : null;
  }

  static async setEligibilityExpiry(
    citizenId: string,
    expiryDate: string,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `UPDATE req_eligibility
       SET is_active = 0, expiry_date = ?
       WHERE citizen_id = ?
         AND is_active = 1
         AND effective_date <= ?
         AND (expiry_date IS NULL OR expiry_date > ?)`
      ,
      [expiryDate, citizenId, expiryDate, expiryDate],
    );
    return result.affectedRows;
  }

  static async restoreLatestEligibility(
    citizenId: string,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT eligibility_id, is_active
       FROM req_eligibility
       WHERE citizen_id = ?
       ORDER BY effective_date DESC, eligibility_id DESC
       LIMIT 1`,
      [citizenId],
    );
    if (!rows.length) return 0;
    const eligibilityId = Number((rows[0] as any).eligibility_id || 0);
    const isActive = Number((rows[0] as any).is_active || 0) === 1;
    if (isActive || !eligibilityId) return 0;

    const [result] = await executor.execute<ResultSetHeader>(
      `UPDATE req_eligibility
       SET is_active = 1, expiry_date = NULL
       WHERE eligibility_id = ?`,
      [eligibilityId],
    );
    return result.affectedRows;
  }

  static async getMovementOutCandidates(
    asOf: Date = new Date(),
    conn?: PoolConnection,
  ): Promise<MovementOutRow[]> {
    const executor = conn ?? db;
    const returnTypePlaceholders = MOVEMENT_RETURN_TYPES.map(() => "?").join(",");
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT m.citizen_id, m.movement_type, m.effective_date
       FROM emp_movements m
       WHERE m.movement_type IN ('RESIGN', 'TRANSFER_OUT')
         AND m.effective_date <= DATE(?)
         AND NOT EXISTS (
           SELECT 1 FROM emp_movements m2
           WHERE m2.citizen_id = m.citizen_id
             AND m2.movement_type IN (${returnTypePlaceholders})
             AND m2.effective_date > m.effective_date
         )`,
      [asOf, ...MOVEMENT_RETURN_TYPES],
    );
    return rows as MovementOutRow[];
  }

  static async getLeaveReportCandidates(
    leaveTypes: string[],
    maxDays: number,
    asOf: Date = new Date(),
    conn?: PoolConnection,
  ): Promise<LeaveReportCandidate[]> {
    const executor = conn ?? db;
    if (!leaveTypes.length) return [];
    const placeholders = leaveTypes.map(() => "?").join(",");
    const returnTypePlaceholders = MOVEMENT_RETURN_TYPES.map(() => "?").join(",");
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT lr.id as leave_record_id,
              lr.citizen_id,
              lr.leave_type,
              lr.end_date,
              DATEDIFF(DATE(?), lr.end_date) AS days_since_end
       FROM leave_records lr
       WHERE lr.leave_type IN (${placeholders})
         AND lr.end_date < DATE(?)
         AND DATEDIFF(DATE(?), lr.end_date) BETWEEN 1 AND ?
         AND NOT EXISTS (
           SELECT 1 FROM emp_movements em
           WHERE em.citizen_id = lr.citizen_id
             AND em.movement_type IN (${returnTypePlaceholders})
             AND em.effective_date > lr.end_date
         )
         AND NOT EXISTS (
           SELECT 1
           FROM leave_record_extensions ext
           WHERE ext.leave_record_id = lr.id
             AND ext.return_report_status = 'DONE'
         )
       ORDER BY lr.end_date ASC`,
      [asOf, ...leaveTypes, asOf, asOf, maxDays, ...MOVEMENT_RETURN_TYPES],
    );
    return rows as LeaveReportCandidate[];
  }

  static async getRetirementsDue(
    asOf: Date = new Date(),
    conn?: PoolConnection,
  ): Promise<{ citizen_id: string; retire_date: string }[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT citizen_id, retire_date
       FROM emp_retirements
       WHERE retire_date <= DATE(?)`,
      [asOf],
    );
    return rows as { citizen_id: string; retire_date: string }[];
  }
}
