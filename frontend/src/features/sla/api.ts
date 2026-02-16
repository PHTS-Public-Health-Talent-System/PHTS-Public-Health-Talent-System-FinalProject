import api from '@/shared/api/axios';
import { ApiPayload, ApiParams, ApiResponse } from '@/shared/api/types';

export async function getSlaConfigs() {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/config');
  return res.data.data;
}

export async function updateSlaConfig(stepNo: number | string, payload: ApiPayload) {
  const res = await api.put<ApiResponse<ApiPayload>>(`/sla/config/${stepNo}`, payload);
  return res.data.data;
}

export async function getSlaReport(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/report', { params });
  return res.data.data;
}

export async function getSlaKpiOverview(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/kpi/overview', { params });
  return res.data.data;
}

export async function getSlaKpiByStep(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/kpi/by-step', { params });
  return res.data.data;
}

export async function getSlaKpiBacklogAging(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/kpi/backlog-aging', { params });
  return res.data.data;
}

export async function getSlaKpiDataQuality(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/kpi/data-quality', { params });
  return res.data.data;
}

export async function getSlaKpiError(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/kpi/error', { params });
  return res.data.data;
}

export async function getPendingWithSla(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/pending', { params });
  return res.data.data;
}

export async function sendSlaReminders() {
  const res = await api.post<ApiResponse<ApiPayload>>('/sla/send-reminders');
  return res.data.data;
}

export async function calculateBusinessDays(params: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/sla/calculate-days', { params });
  return res.data.data;
}
