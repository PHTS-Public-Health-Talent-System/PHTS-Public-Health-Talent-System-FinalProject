/**
 * System Module - Entity Definitions
 *
 * TypeScript interfaces for system administration operations
 */

// ─── Role Assignment ─────────────────────────────────────────────────────────

export interface HrUserRow {
  citizen_id: string;
  position_name?: string | null;
  special_position?: string | null;
  department?: string | null;
  sub_department?: string | null;
}

export interface UserRow {
  id: number;
  citizen_id: string;
  role: string;
  is_active?: number;
  password_hash?: string;
}

export interface RoleAssignmentResult {
  updated: number;
  skipped: number;
  missing: number;
}

// ─── Sync Service ────────────────────────────────────────────────────────────

export interface SyncStats {
  users: { added: number; updated: number; skipped: number };
  employees: { upserted: number; skipped: number };
  support_employees: { upserted: number; skipped: number };
  signatures: { added: number; skipped: number };
  licenses: { upserted: number };
  quotas: { upserted: number };
  leaves: { upserted: number; skipped: number };
  movements: { added: number };
  roles: { updated: number; skipped: number; missing: number };
}

export interface SyncResult {
  success: boolean;
  duration: string;
  stats: SyncStats;
  timestamp: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastResult: SyncResult | null;
}

// ─── Backup Service ──────────────────────────────────────────────────────────

export interface BackupResult {
  enabled: boolean;
  output?: string;
}

// ─── View rows from HRMS sync ────────────────────────────────────────────────

export interface ViewUserSync {
  citizen_id: string;
  plain_password: string;
  role: string;
  is_active: number;
}

export interface ViewEmployee {
  citizen_id: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  sex?: string;
  birth_date?: Date;
  position_name?: string;
  position_number?: string;
  level?: string;
  special_position?: string;
  employee_type?: string;
  department?: string;
  sub_department?: string;
  mission_group?: string;
  specialist?: string;
  expert?: string;
  start_current_position?: Date;
  first_entry_date?: Date;
  original_status?: string;
}

export interface ViewSupportEmployee {
  citizen_id: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  position_name?: string;
  level?: string;
  special_position?: string;
  employee_type?: string;
  department?: string;
  is_currently_active?: number;
}

export interface ViewSignature {
  citizen_id: string;
  signature_blob: Buffer;
}

export interface ViewLeaveQuota {
  citizen_id: string;
  fiscal_year: number;
  total_quota: number;
}

export interface ViewLeaveRequest {
  ref_id: string;
  citizen_id: string;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  duration_days: number;
  fiscal_year: number;
  remark?: string;
  status: string;
  is_no_pay?: number;
}

export interface ExistingLeaveRecord {
  ref_id: string;
  status?: string;
  start_date: Date;
  end_date: Date;
  is_no_pay?: number;
}
