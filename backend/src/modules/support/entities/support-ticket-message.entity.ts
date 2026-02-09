export interface SupportTicketMessage {
  message_id: number;
  ticket_id: number;
  sender_user_id: number;
  sender_role: string;
  message: string;
  created_at: Date;
}
