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

type RawSupportTicket = SupportTicket & {
  ticket_id?: number;
  createdAt?: string;
  updatedAt?: string | null;
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
  return res.data.data.map((ticket: RawSupportTicket) => ({
    ...ticket,
    id: ticket.id ?? ticket.ticket_id ?? 0,
    created_at: ticket.created_at ?? ticket.createdAt ?? "",
    updated_at: ticket.updated_at ?? ticket.updatedAt ?? null,
  })) as SupportTicket[];
}

export async function listSupportTickets(params?: {
  status?: SupportTicketStatus;
  page?: number;
  limit?: number;
}) {
  const res = await api.get<{ success: boolean; data: { rows: SupportTicket[]; total: number } }>(
    "/support/tickets",
    { params },
  );
  const rows = res.data.data.rows.map((ticket: RawSupportTicket) => ({
    ...ticket,
    id: ticket.id ?? ticket.ticket_id ?? 0,
    created_at: ticket.created_at ?? ticket.createdAt ?? "",
    updated_at: ticket.updated_at ?? ticket.updatedAt ?? null,
  })) as SupportTicket[];
  return { rows, total: res.data.data.total };
}

export async function getSupportTicket(ticketId: number | string) {
  const res = await api.get<{ success: boolean; data: SupportTicket }>(
    `/support/tickets/${ticketId}`,
  );
  const ticket = res.data.data as RawSupportTicket;
  return {
    ...ticket,
    id: ticket.id ?? ticket.ticket_id ?? 0,
    created_at: ticket.created_at ?? ticket.createdAt ?? "",
    updated_at: ticket.updated_at ?? ticket.updatedAt ?? null,
  } as SupportTicket;
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

export type SupportTicketMessage = {
  message_id: number;
  ticket_id: number;
  sender_user_id: number;
  sender_role: string;
  message: string;
  created_at: string;
  attachments?: SupportTicketAttachment[];
};

export async function listSupportTicketMessages(ticketId: number | string) {
  const res = await api.get<{ success: boolean; data: SupportTicketMessage[] }>(
    `/support/tickets/${ticketId}/messages`,
  );
  return res.data.data;
}

export async function createSupportTicketMessage(ticketId: number | string, payload: FormData) {
  const res = await api.post<{ success: boolean; data: { id: number } }>(
    `/support/tickets/${ticketId}/messages`,
    payload,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return res.data.data;
}

export async function createSupportTicketWithAttachments(payload: FormData) {
  const res = await api.post<{ success: boolean; data: { id: number } }>(
    "/support/tickets",
    payload,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return res.data;
}

export async function closeSupportTicket(ticketId: number | string) {
  const res = await api.post<{ success: boolean; message?: string }>(
    `/support/tickets/${ticketId}/close`,
  );
  return res.data;
}

export async function deleteSupportTicket(ticketId: number | string) {
  const res = await api.delete<{ success: boolean; message?: string }>(
    `/support/tickets/${ticketId}`,
  );
  return res.data;
}
