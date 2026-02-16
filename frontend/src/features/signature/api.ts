import api from '@/shared/api/axios';
import { ApiResponse } from '@/shared/api/types';

export async function getMySignature() {
  const res = await api.get<ApiResponse<{ data_url: string }>>(
    '/signatures/my-signature',
  );
  return res.data.data;
}

export async function checkSignature() {
  const res = await api.get<ApiResponse<{ has_signature: boolean }>>('/signatures/check');
  return res.data.data;
}

export async function refreshMySignature() {
  const res = await api.post<ApiResponse<{ queued: boolean; delay_ms: number }>>(
    '/signatures/refresh',
  );
  return res.data.data;
}
