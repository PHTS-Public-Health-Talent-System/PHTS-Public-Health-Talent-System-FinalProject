import { NotificationOutboxService } from '@/modules/notification/services/notification-outbox.service.js';

async function main(): Promise<void> {
  const result = await NotificationOutboxService.processBatch(200);
  console.log("[notification-outbox]", result);
}

main().catch((error) => {
  console.error("Notification outbox processor failed:", error);
  process.exit(1);
});
