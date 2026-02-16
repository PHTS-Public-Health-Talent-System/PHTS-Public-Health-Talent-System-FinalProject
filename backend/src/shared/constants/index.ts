/**
 * Application Constants
 *
 * Centralized definition of all magic strings and constants
 * used throughout the application to ensure consistency
 */

// ============================================================================
// Request Status
// ============================================================================

export const RequestStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED: "RETURNED",
} as const;

export type RequestStatusType = typeof RequestStatus[keyof typeof RequestStatus];

// ============================================================================
// Approval Workflow
// ============================================================================

export const ApprovalStep = {
  HEAD_WARD: 1,
  HEAD_DEPT: 2,
  PTS_OFFICER: 3,
  HEAD_HR: 4,
  HEAD_FINANCE: 5,
  DIRECTOR: 6,
  COMPLETED: 7,
} as const;

export const ActionType = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  RETURN: "RETURN",
} as const;

// ============================================================================
// File Types
// ============================================================================

export const FileType = {
  LICENSE: "LICENSE",
  SIGNATURE: "SIGNATURE",
  DOCUMENT: "DOCUMENT",
  OTHER: "OTHER",
} as const;

// ============================================================================
// User Roles
// ============================================================================

export const UserRole = {
  USER: "USER",
  HEAD_WARD: "HEAD_WARD",
  HEAD_DEPT: "HEAD_DEPT",
  PTS_OFFICER: "PTS_OFFICER",
  HEAD_HR: "HEAD_HR",
  HEAD_FINANCE: "HEAD_FINANCE",
  FINANCE_OFFICER: "FINANCE_OFFICER",
  DIRECTOR: "DIRECTOR",
  ADMIN: "ADMIN",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// ============================================================================
// Notification Status
// ============================================================================

export const NotificationStatus = {
  UNREAD: "UNREAD",
  READ: "READ",
  ARCHIVED: "ARCHIVED",
} as const;

export const NotificationType = {
  INFO: "INFO",
  SUCCESS: "SUCCESS",
  WARNING: "WARNING",
  ERROR: "ERROR",
} as const;

// ============================================================================
// Audit Events
// ============================================================================

export const AuditEventType = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  REQUEST_CREATE: "REQUEST_CREATE",
  REQUEST_UPDATE: "REQUEST_UPDATE",
  REQUEST_APPROVE: "REQUEST_APPROVE",
  REQUEST_REJECT: "REQUEST_REJECT",
  REQUEST_RETURN: "REQUEST_RETURN",
  REQUEST_CANCEL: "REQUEST_CANCEL",
  PAYROLL_CREATE: "PAYROLL_CREATE",
  PAYROLL_FINALIZE: "PAYROLL_FINALIZE",
  SNAPSHOT_CREATE: "SNAPSHOT_CREATE",
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_DELETE: "USER_DELETE",
} as const;

// ============================================================================
// Payroll Status
// ============================================================================

export const PayrollStatus = {
  DRAFT: "DRAFT",
  CALCULATED: "CALCULATED",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const;

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT_ERROR: "CONFLICT_ERROR",
  BUSINESS_ERROR: "BUSINESS_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  CSRF_TOKEN_MISSING: "CSRF_TOKEN_MISSING",
  CSRF_TOKEN_INVALID: "CSRF_TOKEN_INVALID",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

// ============================================================================
// HTTP Status Codes
// ============================================================================

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// Scope Types
// ============================================================================

export const ScopeType = {
  UNIT: "UNIT",
  DEPARTMENT: "DEPARTMENT",
  FACILITY: "FACILITY",
} as const;

// ============================================================================
// Leave Types
// ============================================================================

export const LeaveType = {
  SICK: "SICK",
  PERSONAL: "PERSONAL",
  MATERNITY: "MATERNITY",
  SABBATICAL: "SABBATICAL",
  STUDY: "STUDY",
  SPECIAL: "SPECIAL",
} as const;

// ============================================================================
// License Status
// ============================================================================

export const LicenseStatus = {
  ACTIVE: "ACTIVE",
  EXPIRING_SOON: "EXPIRING_SOON",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;

// ============================================================================
// Configuration Keys
// ============================================================================

export const ConfigKey = {
  SYSTEM_NAME: "SYSTEM_NAME",
  SYSTEM_VERSION: "SYSTEM_VERSION",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
  LOG_LEVEL: "LOG_LEVEL",
  MAX_LOGIN_ATTEMPTS: "MAX_LOGIN_ATTEMPTS",
  TOKEN_EXPIRY_HOURS: "TOKEN_EXPIRY_HOURS",
} as const;

// ============================================================================
// Messages
// ============================================================================

export const Messages = {
  // Success Messages
  LOGIN_SUCCESS: "Login successful",
  LOGOUT_SUCCESS: "Logged out successfully",
  REQUEST_CREATED: "Request created successfully",
  REQUEST_APPROVED: "Request approved successfully",
  REQUEST_REJECTED: "Request rejected successfully",
  REQUEST_RETURNED: "Request returned for revision",
  PAYROLL_CREATED: "Payroll period created successfully",
  PAYROLL_FINALIZED: "Payroll period finalized successfully",

  // Error Messages
  INVALID_CREDENTIALS: "Invalid citizen ID or password",
  ACCOUNT_DISABLED: "Your account has been deactivated",
  REQUEST_NOT_FOUND: "Request not found",
  INVALID_APPROVER: "You are not authorized to approve this request",
  REQUEST_ALREADY_APPROVED: "This request has already been approved",
  INSUFFICIENT_PERMISSIONS: "You do not have permission to perform this action",
  INTERNAL_ERROR: "An error occurred. Please try again.",
} as const;

// ============================================================================
// Timeout Values (in milliseconds)
// ============================================================================

export const TimeoutMs = {
  SHORT: 5000,      // 5 seconds
  MEDIUM: 30000,    // 30 seconds
  LONG: 60000,      // 1 minute
  VERY_LONG: 300000, // 5 minutes
} as const;

// ============================================================================
// Cache Keys
// ============================================================================

export const CacheKey = {
  USER_PREFIX: "user:",
  ROLE_PERMISSIONS: "role:permissions:",
  SYSTEM_CONFIG: "system:config",
  RATES: "pts:rates",
  HOLIDAYS: "system:holidays",
} as const;
