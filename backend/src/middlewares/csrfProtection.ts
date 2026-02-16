/**
 * CSRF Protection Middleware
 *
 * Implements token-based CSRF protection
 * For GET/HEAD/OPTIONS: Generates and returns CSRF token in response header
 * For POST/PUT/DELETE/PATCH: Validates CSRF token from request header
 *
 * Client should:
 * 1. Store token from X-CSRF-Token response header in localStorage/memory
 * 2. Send token in X-CSRF-Token request header for state-changing requests
 */

import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const CSRF_TOKEN_CACHE = new Map<string, { token: string; timestamp: number }>();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a random CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Get or create a CSRF token for a user session
 * Uses request ID as session identifier
 */
function getSessionToken(requestId: string): string {
  const cached = CSRF_TOKEN_CACHE.get(requestId);
  const now = Date.now();

  // Return cached token if not expired
  if (cached && now - cached.timestamp < TOKEN_EXPIRY) {
    return cached.token;
  }

  // Generate new token
  const token = generateToken();
  CSRF_TOKEN_CACHE.set(requestId, { token, timestamp: now });

  // Cleanup old entries periodically
  if (CSRF_TOKEN_CACHE.size > 10000) {
    for (const [key, value] of CSRF_TOKEN_CACHE.entries()) {
      if (now - value.timestamp > TOKEN_EXPIRY) {
        CSRF_TOKEN_CACHE.delete(key);
      }
    }
  }

  return token;
}

/**
 * CSRF Protection Middleware
 *
 * For safe requests (GET, HEAD, OPTIONS): Returns CSRF token in header
 * For state-changing requests: Validates CSRF token from header
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = (req as any).requestId || "unknown";

  // Skip CSRF validation for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    const token = getSessionToken(requestId);
    // Return token in response header for client to use
    res.setHeader(CSRF_HEADER_NAME, token);
    return next();
  }

  // For state-changing requests, validate CSRF token
  const tokenFromHeader = req.headers[CSRF_HEADER_NAME] as string;

  if (!tokenFromHeader) {
    return res.status(403).json({
      success: false,
      error: {
        code: "CSRF_TOKEN_MISSING",
        message:
          "CSRF token must be provided in X-CSRF-Token request header for state-changing operations",
      },
    });
  }

  // Get the stored token for this session
  const storedToken = getSessionToken(requestId);

  // Validate token using constant-time comparison
  const storedBuffer = Buffer.from(storedToken);
  const headerBuffer = Buffer.from(tokenFromHeader);

  if (
    storedBuffer.length !== headerBuffer.length ||
    !crypto.timingSafeEqual(storedBuffer, headerBuffer)
  ) {
    return res.status(403).json({
      success: false,
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "CSRF token validation failed. Token may have expired.",
      },
    });
  }

  // Token is valid - generate new token for next request
  getSessionToken(requestId); // Refresh token timestamp
  next();
};

/**
 * Middleware to disable CSRF protection for specific routes
 * Useful for webhooks, API integrations, or endpoints that don't need CSRF protection
 */
export const disableCsrf = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  (_req as any).skipCsrf = true;
  next();
};
