import { SyncService } from '@/modules/sync/services/sync.service.js';

async function main() {
  console.log("[SyncScript] Starting smart sync via SyncService...");
  try {
    const result = await SyncService.performFullSync();
    console.log("[SyncScript] Sync finished:", JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("[SyncScript] Sync failed:", error);
    process.exit(1);
  }
}

main();
