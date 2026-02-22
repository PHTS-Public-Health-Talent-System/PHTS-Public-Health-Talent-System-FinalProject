import { supportRepository } from "../repositories/support.repository.js";
import type {
  SupportTicket,
  SupportTicketStatus,
} from "../entities/support-ticket.entity.js";
import type { SupportTicketMessage } from "../entities/support-ticket-message.entity.js";
import { NotificationService } from "../../notification/services/notification.service.js";

export class SupportService {
  static async createTicket(input: {
    userId: number;
    citizenId?: string | null;
    subject: string;
    description: string;
    pageUrl?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
    attachments?: {
      uploaded_by: number;
      file_name: string;
      file_path: string;
      file_type: string | null;
      file_size: number | null;
    }[];
  }) {
    const connection = await supportRepository.getConnection();
    let ticketId = 0;
    try {
      await connection.beginTransaction();
      ticketId = await supportRepository.createTicket({
        user_id: input.userId,
        citizen_id: input.citizenId ?? null,
        subject: input.subject,
        description: input.description,
        status: "OPEN",
        page_url: input.pageUrl ?? null,
        user_agent: input.userAgent ?? null,
        metadata: input.metadata ?? null,
      } as Omit<SupportTicket, "ticket_id" | "created_at" | "updated_at" | "resolved_at" | "closed_at">, connection);

      if (input.attachments?.length) {
        await supportRepository.createAttachments(
          input.attachments.map((att) => ({
            ticket_id: ticketId,
            message_id: null,
            uploaded_by: att.uploaded_by,
            file_name: att.file_name,
            file_path: att.file_path,
            file_type: att.file_type,
            file_size: att.file_size,
          })),
          connection,
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await NotificationService.notifyRole(
      "ADMIN",
      "มีคำขอแจ้งปัญหาใหม่",
      `${input.subject}`,
      "/admin/support",
    );

    return ticketId;
  }

  static async listTickets(params: {
    status?: SupportTicketStatus;
    page: number;
    limit: number;
  }) {
    const offset = (params.page - 1) * params.limit;
    return supportRepository.listTickets({
      status: params.status,
      offset,
      limit: params.limit,
    });
  }

  static async listMyTickets(userId: number) {
    return supportRepository.findByUser(userId);
  }

  static async getTicket(ticketId: number) {
    return supportRepository.findById(ticketId);
  }

  static async updateStatus(ticketId: number, status: SupportTicketStatus) {
    await supportRepository.updateStatus(ticketId, status);
  }

  static async close(ticketId: number) {
    await supportRepository.updateStatus(ticketId, "CLOSED");
  }

  static async reopen(ticketId: number) {
    await supportRepository.reopen(ticketId);
  }

  static async listMessages(ticketId: number): Promise<SupportTicketMessage[]> {
    const [messages, attachments] = await Promise.all([
      supportRepository.listMessages(ticketId),
      supportRepository.listAttachmentsByTicket(ticketId),
    ]);

    const ticketLevel = attachments.filter((att) => att.message_id === null);
    const byMessage = new Map<number, typeof attachments>();
    attachments
      .filter((att) => att.message_id !== null)
      .forEach((att) => {
        const messageId = Number(att.message_id);
        const list = byMessage.get(messageId) ?? [];
        list.push(att);
        byMessage.set(messageId, list);
      });

    return messages.map((msg, index) => {
      const current = byMessage.get(msg.message_id) ?? [];
      const seeded = index === 0 ? ticketLevel : [];
      const merged = [...seeded, ...current].map((att) => ({
        attachment_id: att.attachment_id,
        file_name: att.file_name,
        file_path: att.file_path,
        file_type: att.file_type,
        file_size: att.file_size,
        created_at: att.created_at,
      }));
      return {
        ...msg,
        attachments: merged,
      };
    });
  }

  static async createMessage(payload: {
    ticketId: number;
    senderUserId: number;
    senderRole: string;
    message: string;
    attachments?: {
      uploaded_by: number;
      file_name: string;
      file_path: string;
      file_type: string | null;
      file_size: number | null;
    }[];
  }): Promise<number> {
    const connection = await supportRepository.getConnection();
    try {
      await connection.beginTransaction();
      const messageId = await supportRepository.createMessage({
        ticket_id: payload.ticketId,
        sender_user_id: payload.senderUserId,
        sender_role: payload.senderRole,
        message: payload.message,
      }, connection);
      if (payload.attachments?.length) {
        await supportRepository.createAttachments(
          payload.attachments.map((att) => ({
            ticket_id: payload.ticketId,
            message_id: messageId,
            uploaded_by: att.uploaded_by,
            file_name: att.file_name,
            file_path: att.file_path,
            file_type: att.file_type,
            file_size: att.file_size,
          })),
          connection,
        );
      }
      await supportRepository.touch(payload.ticketId, connection);
      await connection.commit();
      return messageId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteTicket(ticketId: number): Promise<void> {
    const connection = await supportRepository.getConnection();
    try {
      await connection.beginTransaction();
      await supportRepository.deleteTicket(ticketId, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
