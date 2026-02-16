/**
 * Error Handler Middleware
 *
 * Centralized error handling with standardized responses
 */

import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  AppError,
  ValidationError,
  buildErrorResponse,
  isOperationalError,
} from '@shared/utils/errors.js';

/**
 * Handle 404 Not Found routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.originalUrl} not found`,
    },
  });
};

/**
 * Global error handler middleware
 * Must be registered last in Express middleware chain
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let normalizedError: Error | AppError = err;

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      normalizedError = new AppError(
        "ขนาดไฟล์เกิน 5MB ต่อไฟล์",
        413,
        "FILE_TOO_LARGE",
      );
    } else if (err.code === "LIMIT_FILE_COUNT") {
      normalizedError = new ValidationError("จำนวนไฟล์เกินกว่าที่ระบบกำหนด");
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      normalizedError = new ValidationError("รูปแบบฟิลด์ไฟล์ไม่ถูกต้อง");
    } else {
      normalizedError = new ValidationError("ไม่สามารถอัปโหลดไฟล์ได้");
    }
  } else if (err.message?.includes("Invalid file type")) {
    normalizedError = new ValidationError("รองรับเฉพาะไฟล์ PDF, JPG และ PNG");
  }

  // Log error
  const isOperational = isOperationalError(normalizedError);

  if (!isOperational) {
    // Programming error - log full stack
    console.error("[ERROR] Unexpected error:", {
      message: normalizedError.message,
      stack: normalizedError.stack,
      method: req.method,
      path: req.originalUrl,
      requestId: req.requestId,
    });
  } else if (process.env.NODE_ENV !== "production") {
    // Operational error in development - log for debugging
    console.error("[ERROR]", {
      message: normalizedError.message,
      method: req.method,
      path: req.originalUrl,
      requestId: req.requestId,
    });
  }

  // Determine status code
  const statusCode = normalizedError instanceof AppError ? normalizedError.statusCode : 500;

  // Build standardized response
  const errorResponse = buildErrorResponse(normalizedError);

  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 * Automatically catches async errors and forwards to error handler
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getAll();
 *   res.json({ success: true, data: users });
 * }));
 */
export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler for express-validator
 */
export const handleValidationErrors = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  // If using express-validator, check for validation errors here
  // For now, just pass through
  next();
};
