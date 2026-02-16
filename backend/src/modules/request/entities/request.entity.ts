/**
 * Entity interfaces matching request-related DB tables.
 *
 * Core request tables: req_submissions, req_approvals, req_attachments
 * Related tables: req_eligibility
 * External tables (read-only joins): users, emp_profiles, emp_support_staff,
 *   sig_images, cfg_payment_rates, legacy cfg_classification_rules, leave_records
 */

// ─── req_submissions ─────────────────────────────────────────────────────────

export interface RequestSubmissionEntity {
  request_id: number;
  user_id: number;
  citizen_id: string;
  request_no: string | null;
  personnel_type: string;
  current_position_number: string | null;
  current_department: string | null;
  work_attributes: any; // JSON
  main_duty: string | null;
  applicant_signature_id: number | null;
  request_type: string;
  requested_amount: number;
  effective_date: Date;
  submission_data: any; // JSON
  status: string;
  current_step: number;
  assigned_officer_id: number | null;
  created_at: Date;
  updated_at: Date;
  step_started_at: Date | null;
  // Joined fields (from emp_profiles)
  emp_department?: string;
  emp_sub_department?: string;
  position_name?: string;
}

// ─── req_approvals ───────────────────────────────────────────────────────────

export interface RequestApprovalEntity {
  action_id: number;
  request_id: number;
  actor_id: number;
  step_no: number;
  action: string;
  comment: string | null;
  signature_snapshot: Buffer | null;
  created_at: Date;
}

// ─── req_attachments ─────────────────────────────────────────────────────────

export interface RequestAttachmentEntity {
  attachment_id: number;
  request_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_at: Date;
}

// ─── req_eligibility ─────────────────────────────────────────────────────────

export interface RequestEligibilityEntity {
  eligibility_id: number;
  user_id: number | null;
  citizen_id: string;
  master_rate_id: number;
  request_id: number;
  effective_date: Date;
  expiry_date: Date | null;
  is_active: boolean;
  created_at: Date;
}

// ─── req_verification_snapshots ─────────────────────────────────────────────

export interface RequestVerificationSnapshotEntity {
  snapshot_id: number;
  request_id: number;
  user_id: number | null;
  citizen_id: string;
  master_rate_id: number;
  effective_date: Date;
  expiry_date: Date | null;
  snapshot_data: any;
  created_by: number | null;
  created_at: Date;
}


// ─── cfg_payment_rates (read-only) ───────────────────────────────────────────

export interface PaymentRateEntity {
  rate_id: number;
  profession_code: string;
  group_no: number;
  item_no: string;
  sub_item_no: string | null;
  amount: number;
  is_active: boolean;
}

// ClassificationRuleEntity removed

// ─── leave_records (read-only, for adjustments) ──────────────────────────────

export interface LeaveRecordEntity {
  id: number;
  citizen_id: string;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  manual_start_date: string | null;
  manual_end_date: string | null;
  manual_duration_days: number | null;
  is_adjusted: boolean;
  remark: string | null;
}
