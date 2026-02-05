import api from '@/shared/api/axios';
import { ApiPayload, ApiParams, ApiResponse } from '@/shared/api/types';

export async function searchUsers(params: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/system/users', { params });
  return res.data.data;
}

export async function updateUserRole(userId: number | string, payload: { role: string }) {
  const res = await api.put<ApiResponse<ApiPayload>>(`/system/users/${userId}/role`, payload);
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

export async function triggerBackup() {
  const res = await api.post<ApiResponse<ApiPayload>>('/system/backup');
  return res.data.data;
}
