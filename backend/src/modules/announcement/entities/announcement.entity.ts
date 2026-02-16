export type AnnouncementPriority = "LOW" | "NORMAL" | "HIGH";

export interface Announcement {
  id: number;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  is_active: boolean;
  start_at: Date | null;
  end_at: Date | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface AnnouncementTarget {
  announcement_id: number;
  role: string;
}
