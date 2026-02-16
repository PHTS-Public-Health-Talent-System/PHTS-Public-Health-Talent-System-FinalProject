export type BackupJobStatus = "RUNNING" | "SUCCESS" | "FAILED";
export type BackupTriggerSource = "MANUAL" | "SCHEDULED";

export interface BackupJobRecord {
  job_id: number;
  trigger_source: BackupTriggerSource;
  triggered_by: number | null;
  status: BackupJobStatus;
  backup_file_path: string | null;
  backup_file_size_bytes: number | null;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface BackupTriggerResult {
  enabled: boolean;
  jobId?: number;
  status?: "SUCCESS" | "FAILED";
  output?: string;
}
