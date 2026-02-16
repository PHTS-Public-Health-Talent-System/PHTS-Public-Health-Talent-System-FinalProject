import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';
import type { AlertLogInput } from '@/modules/alerts/entities/alerts.entity.js';

export class AlertLogsRepository {
  static async hasPayloadHash(
    payloadHash: string,
    conn?: PoolConnection,
  ): Promise<boolean> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT 1 FROM alert_logs WHERE payload_hash = ? LIMIT 1",
      [payloadHash],
    );
    return rows.length > 0;
  }

  static async insertLog(
    input: AlertLogInput,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO alert_logs
       (alert_type, target_user_id, reference_type, reference_id, payload_hash, status, error_message, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        input.alert_type,
        input.target_user_id ?? null,
        input.reference_type,
        input.reference_id,
        input.payload_hash,
        input.status ?? "SENT",
        input.error_message ?? null,
        input.sent_at ?? new Date(),
      ],
    );
    return result.insertId;
  }
}
