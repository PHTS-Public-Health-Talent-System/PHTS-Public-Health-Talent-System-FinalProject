/**
 * Input Validation Middleware
 *
 * Validates request body field lengths to prevent DoS attacks
 * and database field overflow issues
 */

import { Request, Response, NextFunction } from "express";
import {
  FIELD_LIMITS,
  sanitizeObject,
  validateLength,
} from "@shared/utils/inputValidator.js";

/**
 * Validate input field lengths
 * Prevents extremely large strings from causing performance issues
 */
export const inputValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip GET/HEAD/DELETE requests (no body)
  if (["GET", "HEAD", "DELETE", "OPTIONS"].includes(req.method)) {
    return next();
  }

  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== "object") {
      return next();
    }

    // Validate field lengths for common fields
    validateCommonFields(req.body);

    // Sanitize string inputs
    req.body = sanitizeObject(req.body);

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Input validation failed: ${(error as Error).message}`,
      },
    });
  }
};

/**
 * Validate common fields that appear in most requests
 */
function validateCommonFields(body: Record<string, any>): void {
  const errors: string[] = [];

  // Validate text fields
  if (body.citizen_id) {
    try {
      validateLength(body.citizen_id, "citizen_id", FIELD_LIMITS.CITIZEN_ID);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (body.password) {
    try {
      validateLength(body.password, "password", FIELD_LIMITS.PASSWORD);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (body.comment) {
    try {
      validateLength(body.comment, "comment", FIELD_LIMITS.COMMENT);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (body.reason) {
    try {
      validateLength(body.reason, "reason", FIELD_LIMITS.REJECTION_REASON);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (body.name) {
    try {
      validateLength(body.name, "name", FIELD_LIMITS.NAME);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (body.email) {
    try {
      validateLength(body.email, "email", FIELD_LIMITS.EMAIL);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (body.description) {
    try {
      validateLength(body.description, "description", FIELD_LIMITS.DESCRIPTION);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

/**
 * Validate specific field length
 * Can be used in route handlers for custom validation
 */
export function validateFieldLength(
  value: any,
  fieldName: string,
  maxLength: number,
): void {
  if (typeof value === "string" && value.length > maxLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${maxLength} characters`,
    );
  }
}
