import api from '@/shared/api/axios';
import { ApiPayload, ApiParams, ApiResponse } from '@/shared/api/types';

export async function getLicenseAlertsSummary() {
  const res = await api.get<ApiResponse<ApiPayload>>('/alerts/license/summary');
  return res.data.data;
}

export async function getLicenseAlertsList(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/alerts/license/list', { params });
  return res.data.data;
}
