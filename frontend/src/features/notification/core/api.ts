/**
 * notification module - API client
 *
 */
import api from "@/shared/api/axios";
import { ApiResponse } from "@/shared/api/types";
import type { Notification, NotificationData, NotificationSettings } from "./types";

type RawNotification = Notification & {
  notification_id?: number;
};

export async function getMyNotifications() {
  const res = await api.get<ApiResponse<NotificationData>>("/notifications");
  const data = res.data.data;
  return {
    ...data,
    notifications: data.notifications.map((notification: RawNotification) => ({
      ...notification,
      id: notification.id ?? notification.notification_id ?? 0,
    })),
  } as NotificationData;
}

export async function markNotificationRead(id: number | string) {
  await api.put(`/notifications/${id}/read`);
}

export async function getNotificationSettings() {
  const res = await api.get<ApiResponse<NotificationSettings>>(
    "/notifications/settings",
  );
  return res.data.data;
}

export async function updateNotificationSettings(
  payload: NotificationSettings,
) {
  const res = await api.put<ApiResponse<NotificationSettings>>(
    "/notifications/settings",
    payload,
  );
  return res.data.data;
}

export async function deleteReadNotifications(payload?: {
  older_than_days?: number;
}) {
  const res = await api.delete<ApiResponse<{ deletedCount: number }>>(
    "/notifications/read",
    {
      data: payload ?? {},
    },
  );
  return res.data.data;
}
