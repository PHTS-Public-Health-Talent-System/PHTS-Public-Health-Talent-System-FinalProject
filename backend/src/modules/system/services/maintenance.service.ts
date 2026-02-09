/**
 * Maintenance Mode Service
 *
 * Uses Redis to persist maintenance mode state across restarts and instances
 */

import redis from '@config/redis.js';

const MAINTENANCE_KEY = 'system:maintenance:enabled';

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  if (enabled) {
    await redis.set(MAINTENANCE_KEY, '1');
  } else {
    await redis.del(MAINTENANCE_KEY);
  }
}

export async function isMaintenanceModeEnabled(): Promise<boolean> {
  const value = await redis.get(MAINTENANCE_KEY);
  return value === '1';
}
