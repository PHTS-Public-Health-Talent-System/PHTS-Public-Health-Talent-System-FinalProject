/**
 * PHTS System - Authentication Types
 *
 * Type definitions for authentication-related interfaces and enums
 *
 * Date: 2025-12-30
 */

/**
 * User roles in the PHTS system
 * Each role has specific permissions and dashboard access
 */
export enum UserRole {
  USER = "USER",
  HEAD_WARD = "HEAD_WARD",
  HEAD_DEPT = "HEAD_DEPT",
  PTS_OFFICER = "PTS_OFFICER",
  HEAD_HR = "HEAD_HR",
  HEAD_FINANCE = "HEAD_FINANCE",
  FINANCE_OFFICER = "FINANCE_OFFICER",
  DIRECTOR = "DIRECTOR",
  ADMIN = "ADMIN",
}

/**
 * User entity from database
 */
export interface User {
  user_id: number;
  citizen_id: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * JWT Payload structure
 * Contains minimal user information for token validation
 */
export interface JwtPayload {
  userId: number;
  citizenId: string;
  role: UserRole;
  iat?: number; // Issued at (timestamp)
  exp?: number; // Expiration (timestamp)
}

/**
 * Login request body
 */
export interface LoginRequest {
  citizen_id: string;
  password: string;
}

/**
 * User profile information (excluding sensitive data)
 */
export interface UserProfile {
  id: number;
  citizen_id: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  position_number?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  employee_type?: string | null;
  mission_group?: string | null;
  start_current_position?: Date | null;
  license_no?: string | null;
  license_name?: string | null;
  license_valid_from?: Date | string | null;
  license_valid_until?: Date | string | null;
  license_status?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'UNKNOWN' | null;
}

/**
 * Login response structure
 */
export interface LoginResponse {
  success: boolean;
  token: string;
  user: UserProfile;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
