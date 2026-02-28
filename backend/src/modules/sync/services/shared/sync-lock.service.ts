import redis from '@config/redis.js';
import type { SyncRuntimeStatus } from '@/modules/sync/services/shared/sync.types.js';

const SYNC_LOCK_KEY = 'system:sync:lock';
const SYNC_RESULT_KEY = 'system:sync:last_result';
const LOCK_TTL_SECONDS = 300;
const LOCK_HEARTBEAT_MS = 60_000;
const RESULT_TTL_SECONDS = 60 * 60 * 24;

const parseLastResult = (data: string | null): Record<string, unknown> | null => {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const createSyncLockValue = (): string => `lock:${Date.now()}`;

export const acquireSyncLock = async (lockValue: string): Promise<boolean> => {
  const locked = await redis.set(SYNC_LOCK_KEY, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX');
  return Boolean(locked);
};

export const startSyncLockHeartbeat = (lockValue: string): NodeJS.Timeout =>
  setInterval(async () => {
    try {
      await redis.set(SYNC_LOCK_KEY, lockValue, 'EX', LOCK_TTL_SECONDS, 'XX');
    } catch (err) {
      console.warn(
        '[SyncService] Failed to refresh sync lock TTL:',
        err instanceof Error ? err.message : err,
      );
    }
  }, LOCK_HEARTBEAT_MS);

export const releaseSyncLock = async (lockValue: string): Promise<void> => {
  try {
    const current = await redis.get(SYNC_LOCK_KEY);
    if (current === lockValue) {
      await redis.del(SYNC_LOCK_KEY);
    }
  } catch (err) {
    console.error('[SyncService] Failed to release sync lock:', err);
  }
};

export const setLastSyncResult = async (payload: unknown): Promise<void> => {
  await redis.set(SYNC_RESULT_KEY, JSON.stringify(payload), 'EX', RESULT_TTL_SECONDS);
};

export const getLastSyncStatus = async (): Promise<SyncRuntimeStatus> => {
  const [data, lock] = await Promise.all([redis.get(SYNC_RESULT_KEY), redis.get(SYNC_LOCK_KEY)]);
  return {
    isSyncing: Boolean(lock),
    lastResult: parseLastResult(data),
  };
};
