/**
 * Distributed Lock Service
 *
 * Prevents concurrent operations on shared resources using Redis
 * Useful for preventing race conditions in approval workflows
 */

import redisClient from '@config/redis.js';

const DEFAULT_LOCK_TTL = 5 * 60; // 5 minutes
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 100; // ms

export interface LockAcquireOptions {
  ttl?: number; // Time to live in seconds
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Acquire a distributed lock
 *
 * @param key The lock key (e.g., "request:123:approval")
 * @param holder Identifier of the lock holder (e.g., userId)
 * @param options Lock options
 * @returns Lock value if acquired, null if failed
 */
export async function acquireLock(
  key: string,
  holder: string,
  options: LockAcquireOptions = {},
): Promise<string | null> {
  const ttl = options.ttl ?? DEFAULT_LOCK_TTL;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;

  const timestamp = Date.now();
  const random = Math.random();
  const lockValue = `${holder}-${timestamp}-${random}`;
  const lockKey = `lock:${key}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Try to set lock only if it doesn't exist (NX = Only if Not eXists)
    const result = await redisClient.set(lockKey, lockValue, "EX", ttl, "NX");

    if (result === "OK") {
      return lockValue;
    }

    // Wait before retrying
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return null;
}

/**
 * Release a distributed lock
 *
 * @param key The lock key
 * @param lockValue The lock value to verify ownership
 * @returns true if lock was released, false if lock value didn't match
 */
export async function releaseLock(key: string, lockValue: string): Promise<boolean> {
  const lockKey = `lock:${key}`;
  const currentValue = await redisClient.get(lockKey);

  if (currentValue === lockValue) {
    await redisClient.del(lockKey);
    return true;
  }

  return false;
}

/**
 * Execute function with lock protection
 * Automatically acquires and releases lock
 *
 * @param key The lock key
 * @param holder Lock holder identifier
 * @param fn Function to execute
 * @param options Lock options
 * @returns Function result or throws error if lock cannot be acquired
 */
export async function withLock<T>(
  key: string,
  holder: string,
  fn: () => Promise<T>,
  options: LockAcquireOptions = {},
): Promise<T> {
  const lockValue = await acquireLock(key, holder, options);

  if (!lockValue) {
    throw new Error(
      `Failed to acquire lock for ${key}. Resource is being accessed by another process.`,
    );
  }

  try {
    return await fn();
  } finally {
    await releaseLock(key, lockValue);
  }
}
