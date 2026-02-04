import api from '@/shared/api/axios';
import { ApiPayload, ApiParams, ApiResponse } from '@/shared/api/types';

export async function getHolidays(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/config/holidays', { params });
  return res.data.data;
}

export async function addHoliday(payload: { date: string; name: string }) {
  const res = await api.post<ApiResponse<ApiPayload>>('/config/holidays', payload);
  return res.data.data;
}

export async function deleteHoliday(date: string) {
  const res = await api.delete<ApiResponse<ApiPayload>>(`/config/holidays/${date}`);
  return res.data.data;
}

export async function getMasterRates() {
  const res = await api.get<ApiResponse<ApiPayload>>('/config/rates');
  return res.data.data;
}

export async function getProfessions() {
  const res = await api.get<ApiResponse<string[]>>('/config/professions');
  return res.data.data;
}

export async function createMasterRate(payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>('/config/rates', payload);
  return res.data.data;
}

export async function updateMasterRate(rateId: number | string, payload: ApiPayload) {
  const res = await api.put<ApiResponse<ApiPayload>>(`/config/rates/${rateId}`, payload);
  return res.data.data;
}

// Local type definition for hierarchy response to avoid 'any'
export interface ProfessionHierarchy {
  id: string;
  name: string;
  groups: {
    id: string;
    name: string;
    rate: number;
    criteria: {
      id: string;
      label: string;
      description?: string;
      subCriteria?: { id: string; label: string; description?: string }[];
    }[];
  }[];
}

export async function getRateHierarchy() {
  const res = await api.get<ApiResponse<ProfessionHierarchy[]>>('/config/rate-hierarchy');
  return res.data.data;
}
