import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';

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
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT m.citizen_id, m.movement_type, m.effective_date
       FROM emp_movements m
       WHERE m.movement_type IN ('RESIGN', 'TRANSFER_OUT')
         AND m.effective_date <= DATE(?)
         AND NOT EXISTS (
           SELECT 1 FROM emp_movements m2
           WHERE m2.citizen_id = m.citizen_id
             AND m2.movement_type IN ('ENTRY', 'TRANSFER_IN', 'REINSTATE', 'STUDY')
             AND m2.effective_date > m.effective_date
         )`,
      [asOf],
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
             AND em.movement_type IN ('ENTRY', 'TRANSFER_IN', 'REINSTATE', 'STUDY')
             AND em.effective_date > lr.end_date
         )
         AND NOT EXISTS (
           SELECT 1 FROM leave_return_reports r
           WHERE r.leave_record_id = lr.id
         )
       ORDER BY lr.end_date ASC`,
      [asOf, ...leaveTypes, asOf, asOf, maxDays],
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
