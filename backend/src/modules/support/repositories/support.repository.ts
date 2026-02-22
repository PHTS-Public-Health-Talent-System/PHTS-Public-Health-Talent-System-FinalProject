import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import pool from '@config/database.js';
import type {
  SupportTicket,
  SupportTicketStatus,
} from "../entities/support-ticket.entity.js";
import type { SupportTicketMessage } from "../entities/support-ticket-message.entity.js";
import type { SupportTicketAttachment } from "../entities/support-ticket-attachment.entity.js";

export class SupportRepository {
  private getDb(connection?: PoolConnection) {
    return connection || pool;
  }

  private parseMetadata(raw: unknown) {
    if (raw == null) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (typeof raw === "object") return raw;
    return null;
  }

  async createTicket(
    data: Omit<
      SupportTicket,
      "ticket_id" | "created_at" | "updated_at" | "resolved_at" | "closed_at"
    >,
    connection?: PoolConnection,
  ): Promise<number> {
    const db = this.getDb(connection);
    const [result]: any = await db.execute(
      `INSERT INTO support_tickets
       (user_id, citizen_id, subject, description, status, page_url, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.citizen_id ?? null,
        data.subject,
        data.description,
        data.status,
        data.page_url ?? null,
        data.user_agent ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ],
    );
    return result.insertId as number;
  }

  async findById(ticketId: number): Promise<SupportTicket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM support_tickets WHERE ticket_id = ? LIMIT 1`,
      [ticketId],
    );
    if (!rows.length) return null;
    const row = rows[0] as SupportTicket;
    row.metadata = this.parseMetadata(row.metadata);
    return row;
  }

  async findByUser(userId: number): Promise<SupportTicket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((row) => ({
      ...(row as SupportTicket),
      metadata: this.parseMetadata((row as SupportTicket).metadata),
    }));
  }

  async listTickets(params: {
    status?: SupportTicketStatus;
    offset: number;
    limit: number;
  }): Promise<{ rows: SupportTicket[]; total: number }> {
    const where = params.status ? "WHERE status = ?" : "";
    const args = params.status ? [params.status] : [];

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM support_tickets ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, params.limit, params.offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM support_tickets ${where}`,
      args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    return {
      rows: rows.map((row) => ({
        ...(row as SupportTicket),
        metadata: this.parseMetadata((row as SupportTicket).metadata),
      })),
      total,
    };
  }

  async updateStatus(
    ticketId: number,
    status: SupportTicketStatus,
    connection?: PoolConnection,
  ): Promise<void> {
    const db = this.getDb(connection);
    await db.execute(
      `UPDATE support_tickets
       SET status = ?,
           resolved_at = CASE WHEN ? = 'RESOLVED' THEN NOW() ELSE resolved_at END,
           closed_at = CASE WHEN ? = 'CLOSED' THEN NOW() ELSE closed_at END,
           updated_at = NOW()
       WHERE ticket_id = ?`,
      [status, status, status, ticketId],
    );
  }

  async reopen(ticketId: number, connection?: PoolConnection): Promise<void> {
    const db = this.getDb(connection);
    await db.execute(
      `UPDATE support_tickets
       SET status = 'REOPENED', resolved_at = NULL, closed_at = NULL, updated_at = NOW()
       WHERE ticket_id = ?`,
      [ticketId],
    );
  }

  async touch(ticketId: number, connection?: PoolConnection): Promise<void> {
    const db = this.getDb(connection);
    await db.execute(
      `UPDATE support_tickets SET updated_at = NOW() WHERE ticket_id = ?`,
      [ticketId],
    );
  }

  async listMessages(ticketId: number): Promise<SupportTicketMessage[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM support_ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId],
    );
    return rows as SupportTicketMessage[];
  }

  async createMessage(
    payload: Omit<SupportTicketMessage, "message_id" | "created_at">,
    connection?: PoolConnection,
  ): Promise<number> {
    const db = this.getDb(connection);
    const [result]: any = await db.execute(
      `INSERT INTO support_ticket_messages (ticket_id, sender_user_id, sender_role, message)
       VALUES (?, ?, ?, ?)`,
      [payload.ticket_id, payload.sender_user_id, payload.sender_role, payload.message],
    );
    return result.insertId as number;
  }

  async createAttachments(
    payloads: Omit<SupportTicketAttachment, "attachment_id" | "created_at">[],
    connection?: PoolConnection,
  ): Promise<void> {
    if (!payloads.length) return;
    const db = this.getDb(connection);
    for (const payload of payloads) {
      await db.execute(
        `INSERT INTO support_ticket_attachments
         (ticket_id, message_id, uploaded_by, file_name, file_path, file_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.ticket_id,
          payload.message_id,
          payload.uploaded_by,
          payload.file_name,
          payload.file_path,
          payload.file_type ?? null,
          payload.file_size ?? null,
        ],
      );
    }
  }

  async listAttachmentsByTicket(ticketId: number): Promise<SupportTicketAttachment[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM support_ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId],
    );
    return rows as SupportTicketAttachment[];
  }

  async deleteTicket(ticketId: number, connection?: PoolConnection): Promise<void> {
    const db = this.getDb(connection);
    await db.execute(`DELETE FROM support_ticket_attachments WHERE ticket_id = ?`, [ticketId]);
    await db.execute(`DELETE FROM support_ticket_messages WHERE ticket_id = ?`, [ticketId]);
    await db.execute(`DELETE FROM support_tickets WHERE ticket_id = ?`, [ticketId]);
  }

  async getConnection(): Promise<PoolConnection> {
    return pool.getConnection();
  }
}

export const supportRepository = new SupportRepository();
