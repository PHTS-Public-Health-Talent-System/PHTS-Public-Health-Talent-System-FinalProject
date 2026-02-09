/**
 * Notification Module - Service
 *
 * Business logic for notification operations
 */

import { PoolConnection } from "mysql2/promise";
import { NotificationRepository } from '@/modules/notification/repositories/notification.repository.js';
import { NotificationOutboxService } from '@/modules/notification/services/notification-outbox.service.js';
import {
  NotificationType,
  NotificationWithCount,
  NotificationSettings,
} from '@/modules/notification/entities/notification.entity.js';

export class NotificationService {
  /**
   * Send notification to a specific user
   */
  static async notifyUser(
    userId: number,
    title: string,
    message: string,
    link: string = "#",
    type: string = "SYSTEM",
    connection?: PoolConnection,
  ): Promise<number> {
    const notificationType =
      (type as NotificationType) || NotificationType.SYSTEM;
    return NotificationOutboxService.enqueue(
      {
        kind: "USER",
        userId,
        title,
        message,
        link,
        type: notificationType,
      },
      connection,
    );
  }

  /**
   * Send notification to all users with a specific role
   */
  static async notifyRole(
    role: string,
    title: string,
    message: string,
    link: string = "#",
    type: NotificationType = NotificationType.SYSTEM,
    connection?: PoolConnection,
  ): Promise<number> {
    return NotificationOutboxService.enqueue(
      {
        kind: "ROLE",
        role,
        title,
        message,
        link,
        type,
      },
      connection,
    );
  }

  /**
   * Get notifications for a user with unread count
   */
  static async getMyNotifications(
    userId: number,
    limit: number = 20,
  ): Promise<NotificationWithCount> {
    const [notifications, unreadCount] = await Promise.all([
      NotificationRepository.findByUserId(userId, limit),
      NotificationRepository.countUnread(userId),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: number): Promise<number> {
    return NotificationRepository.countUnread(userId);
  }

  /**
   * Get unread notification count for today
   */
  static async getUnreadCountToday(userId: number): Promise<number> {
    return NotificationRepository.countUnreadToday(userId);
  }

  /**
   * Get notification settings for a user (defaults if missing)
   */
  static async getNotificationSettings(
    userId: number,
  ): Promise<NotificationSettings> {
    const settings = await NotificationRepository.getSettingsByUserId(userId);
    if (settings) return settings;
    return {
      user_id: userId,
      in_app: true,
      sms: false,
      email: false,
    };
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(
    userId: number,
    settings: { in_app: boolean; sms: boolean; email: boolean },
  ): Promise<NotificationSettings> {
    await NotificationRepository.upsertSettings(userId, settings);
    return {
      user_id: userId,
      ...settings,
    };
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(
    notificationId: number,
    userId: number,
  ): Promise<boolean> {
    return NotificationRepository.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: number): Promise<number> {
    return NotificationRepository.markAllAsRead(userId);
  }

  /**
   * Delete read notifications for a user
   */
  static async deleteRead(
    userId: number,
    olderThanDays?: number,
  ): Promise<number> {
    return NotificationRepository.deleteRead(userId, olderThanDays);
  }

  /**
   * Delete old notifications (cleanup job)
   */
  static async cleanupOldNotifications(days: number = 90): Promise<number> {
    return NotificationRepository.deleteOlderThan(days);
  }
}
