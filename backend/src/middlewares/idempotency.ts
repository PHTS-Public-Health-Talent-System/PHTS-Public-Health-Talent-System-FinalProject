import type { NextFunction, Request, Response } from "express";
import redis from '@config/redis.js';

const IDEM_HEADER = "idempotency-key";
const DEFAULT_TTL_SECONDS = 10 * 60; // 10 minutes
const LOCK_TTL_SECONDS = 60;

type CachedResponse = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  requestHash?: string;
};

const buildKey = (req: Request, key: string) => {
  const userId = req.user?.userId ?? "anonymous";
  const path = req.originalUrl.split("?")[0];
  return `idem:${userId}:${req.method}:${path}:${key}`;
};

const buildLockKey = (cacheKey: string) => `lock:${cacheKey}`;

const stableStringify = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null);
  } catch (_err) {
    return "";
  }
};

export function idempotency(ttlSeconds: number = DEFAULT_TTL_SECONDS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.header(IDEM_HEADER);
    if (!rawKey) return next();

    const key = rawKey.trim();
    if (!key || key.length > 128) {
      res.status(400).json({ success: false, error: "Invalid Idempotency-Key" });
      return;
    }

    const cacheKey = buildKey(req, key);
    const lockKey = buildLockKey(cacheKey);

    const requestHash = stableStringify(req.body);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedResponse;
        if (parsed.requestHash && parsed.requestHash !== requestHash) {
          res.status(409).json({
            success: false,
            error: "Idempotency-Key payload mismatch",
          });
          return;
        }

        Object.entries(parsed.headers || {}).forEach(([name, value]) => {
          if (value) res.setHeader(name, value);
        });
        res.status(parsed.status).json(parsed.body);
        return;
      }

      const locked = await redis.set(
        lockKey,
        String(Date.now()),
        "EX",
        LOCK_TTL_SECONDS,
        "NX",
      );
      if (!locked) {
        res.status(409).json({
          success: false,
          error: "Request already in progress",
        });
        return;
      }
    } catch (_err) {
      // Fail open if redis is unavailable
      return next();
    }

    let responseBody: unknown;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = ((body: unknown) => {
      responseBody = body;
      return originalJson(body);
    }) as typeof res.json;

    res.send = ((body: unknown) => {
      responseBody = body;
      return originalSend(body);
    }) as typeof res.send;

    res.on("finish", async () => {
      try {
        const payload: CachedResponse = {
          status: res.statusCode,
          body: responseBody ?? { success: false, error: "Empty response" },
          headers: {
            "content-type": String(res.getHeader("content-type") ?? ""),
          },
          requestHash,
        };
        await redis.set(cacheKey, JSON.stringify(payload), "EX", ttlSeconds);
        await redis.del(lockKey);
      } catch (_err) {
        // Ignore cache errors
      }
    });

    return next();
  };
}
