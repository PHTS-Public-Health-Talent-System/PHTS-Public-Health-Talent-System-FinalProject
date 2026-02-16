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
  const res = await api.get<ApiResponse<LicenseAlertListItem[]>>('/alerts/license/list', { params });
  return res.data.data;
}

export interface LicenseAlertListItem {
  citizen_id: string;
  full_name: string;
  position_name: string;
  department?: string | null;
  profession_code?: string | null;
  license_no?: string | null;
  license_expiry: string | null;
  days_left: number | null;
  bucket: 'expired' | '30' | '60' | '90';
  last_notified_at?: string | null;
}

export async function notifyLicenseAlerts(items: Array<{ citizen_id: string; bucket: 'expired' | '30' | '60' | '90' }>) {
  const res = await api.post<ApiResponse<ApiPayload>>('/alerts/license/notify', { items });
  return res.data.data;
}
