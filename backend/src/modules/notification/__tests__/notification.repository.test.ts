import { NotificationRepository } from '@/modules/notification/repositories/notification.repository.js';
import {
  resetNotificationSchema,
  getTestConnection,
} from '@/test/test-db.js';

jest.setTimeout(30000);

describe("NotificationRepository (integration)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await resetNotificationSchema();
  });

  test("create/find/count/mark read lifecycle", async () => {
    const conn = await getTestConnection();
    try {
      await conn.execute(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["900", "hash", "PTS_OFFICER", 1],
      );
    } finally {
      await conn.end();
    }

    const userIds = await NotificationRepository.findUserIdsByRole(
      "PTS_OFFICER",
    );
    expect(userIds.length).toBe(1);
    const userId = userIds[0];

    const notificationId = await NotificationRepository.create(
      userId,
      "Title",
      "Message",
      "/",
    );
    const unread = await NotificationRepository.countUnread(userId);
    expect(unread).toBe(1);

    const item = await NotificationRepository.findById(notificationId);
    expect(item?.title).toBe("Title");

    const marked = await NotificationRepository.markAsRead(
      notificationId,
      userId,
    );
    expect(marked).toBe(true);

    const unreadAfter = await NotificationRepository.countUnread(userId);
    expect(unreadAfter).toBe(0);
  });

  test("upsert settings creates and updates rows", async () => {
    const conn = await getTestConnection();
    let userId: number;
    try {
      const [result] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["901", "hash", "USER", 1],
      );
      userId = Number(result.insertId);
    } finally {
      await conn.end();
    }

    await NotificationRepository.upsertSettings(userId, {
      in_app: true,
      sms: false,
      email: true,
    });
    const settings = await NotificationRepository.getSettingsByUserId(userId);
    expect(settings?.in_app).toBe(true);
    expect(settings?.sms).toBe(false);
    expect(settings?.email).toBe(true);

    await NotificationRepository.upsertSettings(userId, {
      in_app: false,
      sms: true,
      email: false,
    });
    const settingsUpdated =
      await NotificationRepository.getSettingsByUserId(userId);
    expect(settingsUpdated?.in_app).toBe(false);
    expect(settingsUpdated?.sms).toBe(true);
    expect(settingsUpdated?.email).toBe(false);
  });
});
