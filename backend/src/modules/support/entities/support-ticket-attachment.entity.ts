export interface SupportTicketAttachment {
  attachment_id: number;
  ticket_id: number;
  message_id: number | null;
  uploaded_by: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: Date;
}

