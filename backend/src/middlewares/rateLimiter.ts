import rateLimit from "express-rate-limit";

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const max = Number(process.env.RATE_LIMIT_MAX || 300);
const authWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 5);

export const apiRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
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
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    error: "Too many login attempts, please try again later.",
  },
});
