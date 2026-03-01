export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export type CreateSupportTicketPayload = {
  subject: string;
  description: string;
  page_url?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SupportTicketAttachment = {
  attachment_id: number;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
};

export type SupportTicket = {
  id: number;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  created_at: string;
  updated_at?: string | null;
};

export type SupportTicketMessage = {
  message_id: number;
  ticket_id: number;
  sender_user_id: number;
  sender_role: string;
  message: string;
  created_at: string;
  attachments?: SupportTicketAttachment[];
};
