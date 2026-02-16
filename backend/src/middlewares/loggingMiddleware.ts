/**
 * Logging Middleware
 *
 * Automatically logs all HTTP requests and responses
 * Captures method, path, status code, and response time
 */

import { Request, Response, NextFunction } from "express";
import Logger from '@shared/utils/logger.js';

const logger = Logger.create("HTTP");

/**
 * HTTP request logging middleware
 * Logs request details and response time
 */
export const loggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = Date.now();
  const requestId = (req as any).requestId || "unknown";

  // Capture the original res.json method
  const originalJson = res.json;

  // Override res.json to log response
  res.json = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log the request/response
    logger.logRequest(req.method, req.originalUrl, statusCode, duration, {
      requestId,
      userId: (req as any).user?.userId,
    });

    // Call the original json method
    return originalJson.call(this, data);
  };

  // Call next middleware
  next();
};

/**
 * Error logging middleware
 * Logs all errors that occur during request processing
 */
export const errorLoggingMiddleware = (
  err: Error,
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const requestId = (req as any).requestId || "unknown";

  logger.error(
    `Request error: ${req.method} ${req.originalUrl}`,
    err,
    {
      requestId,
      userId: (req as any).user?.userId,
      method: req.method,
      path: req.originalUrl,
    },
  );

  // Pass error to next middleware
  next(err);
};

/**
 * Request ID logger middleware
 * Logs when a request comes in with unique ID
 */
export const requestIdLogger = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const requestId = (req as any).requestId || "unknown";

  // Only log for non-health-check requests
  if (!req.path.includes("/health") && !req.path.includes("/ready")) {
    logger.debug(`[${req.method}] ${req.path}`, {
      requestId,
      userId: (req as any).user?.userId,
    });
  }

  next();
};
