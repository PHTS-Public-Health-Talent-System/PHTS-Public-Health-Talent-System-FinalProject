export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export interface SupportTicket {
  ticket_id: number;
  user_id: number;
  citizen_id: string | null;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  page_url: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  closed_at: Date | null;
}
