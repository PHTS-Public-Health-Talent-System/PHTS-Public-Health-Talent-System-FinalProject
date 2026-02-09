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
  }) {
    const ticketId = await supportRepository.createTicket({
      user_id: input.userId,
      citizen_id: input.citizenId ?? null,
      subject: input.subject,
      description: input.description,
      status: "OPEN",
      page_url: input.pageUrl ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
    } as Omit<SupportTicket, "ticket_id" | "created_at" | "updated_at" | "resolved_at" | "closed_at">);

    await NotificationService.notifyRole(
      "ADMIN",
      "มีคำขอแจ้งปัญหาใหม่",
      `${input.subject}`,
      "/dashboard/admin/support",
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

  static async reopen(ticketId: number) {
    await supportRepository.reopen(ticketId);
  }

  static async listMessages(ticketId: number): Promise<SupportTicketMessage[]> {
    return supportRepository.listMessages(ticketId);
  }

  static async createMessage(payload: {
    ticketId: number;
    senderUserId: number;
    senderRole: string;
    message: string;
  }): Promise<number> {
    const messageId = await supportRepository.createMessage({
      ticket_id: payload.ticketId,
      sender_user_id: payload.senderUserId,
      sender_role: payload.senderRole,
      message: payload.message,
    });
    await supportRepository.touch(payload.ticketId);
    return messageId;
  }
}
