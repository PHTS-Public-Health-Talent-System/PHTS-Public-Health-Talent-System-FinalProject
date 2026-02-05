/**
 * Auth Module - Entity Definitions
 *
 * TypeScript interfaces matching auth-related DB tables
 */

import { UserRole } from '@types/auth.js';

// ─── users table ──────────────────────────────────────────────────────────────

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

// ─── User with profile data (joined from emp_profiles/emp_support_staff) ──────

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
  employee_type?: string | null;
  mission_group?: string | null;
  start_current_position?: Date | null;
}

// ─── Employee profile from emp_profiles table ─────────────────────────────────

export interface EmployeeProfile {
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  position_number: string | null;
  department: string | null;
  employee_type: string | null;
  mission_group: string | null;
  start_current_position: Date | null;
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: number;
  citizenId: string;
  role: UserRole;
}

// ─── Login response ───────────────────────────────────────────────────────────

export interface LoginResult {
  token: string;
  user: UserProfile;
}
