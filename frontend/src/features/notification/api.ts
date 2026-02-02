import api from '@/shared/api/axios';
import { ApiResponse } from '@/shared/api/types';

export interface Notification {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationData {
  notifications: Notification[];
  unreadCount: number;
}

export async function getMyNotifications() {
  const res = await api.get<ApiResponse<NotificationData>>('/notifications');
  return res.data.data;
}

export async function markNotificationRead(id: number | string) {
  await api.put(`/notifications/${id}/read`);
}

export interface NotificationSettings {
  in_app: boolean;
  sms: boolean;
  email: boolean;
}

export async function getNotificationSettings() {
  const res = await api.get<ApiResponse<NotificationSettings>>('/notifications/settings');
  return res.data.data;
}

export async function updateNotificationSettings(payload: NotificationSettings) {
  const res = await api.put<ApiResponse<NotificationSettings>>('/notifications/settings', payload);
  return res.data.data;
}
