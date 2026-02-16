import { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import pool from '@config/database.js';
import type {
  Announcement,
  AnnouncementPriority,
} from "../entities/announcement.entity.js";

export class AnnouncementRepository {
  private getDb(connection?: PoolConnection) {
    return connection || pool;
  }

  async createAnnouncement(
    data: {
      title: string;
      body: string;
      priority: AnnouncementPriority;
      is_active: boolean;
      start_at: string | null;
      end_at: string | null;
      created_by: number | null;
    },
    connection?: PoolConnection,
  ): Promise<number> {
    const db = this.getDb(connection);
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO announcements
       (title, body, priority, is_active, start_at, end_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.body,
        data.priority,
        data.is_active ? 1 : 0,
        data.start_at,
        data.end_at,
        data.created_by,
      ],
    );
    return result.insertId;
  }

  async replaceTargets(
    announcementId: number,
    roles: string[],
    connection?: PoolConnection,
  ): Promise<void> {
    const db = this.getDb(connection);
    await db.query(
      `DELETE FROM announcement_targets WHERE announcement_id = ?`,
      [announcementId],
    );
    if (!roles.length) return;
    const values = roles.map((role) => [announcementId, role]);
    await db.query(
      `INSERT INTO announcement_targets (announcement_id, role) VALUES ?`,
      [values],
    );
  }

  async updateAnnouncement(
    announcementId: number,
    data: Partial<{
      title: string;
      body: string;
      priority: AnnouncementPriority;
      is_active: boolean;
      start_at: string | null;
      end_at: string | null;
    }>,
    connection?: PoolConnection,
  ): Promise<void> {
    const db = this.getDb(connection);
    const updates: string[] = [];
    const params: any[] = [];
    if (data.title !== undefined) {
      updates.push("title = ?");
      params.push(data.title);
    }
    if (data.body !== undefined) {
      updates.push("body = ?");
      params.push(data.body);
    }
    if (data.priority !== undefined) {
      updates.push("priority = ?");
      params.push(data.priority);
    }
    if (data.is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(data.is_active ? 1 : 0);
    }
    if (data.start_at !== undefined) {
      updates.push("start_at = ?");
      params.push(data.start_at);
    }
    if (data.end_at !== undefined) {
      updates.push("end_at = ?");
      params.push(data.end_at);
    }
    if (!updates.length) return;
    params.push(announcementId);
    await db.query(
      `UPDATE announcements SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = ?`,
      params,
    );
  }

  async getById(
    announcementId: number,
    connection?: PoolConnection,
  ): Promise<Announcement | null> {
    const db = this.getDb(connection);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM announcements WHERE id = ?`,
      [announcementId],
    );
    return (rows[0] as Announcement) || null;
  }

  async listAll(): Promise<Announcement[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM announcements ORDER BY created_at DESC`,
    );
    return rows as Announcement[];
  }

  async listActiveByRole(role: string): Promise<Announcement[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT a.*
      FROM announcements a
      JOIN announcement_targets t ON t.announcement_id = a.id
      WHERE t.role = ?
        AND a.is_active = 1
        AND (a.start_at IS NULL OR a.start_at <= NOW())
        AND (a.end_at IS NULL OR a.end_at >= NOW())
      ORDER BY
        CASE a.priority
          WHEN 'HIGH' THEN 3
          WHEN 'NORMAL' THEN 2
          ELSE 1
        END DESC,
        a.updated_at DESC
      `,
      [role],
    );
    return rows as Announcement[];
  }
}

export const announcementRepository = new AnnouncementRepository();
