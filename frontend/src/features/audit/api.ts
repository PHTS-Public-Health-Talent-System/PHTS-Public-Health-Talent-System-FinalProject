import api from '@/shared/api/axios';
import { ApiPayload, ApiParams, ApiResponse } from '@/shared/api/types';

export async function getAuditEventTypes() {
  const res = await api.get<ApiResponse<ApiPayload>>('/audit/event-types');
  return res.data.data;
}

export async function getAuditSummary(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/audit/summary', { params });
  return res.data.data;
}

export async function searchAuditEvents(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/audit/events', { params });
  return res.data.data;
}

export async function exportAuditEvents(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/audit/export', { params });
  return res.data.data;
}

export async function getEntityAuditTrail(entityType: string, entityId: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(`/audit/entity/${entityType}/${entityId}`);
  return res.data.data;
}
