import { SyncService } from "@/modules/system/sync/services/sync.service.js";

export const getSyncRuntimeStatus = async () => {
  return SyncService.getLastSyncStatus();
};
