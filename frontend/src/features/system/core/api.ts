/**
 * system module - API client
 *
 */
import api from "@/shared/api/axios";
import { ApiPayload, ApiParams, ApiResponse } from "@/shared/api/types";
import type {
  BackupJobRecord,
  BackupSchedule,
  BackupTriggerResult,
  DataIssueListResponse,
  SyncBatchListResponse,
  SyncSchedule,
  SyncRecordListResponse,
  SnapshotOutboxFilterStatus,
  SnapshotOutboxListResponse,
  SyncReconciliationSummary,
  UserSyncAuditAction,
  UserSyncAuditRecord,
} from "./types";

export async function searchUsers(params: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>("/system/users", {
    params,
  });
  return res.data.data;
}

export async function updateUserRole(
  userId: number | string,
  payload: { role: string },
) {
  const res = await api.put<ApiResponse<ApiPayload>>(
    `/system/users/${userId}/role`,
    payload,
  );
  return res.data.data;
}

export async function getUserById(userId: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(`/system/users/${userId}`);
  return res.data.data;
}

export async function triggerSync() {
  const res = await api.post<ApiResponse<ApiPayload>>("/system/sync");
  return res.data.data;
}

export async function triggerUserSync(userId: number | string) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/system/users/${userId}/sync`,
  );
  return res.data.data;
}

export async function getJobStatus() {
  const res = await api.get<ApiResponse<ApiPayload>>("/system/jobs");
  return res.data.data;
}

export async function getVersionInfo() {
  const res = await api.get<ApiResponse<ApiPayload>>("/system/version");
  return res.data.data;
}

export async function toggleMaintenance(payload: {
  enabled: boolean;
  reason?: string;
}) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    "/system/maintenance",
    payload,
  );
  return res.data.data;
}

export async function getMaintenanceStatus() {
  const res = await api.get<ApiResponse<ApiPayload>>("/system/maintenance");
  return res.data.data;
}

export async function triggerBackup() {
  const res =
    await api.post<ApiResponse<BackupTriggerResult>>("/system/backup");
  return res.data.data;
}

export async function getBackupHistory(
  limit: number = 20,
): Promise<BackupJobRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const res = await api.get<ApiResponse<BackupJobRecord[]>>(
    "/system/backup/history",
    {
      params: { limit: safeLimit },
    },
  );
  return res.data.data;
}

export async function getBackupSchedule(): Promise<BackupSchedule> {
  const res = await api.get<ApiResponse<BackupSchedule>>("/system/backup/schedule");
  return res.data.data;
}

export async function updateBackupSchedule(payload: {
  hour: number;
  minute: number;
}): Promise<BackupSchedule> {
  const res = await api.put<ApiResponse<BackupSchedule>>(
    "/system/backup/schedule",
    payload,
  );
  return res.data.data;
}

export async function getSyncSchedule(): Promise<SyncSchedule> {
  const res = await api.get<ApiResponse<SyncSchedule>>("/system/sync/schedule");
  return res.data.data;
}

export async function updateSyncSchedule(payload: {
  mode: "DAILY" | "INTERVAL";
  hour?: number;
  minute?: number;
  interval_minutes?: number;
  timezone?: string;
}): Promise<SyncSchedule> {
  const res = await api.put<ApiResponse<SyncSchedule>>("/system/sync/schedule", payload);
  return res.data.data;
}

export async function getSyncReconciliation(): Promise<SyncReconciliationSummary> {
  const res = await api.get<ApiResponse<SyncReconciliationSummary>>(
    "/system/sync/reconciliation",
  );
  return res.data.data;
}

export async function getSyncBatches(params?: {
  page?: number;
  limit?: number;
}): Promise<SyncBatchListResponse> {
  const safePage = Math.max(1, params?.page ?? 1);
  const safeLimit = Math.max(1, Math.min(params?.limit ?? 20, 100));
  const res = await api.get<ApiResponse<SyncBatchListResponse>>('/system/sync/batches', {
    params: {
      page: safePage,
      limit: safeLimit,
    },
  });
  return res.data.data;
}

export async function getUserSyncAudits(params?: {
  limit?: number;
  batch_id?: number;
  citizen_id?: string;
  action?: UserSyncAuditAction;
}): Promise<UserSyncAuditRecord[]> {
  const res = await api.get<ApiResponse<UserSyncAuditRecord[]>>(
    "/system/sync/user-audits",
    {
      params,
    },
  );
  return res.data.data;
}

export async function getDataIssues(params?: {
  page?: number;
  limit?: number;
  batch_id?: number;
  target_table?: string;
  issue_code?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH";
}): Promise<DataIssueListResponse> {
  const res = await api.get<ApiResponse<DataIssueListResponse>>(
    "/system/sync/issues",
    {
      params,
    },
  );
  return res.data.data;
}

export async function getSyncRecords(params?: {
  page?: number;
  limit?: number;
  batch_id?: number;
  target_table?: string;
  search?: string;
}): Promise<SyncRecordListResponse> {
  const res = await api.get<ApiResponse<SyncRecordListResponse>>(
    "/system/sync/records",
    { params },
  );
  return res.data.data;
}

export async function getSnapshotOutbox(params?: {
  page?: number;
  limit?: number;
  status?: SnapshotOutboxFilterStatus;
  period_id?: number;
}): Promise<SnapshotOutboxListResponse> {
  const res = await api.get<ApiResponse<SnapshotOutboxListResponse>>(
    "/system/snapshot-outbox",
    { params },
  );
  return res.data.data;
}

export async function retrySnapshotOutbox(outboxId: number) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/system/snapshot-outbox/${outboxId}/retry`);
  return res.data.data;
}

export async function retrySnapshotDeadLetters() {
  const res = await api.post<ApiResponse<{ count: number }>>("/system/snapshot-outbox/retry-dead-letter");
  return res.data.data;
}
