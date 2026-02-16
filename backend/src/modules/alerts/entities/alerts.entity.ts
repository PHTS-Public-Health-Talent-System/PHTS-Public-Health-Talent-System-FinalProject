export type AlertType =
  | "LICENSE_EXPIRED"
  | "LICENSE_EXPIRING"
  | "LICENSE_RESTORED"
  | "RETIREMENT_CUTOFF"
  | "MOVEMENT_OUT"
  | "SLA_DIGEST"
  | "LEAVE_REPORT";

export type AlertLogStatus = "SENT" | "FAILED";

export interface AlertLogInput {
  alert_type: AlertType;
  target_user_id?: number | null;
  reference_type: string;
  reference_id: string;
  payload_hash: string;
  status?: AlertLogStatus;
  error_message?: string | null;
  sent_at?: Date;
}

export interface RetirementRecord {
  retirement_id: number;
  citizen_id: string;
  retire_date: string;
  note: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  department?: string | null;
}

export interface PersonnelMovementRecord {
  movement_id: number;
  citizen_id: string;
  movement_type: string;
  effective_date: string;
  remark?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  department?: string | null;
}

export interface PersonnelMovementInput {
  citizen_id: string;
  movement_type: "RESIGN" | "TRANSFER_OUT";
  effective_date: string;
  remark?: string;
}

export interface RetirementInput {
  citizen_id: string;
  retire_date: string;
  note?: string;
}
