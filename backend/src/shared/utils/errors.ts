/**
 * Custom Error Classes
 *
 * Standardized error handling for the application
 * Each error type maps to specific HTTP status codes
 */

// ============================================================================
// Base Application Error
// ============================================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// ============================================================================
// HTTP Error Classes (4xx)
// ============================================================================

/**
 * 400 Bad Request - Invalid input data
 */
export class ValidationError extends AppError {
  constructor(
    message = "ข้อมูลไม่ถูกต้อง",
    details?: Record<string, unknown>,
  ) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

/**
 * 401 Unauthorized - Not authenticated
 */
export class AuthenticationError extends AppError {
  constructor(message = "กรุณาเข้าสู่ระบบ") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

/**
 * 403 Forbidden - Not authorized
 */
export class AuthorizationError extends AppError {
  constructor(message = "ไม่มีสิทธิ์ดำเนินการนี้") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(resource = "ข้อมูล", identifier?: string | number) {
    const message = identifier
      ? `ไม่พบ${resource} (${identifier})`
      : `ไม่พบ${resource}`;
    super(message, 404, "NOT_FOUND", { resource, identifier });
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(message = "ข้อมูลซ้ำซ้อนหรือสถานะไม่ถูกต้อง") {
    super(message, 409, "CONFLICT_ERROR");
  }
}

/**
 * 422 Unprocessable Entity - Business logic error
 */
export class BusinessError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, "BUSINESS_ERROR", details);
  }
}

// ============================================================================
// Server Error Classes (5xx)
// ============================================================================

/**
 * 500 Internal Server Error - Database error
 */
export class DatabaseError extends AppError {
  constructor(
    message = "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล",
    originalError?: Error,
  ) {
    super(message, 500, "DATABASE_ERROR", {
      originalMessage: originalError?.message,
    });
  }
}

/**
 * 503 Service Unavailable - External service error
 */
export class ServiceUnavailableError extends AppError {
  constructor(service = "ระบบ") {
    super(`${service}ไม่พร้อมใช้งานชั่วคราว`, 503, "SERVICE_UNAVAILABLE");
  }
}

// ============================================================================
// Domain-Specific Errors
// ============================================================================

/**
 * Request workflow errors
 */
export class RequestError extends AppError {
  constructor(message: string, requestId?: number) {
    super(message, 422, "REQUEST_ERROR", { requestId });
  }
}

/**
 * Approval workflow errors
 */
export class ApprovalError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, "APPROVAL_ERROR", details);
  }
}

/**
 * Payroll calculation errors
 */
export class PayrollError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, "PAYROLL_ERROR", details);
  }
}

// ============================================================================
// Error Response Builder
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Build standardized error response
 */
export function buildErrorResponse(error: Error | AppError): ErrorResponse {
  if (error instanceof AppError) {
    return error.toJSON() as ErrorResponse;
  }

  // Unknown error - don't expose details in production
  const isProduction = process.env.NODE_ENV === "production";

  return {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction ? "เกิดข้อผิดพลาดภายในระบบ" : error.message,
      ...(!isProduction && { details: { stack: error.stack } }),
    },
  };
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Wrap async function to catch errors
 * Useful for route handlers
 */
export function catchAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): T {
  return ((...args: Parameters<T>) => {
    return Promise.resolve(fn(...args)).catch(args[2]); // args[2] is next() in Express
  }) as T;
}

/**
 * Assert condition or throw ValidationError
 */
export function assertValid(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new ValidationError(message);
  }
}

/**
 * Assert resource exists or throw NotFoundError
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string,
  identifier?: string | number,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, identifier);
  }
}
