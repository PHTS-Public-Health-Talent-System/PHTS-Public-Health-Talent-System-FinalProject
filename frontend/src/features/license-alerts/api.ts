import api from '@/shared/api/axios';
import { ApiPayload, ApiParams, ApiResponse } from '@/shared/api/types';

export interface LicenseAlertsSummary {
  expired: number;
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
  total: number;
}

export async function getLicenseAlertsSummary(): Promise<LicenseAlertsSummary> {
  const res = await api.get<ApiResponse<LicenseAlertsSummary>>('/alerts/license/summary');
  return res.data.data;
}

export async function getLicenseAlertsList(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>('/alerts/license/list', { params });
  return res.data.data;
}
