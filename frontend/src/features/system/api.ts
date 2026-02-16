import api from '@/shared/api/axios';
import { ApiPayload, ApiParams, ApiResponse } from '@/shared/api/types';
import type { BackupJobRecord, BackupTriggerResult } from './types';

export async function searchUsers(params: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/system/users', { params });
  return res.data.data;
}

export async function updateUserRole(userId: number | string, payload: { role: string }) {
  const res = await api.put<ApiResponse<ApiPayload>>(`/system/users/${userId}/role`, payload);
  return res.data.data;
}

export async function getUserById(userId: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(`/system/users/${userId}`);
  return res.data.data;
}

export async function triggerSync() {
  const res = await api.post<ApiResponse<ApiPayload>>('/system/sync');
  return res.data.data;
}

export async function triggerUserSync(userId: number | string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/system/users/${userId}/sync`);
  return res.data.data;
}

export async function getJobStatus() {
  const res = await api.get<ApiResponse<ApiPayload>>('/system/jobs');
  return res.data.data;
}

export async function getVersionInfo() {
  const res = await api.get<ApiResponse<ApiPayload>>('/system/version');
  return res.data.data;
}

export async function toggleMaintenance(payload: { enabled: boolean; reason?: string }) {
  const res = await api.post<ApiResponse<ApiPayload>>('/system/maintenance', payload);
  return res.data.data;
}

export async function getMaintenanceStatus() {
  const res = await api.get<ApiResponse<ApiPayload>>('/system/maintenance');
  return res.data.data;
}

export async function triggerBackup() {
  const res = await api.post<ApiResponse<BackupTriggerResult>>('/system/backup');
  return res.data.data;
}

export async function getBackupHistory(limit: number = 20): Promise<BackupJobRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const res = await api.get<ApiResponse<BackupJobRecord[]>>('/system/backup/history', {
    params: { limit: safeLimit },
  });
  return res.data.data;
}
