export interface SupportTicketMessage {
  message_id: number;
  ticket_id: number;
  sender_user_id: number;
  sender_role: string;
  message: string;
  created_at: Date;
  attachments?: {
    attachment_id: number;
    file_name: string;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    created_at: Date;
  }[];
}
