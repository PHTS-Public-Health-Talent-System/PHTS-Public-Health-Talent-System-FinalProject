import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';
import type { RetirementInput, RetirementRecord } from '@/modules/workforce-compliance/entities/workforce-compliance.entity.js';

export class RetirementsRepository {
  static async list(conn?: PoolConnection): Promise<RetirementRecord[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT
         r.*,
         e.first_name,
         e.last_name,
         e.position_name,
         e.department
       FROM emp_retirements r
       LEFT JOIN emp_profiles e ON e.citizen_id = r.citizen_id
       ORDER BY r.retire_date ASC`,
    );
    return rows as RetirementRecord[];
  }

  static async findById(
    retirementId: number,
    conn?: PoolConnection,
  ): Promise<RetirementRecord | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT
         r.*,
         e.first_name,
         e.last_name,
         e.position_name,
         e.department
       FROM emp_retirements r
       LEFT JOIN emp_profiles e ON e.citizen_id = r.citizen_id
       WHERE r.retirement_id = ?`,
      [retirementId],
    );
    return (rows[0] as RetirementRecord) ?? null;
  }

  static async upsert(
    input: RetirementInput,
    createdBy: number,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO emp_retirements (citizen_id, retire_date, note, created_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE retire_date = VALUES(retire_date), note = VALUES(note), created_by = VALUES(created_by)`
      ,
      [input.citizen_id, input.retire_date, input.note ?? null, createdBy],
    );

    if (result.insertId) return result.insertId;

    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT retirement_id FROM emp_retirements WHERE citizen_id = ?",
      [input.citizen_id],
    );
    return Number((rows[0] as any)?.retirement_id || 0);
  }

  static async update(
    retirementId: number,
    input: RetirementInput,
    updatedBy: number,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      `UPDATE emp_retirements
       SET citizen_id = ?, retire_date = ?, note = ?, created_by = ?
       WHERE retirement_id = ?`,
      [
        input.citizen_id,
        input.retire_date,
        input.note ?? null,
        updatedBy,
        retirementId,
      ],
    );
  }

  static async delete(
    retirementId: number,
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute(
      "DELETE FROM emp_retirements WHERE retirement_id = ?",
      [retirementId],
    );
  }
}
