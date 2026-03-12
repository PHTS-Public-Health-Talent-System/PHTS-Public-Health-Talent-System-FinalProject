import rateLimit from "express-rate-limit";

const getNodeEnv = () => String(process.env.NODE_ENV || "development").toLowerCase();
const isDevelopment = () => getNodeEnv() === "development";
const isProduction = () => getNodeEnv() === "production";
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const max = Number(process.env.RATE_LIMIT_MAX || (isProduction() ? 300 : 1000));
const authWindowMs = Number(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
);
const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 5);
const isDevRateLimitEnabled = () =>
  String(process.env.DEV_ENABLE_RATE_LIMIT || "").toLowerCase() === "true";

const firstHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  if (typeof value === "string") return value.trim() || null;
  return null;
};

const getClientKey = (req: { headers?: Record<string, string | string[] | undefined>; ip?: string }) => {
  const cfIp = firstHeaderValue(req.headers?.["cf-connecting-ip"]);
  if (cfIp) return `ip:${cfIp}`;

  const realIp = firstHeaderValue(req.headers?.["x-real-ip"]);
  if (realIp) return `ip:${realIp}`;

  const forwarded = firstHeaderValue(req.headers?.["x-forwarded-for"]);
  const forwardedIp = forwarded?.split(",")[0]?.trim();
  if (forwardedIp) return `ip:${forwardedIp}`;

  const ip = (req.ip || "").trim();
  return `ip:${ip || "unknown"}`;
};

const shouldSkipRateLimitInDevelopment = () => isDevelopment() && !isDevRateLimitEnabled();

type RateLimitedRequest = {
  rateLimit?: {
    resetTime?: Date;
  };
};

export const apiRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientKey(req),
  skip: (req) =>
    process.env.NODE_ENV === "test" ||
    shouldSkipRateLimitInDevelopment() ||
    String(req.path ?? "").startsWith("/auth"),
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});

export const authRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientKey(req),
  skip: () => process.env.NODE_ENV === "test" || shouldSkipRateLimitInDevelopment(),
  handler: (req, res) => {
    const requestWithRateLimit = req as typeof req & RateLimitedRequest;
    const now = Date.now();
    const resetTime =
      requestWithRateLimit.rateLimit?.resetTime instanceof Date
        ? requestWithRateLimit.rateLimit.resetTime.getTime()
        : now + authWindowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
    const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      error: "Too many login attempts, please try again later.",
      message: `Too many login attempts. Please try again in about ${retryAfterMinutes} minute(s).`,
      retry_after_seconds: retryAfterSeconds,
      retry_after_minutes: retryAfterMinutes,
    });
  },
});
