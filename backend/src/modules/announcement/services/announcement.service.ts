import { AnnouncementPriority } from "../entities/announcement.entity.js";
import { announcementRepository } from "../repositories/announcement.repository.js";
import { NotificationService } from "../../notification/services/notification.service.js";
import { NotificationType } from "../../notification/entities/notification.entity.js";

const priorityToNotificationType: Record<AnnouncementPriority, NotificationType> = {
  LOW: NotificationType.SYSTEM,
  NORMAL: NotificationType.SYSTEM,
  HIGH: NotificationType.REMINDER,
};

export class AnnouncementService {
  static async createAnnouncement(input: {
    title: string;
    body: string;
    priority: AnnouncementPriority;
    is_active: boolean;
    start_at: string | null;
    end_at: string | null;
    roles: string[];
    created_by: number | null;
  }) {
    const connection = await announcementRepository.getConnection();
    try {
      await connection.beginTransaction();
      const announcementId = await announcementRepository.createAnnouncement(
        {
          title: input.title,
          body: input.body,
          priority: input.priority,
          is_active: input.is_active,
          start_at: input.start_at,
          end_at: input.end_at,
          created_by: input.created_by,
        },
        connection,
      );
      await announcementRepository.replaceTargets(
        announcementId,
        input.roles,
        connection,
      );

      await connection.commit();

      if (input.is_active) {
        const type = priorityToNotificationType[input.priority];
        await Promise.all(
          input.roles.map((role) =>
            NotificationService.notifyRole(
              role,
              input.title,
              input.body,
              "/dashboard",
              type,
            ),
          ),
        );
      }

      return announcementId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateAnnouncement(
    announcementId: number,
    input: Partial<{
      title: string;
      body: string;
      priority: AnnouncementPriority;
      is_active: boolean;
      start_at: string | null;
      end_at: string | null;
      roles: string[];
    }>,
  ) {
    const connection = await announcementRepository.getConnection();
    try {
      await connection.beginTransaction();
      await announcementRepository.updateAnnouncement(
        announcementId,
        {
          title: input.title,
          body: input.body,
          priority: input.priority,
          is_active: input.is_active,
          start_at: input.start_at,
          end_at: input.end_at,
        },
        connection,
      );
      if (input.roles) {
        await announcementRepository.replaceTargets(
          announcementId,
          input.roles,
          connection,
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async setActive(
    announcementId: number,
    isActive: boolean,
    roles?: string[],
    priority?: AnnouncementPriority,
  ) {
    await announcementRepository.updateAnnouncement(announcementId, {
      is_active: isActive,
    });
    if (isActive && roles && roles.length > 0) {
      const type = priority
        ? priorityToNotificationType[priority]
        : NotificationType.SYSTEM;
      await Promise.all(
        roles.map((role) =>
          NotificationService.notifyRole(role, "ประกาศใหม่", "มีประกาศใหม่ในระบบ", "/dashboard", type),
        ),
      );
    }
  }
}
