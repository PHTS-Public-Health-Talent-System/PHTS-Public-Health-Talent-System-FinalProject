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
}

export interface RetirementInput {
  citizen_id: string;
  retire_date: string;
  note?: string;
}
