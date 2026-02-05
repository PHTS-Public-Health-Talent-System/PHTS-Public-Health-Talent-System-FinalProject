import api from "@/shared/api/axios";

export type AnnouncementPriority = "LOW" | "NORMAL" | "HIGH";

export interface Announcement {
  id: number;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const res = await api.get<{ success: boolean; data: Announcement[] }>(
    "/announcements/active",
  );
  return res.data.data ?? [];
}

export async function getAllAnnouncements(): Promise<Announcement[]> {
  const res = await api.get<{ success: boolean; data: Announcement[] }>(
    "/announcements",
  );
  return res.data.data ?? [];
}

export async function createAnnouncement(payload: Omit<Announcement, "id" | "created_at" | "updated_at">) {
  const res = await api.post<{ success: boolean; data: Announcement }>(
    "/announcements",
    payload,
  );
  return res.data.data;
}

export async function updateAnnouncement(id: number | string, payload: Partial<Announcement>) {
  const res = await api.put<{ success: boolean; data: Announcement }>(
    `/announcements/${id}`,
    payload,
  );
  return res.data.data;
}

export async function activateAnnouncement(id: number | string) {
  const res = await api.put<{ success: boolean; data: Announcement }>(
    `/announcements/${id}/activate`,
  );
  return res.data.data;
}

export async function deactivateAnnouncement(id: number | string) {
  const res = await api.put<{ success: boolean; data: Announcement }>(
    `/announcements/${id}/deactivate`,
  );
  return res.data.data;
}

export async function deleteAnnouncement(id: number | string) {
  const res = await api.delete<{ success: boolean }>(`/announcements/${id}`);
  return res.data;
}
