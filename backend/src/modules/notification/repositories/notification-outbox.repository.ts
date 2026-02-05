import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';
import type {
  NotificationOutboxPayload,
  NotificationOutboxRecord,
  NotificationOutboxStatus,
} from '@/modules/notification/entities/notification-outbox.entity.js';

export class NotificationOutboxRepository {
  static async enqueue(
    payload: NotificationOutboxPayload,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO ntf_outbox (payload, status, attempts, available_at)
       VALUES (?, 'PENDING', 0, NOW())`,
      [JSON.stringify(payload)],
    );
    return result.insertId;
  }

  static async fetchPending(
    limit: number,
    conn: PoolConnection,
  ): Promise<NotificationOutboxRecord[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT outbox_id, payload, status, attempts, last_error, available_at, created_at, processed_at
       FROM ntf_outbox
       WHERE status IN ('PENDING', 'FAILED')
         AND available_at <= NOW()
       ORDER BY status ASC, available_at ASC, outbox_id ASC
       LIMIT ${safeLimit}
       FOR UPDATE SKIP LOCKED`,
    );
    return rows.map((row: any) => ({
      outbox_id: row.outbox_id,
      payload: JSON.parse(row.payload),
      status: row.status as NotificationOutboxStatus,
      attempts: Number(row.attempts || 0),
      last_error: row.last_error ?? null,
      available_at: row.available_at,
      created_at: row.created_at,
      processed_at: row.processed_at ?? null,
    }));
  }

  static async markProcessing(
    outboxId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE ntf_outbox
       SET status = 'PROCESSING'
       WHERE outbox_id = ?`,
      [outboxId],
    );
  }

  static async markSent(
    outboxId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE ntf_outbox
       SET status = 'SENT', processed_at = NOW()
       WHERE outbox_id = ?`,
      [outboxId],
    );
  }

  static async markFailed(
    outboxId: number,
    errorMessage: string,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE ntf_outbox
       SET status = 'FAILED', attempts = attempts + 1, last_error = ?
       WHERE outbox_id = ?`,
      [errorMessage.slice(0, 2000), outboxId],
    );
  }

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }
}
