import api from "@/shared/api/axios";

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

export type SupportTicket = {
  id: number;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  created_at: string;
  updated_at?: string | null;
};

export async function createSupportTicket(payload: CreateSupportTicketPayload) {
  const res = await api.post<{ success: boolean; data: { id: number } }>(
    "/support/tickets",
    payload,
  );
  return res.data;
}

export async function listMySupportTickets() {
  const res = await api.get<{ success: boolean; data: SupportTicket[] }>(
    "/support/tickets/my",
  );
  return res.data.data;
}

export async function listSupportTickets(params?: {
  status?: SupportTicketStatus;
  page?: number;
  pageSize?: number;
}) {
  const res = await api.get<{ success: boolean; data: SupportTicket[] }>(
    "/support/tickets",
    { params },
  );
  return res.data.data;
}

export async function getSupportTicket(ticketId: number | string) {
  const res = await api.get<{ success: boolean; data: SupportTicket }>(
    `/support/tickets/${ticketId}`,
  );
  return res.data.data;
}

export async function updateSupportTicketStatus(
  ticketId: number | string,
  payload: { status: SupportTicketStatus; remark?: string | null },
) {
  const res = await api.put<{ success: boolean; data: SupportTicket }>(
    `/support/tickets/${ticketId}/status`,
    payload,
  );
  return res.data.data;
}

export async function reopenSupportTicket(ticketId: number | string) {
  const res = await api.post<{ success: boolean; data: SupportTicket }>(
    `/support/tickets/${ticketId}/reopen`,
  );
  return res.data.data;
}
