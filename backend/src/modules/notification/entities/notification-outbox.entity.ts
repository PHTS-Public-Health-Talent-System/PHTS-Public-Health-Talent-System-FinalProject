export type NotificationOutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export type NotificationOutboxPayload = {
  kind: "USER" | "ROLE";
  userId?: number;
  role?: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
};

export interface NotificationOutboxRecord {
  outbox_id: number;
  payload: NotificationOutboxPayload;
  status: NotificationOutboxStatus;
  attempts: number;
  last_error: string | null;
  available_at: Date;
  created_at: Date;
  processed_at: Date | null;
}
