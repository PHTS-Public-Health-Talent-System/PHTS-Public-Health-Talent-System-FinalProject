/**
 * API Response Wrapper
 *
 * Provides consistent response format across the entire API
 * All endpoints should use these helpers for standardized responses
 */

export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  message?: string;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Build a success response
 * @param data Response data (optional)
 * @param message Success message (optional)
 * @returns Standardized success response
 */
export function buildSuccessResponse<T>(
  data?: T,
  message?: string,
): SuccessResponse<T> {
  return {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };
}

/**
 * Build a paginated success response
 * @param data Array of items
 * @param page Current page number
 * @param limit Items per page
 * @param total Total number of items
 * @param message Optional message
 * @returns Paginated response with metadata
 */
export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    ...(message && { message }),
  };
}

/**
 * Build an error response
 * @param code Error code (e.g., VALIDATION_ERROR, NOT_FOUND)
 * @param message Error message
 * @param details Additional error details
 * @returns Standardized error response
 */
export function buildErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}
