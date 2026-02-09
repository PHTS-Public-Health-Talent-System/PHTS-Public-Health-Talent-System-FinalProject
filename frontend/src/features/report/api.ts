import api from '@/shared/api/axios';
import { ApiParams } from '@/shared/api/types';

export async function downloadDetailReport(params?: ApiParams) {
  const res = await api.get('/reports/detail', { params, responseType: 'blob' });
  return res.data;
}

export async function downloadSummaryReport(params?: ApiParams) {
  const res = await api.get('/reports/summary', { params, responseType: 'blob' });
  return res.data;
}
