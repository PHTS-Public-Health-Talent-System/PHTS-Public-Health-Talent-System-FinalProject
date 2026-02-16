import { NotificationRepository } from '@/modules/notification/repositories/notification.repository.js';
import { NotificationOutboxRepository } from '@/modules/notification/repositories/notification-outbox.repository.js';
import type { NotificationOutboxPayload } from '@/modules/notification/entities/notification-outbox.entity.js';
import type { PoolConnection } from "mysql2/promise";
import { NotificationType } from '@/modules/notification/entities/notification.entity.js';

export class NotificationOutboxService {
  static async enqueue(
    payload: NotificationOutboxPayload,
    conn?: PoolConnection,
  ): Promise<number> {
    return NotificationOutboxRepository.enqueue(payload, conn);
  }

  static async processBatch(limit: number = 100): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    const conn = await NotificationOutboxRepository.getConnection();
    let processed = 0;
    let sent = 0;
    let failed = 0;

    try {
      await conn.beginTransaction();

      const rows = await NotificationOutboxRepository.fetchPending(limit, conn);
      for (const row of rows) {
        processed += 1;
        try {
          await NotificationOutboxRepository.markProcessing(row.outbox_id, conn);

          const payload = row.payload;
          const title = payload.title;
          const message = payload.message;
          const link = payload.link ?? "#";
          const type = (payload.type as NotificationType) || NotificationType.SYSTEM;

          if (payload.kind === "USER") {
            if (!payload.userId) {
              throw new Error("Missing userId for USER notification");
            }
            await NotificationRepository.create(
              payload.userId,
              title,
              message,
              link,
              type,
              conn,
            );
          } else if (payload.kind === "ROLE") {
            if (!payload.role) {
              throw new Error("Missing role for ROLE notification");
            }
            const userIds = await NotificationRepository.findUserIdsByRole(
              payload.role,
              conn,
            );
            if (userIds.length > 0) {
              const notifications = userIds.map((userId) => ({
                userId,
                title,
                message,
                link,
                type,
              }));
              await NotificationRepository.createBulk(notifications, conn);
            }
          } else {
            throw new Error(`Unknown notification kind: ${payload.kind}`);
          }

          await NotificationOutboxRepository.markSent(row.outbox_id, conn);
          sent += 1;
        } catch (err: any) {
          const msg = err?.message ?? String(err);
          await NotificationOutboxRepository.markFailed(row.outbox_id, msg, conn);
          failed += 1;
        }
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    return { processed, sent, failed };
  }
}
