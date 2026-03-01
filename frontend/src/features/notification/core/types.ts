export type Notification = {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
};

export type NotificationData = {
  notifications: Notification[];
  unreadCount: number;
};

export type NotificationSettings = {
  in_app: boolean;
  sms: boolean;
  email: boolean;
};
