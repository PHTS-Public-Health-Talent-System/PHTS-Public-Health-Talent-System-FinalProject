/**
 * Notification Module - Repository
 *
 * Handles all database operations for notifications
 */

import { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import db from '@config/database.js';
import { Notification, NotificationType, NotificationSettings } from '@/modules/notification/entities/notification.entity.js';

const DEFAULT_CHUNK_SIZE = 200;

export class NotificationRepository {
  // ── Create notifications ────────────────────────────────────────────────────

  static async create(
    userId: number,
    title: string,
    message: string,
    link: string = "#",
    type: NotificationType = NotificationType.SYSTEM,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO ntf_messages (user_id, title, message, link, type)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, link, type],
    );
    return result.insertId;
  }

  static async createBulk(
    notifications: Array<{
      userId: number;
      title: string;
      message: string;
      link: string;
      type: NotificationType;
    }>,
    conn?: PoolConnection,
  ): Promise<number> {
    if (notifications.length === 0) return 0;

    const executor = conn ?? db;
    let insertedCount = 0;

    for (let i = 0; i < notifications.length; i += DEFAULT_CHUNK_SIZE) {
      const batch = notifications.slice(i, i + DEFAULT_CHUNK_SIZE);
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const values = batch.flatMap((n) => [
        n.userId,
        n.title,
        n.message,
        n.link,
        n.type,
      ]);

      const [result] = await executor.execute<ResultSetHeader>(
        `INSERT INTO ntf_messages (user_id, title, message, link, type)
         VALUES ${placeholders}`,
        values,
      );
      insertedCount += result.affectedRows;
    }

    return insertedCount;
  }

  // ── Find notifications ──────────────────────────────────────────────────────

  static async findByUserId(
    userId: number,
    limit: number = 20,
    conn?: PoolConnection,
  ): Promise<Notification[]> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT id, user_id, title, message, link, type, is_read, created_at
       FROM ntf_messages
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
      [userId],
    );
    return rows as Notification[];
  }

  static async findById(
    notificationId: number,
    conn?: PoolConnection,
  ): Promise<Notification | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT id, user_id, title, message, link, type, is_read, created_at
       FROM ntf_messages
       WHERE id = ?
       LIMIT 1`,
      [notificationId],
    );
    return (rows[0] as Notification) ?? null;
  }

  // ── Count queries ───────────────────────────────────────────────────────────

  static async countUnread(
    userId: number,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM ntf_messages
       WHERE user_id = ? AND is_read = 0`,
      [userId],
    );
    return Number((rows[0] as any)?.count ?? 0);
  }

  static async countUnreadToday(
    userId: number,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM ntf_messages
       WHERE user_id = ?
         AND is_read = 0
         AND DATE(created_at) = CURDATE()`,
      [userId],
    );
    return Number((rows[0] as any)?.count ?? 0);
  }

  // ── Update notifications ────────────────────────────────────────────────────

  static async markAsRead(
    notificationId: number,
    userId: number,
    conn?: PoolConnection,
  ): Promise<boolean> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `UPDATE ntf_messages
       SET is_read = 1
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId],
    );
    return result.affectedRows > 0;
  }

  static async markAllAsRead(
    userId: number,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `UPDATE ntf_messages
       SET is_read = 1
       WHERE user_id = ? AND is_read = 0`,
      [userId],
    );
    return result.affectedRows;
  }

  static async deleteRead(
    userId: number,
    olderThanDays?: number,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    if (olderThanDays && olderThanDays > 0) {
      const [result] = await executor.execute<ResultSetHeader>(
        `DELETE FROM ntf_messages
         WHERE user_id = ? AND is_read = 1
           AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [userId, olderThanDays],
      );
      return result.affectedRows;
    }
    const [result] = await executor.execute<ResultSetHeader>(
      `DELETE FROM ntf_messages WHERE user_id = ? AND is_read = 1`,
      [userId],
    );
    return result.affectedRows;
  }

  // ── Find users by role ──────────────────────────────────────────────────────

  static async findUserIdsByRole(
    role: string,
    conn?: PoolConnection,
  ): Promise<number[]> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE role = ? AND is_active = 1`,
      [role],
    );
    return rows.map((row: any) => row.id);
  }

  // ── Delete notifications ────────────────────────────────────────────────────

  static async delete(
    notificationId: number,
    userId: number,
    conn?: PoolConnection,
  ): Promise<boolean> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `DELETE FROM ntf_messages WHERE id = ? AND user_id = ?`,
      [notificationId, userId],
    );
    return result.affectedRows > 0;
  }

  static async deleteOlderThan(
    days: number,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `DELETE FROM ntf_messages
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days],
    );
    return result.affectedRows;
  }

  // ── Connection helper ───────────────────────────────────────────────────────

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }

  // ── Notification settings ───────────────────────────────────────────────────

  static async getSettingsByUserId(
    userId: number,
    conn?: PoolConnection,
  ): Promise<NotificationSettings | null> {
    const executor = conn ?? db;
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT user_id, in_app, sms, email, updated_at
       FROM ntf_user_settings
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    if (!rows.length) return null;
    const row = rows[0] as any;
    return {
      user_id: row.user_id,
      in_app: row.in_app === 1,
      sms: row.sms === 1,
      email: row.email === 1,
      updated_at: row.updated_at,
    };
  }

  static async upsertSettings(
    userId: number,
    settings: { in_app: boolean; sms: boolean; email: boolean },
    conn?: PoolConnection,
  ): Promise<void> {
    const executor = conn ?? db;
    await executor.execute<ResultSetHeader>(
      `INSERT INTO ntf_user_settings (user_id, in_app, sms, email, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         in_app = VALUES(in_app),
         sms = VALUES(sms),
         email = VALUES(email),
         updated_at = NOW()`,
      [
        userId,
        settings.in_app ? 1 : 0,
        settings.sms ? 1 : 0,
        settings.email ? 1 : 0,
      ],
    );
  }
}
