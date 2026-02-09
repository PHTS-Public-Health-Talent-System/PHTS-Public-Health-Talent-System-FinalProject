import api from '@/shared/api/axios';
import { ApiPayload, ApiResponse } from '@/shared/api/types';

export type PayPeriod = {
  period_id: number;
  period_month: number;
  period_year: number;
  status: string;
  total_amount?: number | null;
  total_headcount?: number | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_frozen?: number | boolean | null;
  frozen_at?: string | null;
  frozen_by?: number | null;
  created_by?: number | null;
  created_by_name?: string | null;
};

export type PeriodItem = {
  period_item_id: number;
  period_id: number;
  request_id: number;
  citizen_id: string;
  snapshot_id: number | null;
  request_no?: string | null;
  personnel_type?: string | null;
  current_department?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
};

export type PeriodDetail = {
  period: PayPeriod;
  items: PeriodItem[];
};

export type PeriodSummaryRow = {
  position_name: string;
  headcount: number;
  total_payable: number;
  deducted_count: number;
  deducted_total: number;
};

export type PeriodPayoutRow = {
  payout_id: number;
  citizen_id: string;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  eligible_days?: number | null;
  deducted_days?: number | null;
  rate?: number | null;
  total_payable?: number | null;
  remark?: string | null;
};

export type PayoutSearchRow = {
  payout_id: number;
  citizen_id: string;
  pts_rate_snapshot: number;
  total_payable: number;
  retroactive_amount: number;
  period_id: number;
  period_month: number;
  period_year: number;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
};

export async function getPeriodPayouts(periodId: number | string): Promise<PeriodPayoutRow[]> {
  const res = await api.get<ApiResponse<PeriodPayoutRow[]>>(`/payroll/period/${periodId}/payouts`);
  return res.data.data;
}

export async function getPeriodSummaryByProfession(periodId: number | string): Promise<PeriodSummaryRow[]> {
  const res = await api.get<ApiResponse<PeriodSummaryRow[]>>(`/payroll/period/${periodId}/summary-by-profession`);
  return res.data.data;
}

export async function createPeriod(payload: ApiPayload): Promise<PayPeriod> {
  const res = await api.post<ApiResponse<PayPeriod>>('/payroll/period', payload);
  return res.data.data;
}

export async function listPeriods(): Promise<PayPeriod[]> {
  const res = await api.get<ApiResponse<PayPeriod[]>>('/payroll/period');
  return res.data.data;
}

export async function getPeriodDetail(periodId: number | string) {
  const res = await api.get<ApiResponse<PeriodDetail>>(`/payroll/period/${periodId}`);
  return res.data.data;
}

export async function addPeriodItems(periodId: number | string, payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/items`, payload);
  return res.data.data;
}

export async function removePeriodItem(periodId: number | string, itemId: number | string) {
  const res = await api.delete<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/items/${itemId}`);
  return res.data.data;
}

export async function searchPayouts(params: { q: string; year?: number; month?: number }) {
  const res = await api.get<ApiResponse<PayoutSearchRow[]>>('/payroll/payouts/search', { params });
  return res.data.data;
}

export async function downloadPeriodReport(periodId: number | string) {
  const res = await api.get(`/payroll/period/${periodId}/report`, {
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function calculateOnDemand(payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>('/payroll/calculate', payload);
  return res.data.data;
}

export async function calculatePeriod(periodId: number | string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/calculate`);
  return res.data.data;
}

export async function submitToHR(periodId: number | string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/submit`);
  return res.data.data;
}

export async function approveByHR(periodId: number | string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/approve-hr`);
  return res.data.data;
}

export async function approveByDirector(periodId: number | string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/approve-director`);
  return res.data.data;
}

export async function approveByHeadFinance(periodId: number | string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/approve-head-finance`);
  return res.data.data;
}

export async function rejectPeriod(periodId: number | string, payload: { reason: string }) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/payroll/period/${periodId}/reject`, payload);
  return res.data.data;
}

export async function createLeavePayException(payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>('/payroll/leave-pay-exceptions', payload);
  return res.data.data;
}

export async function listLeavePayExceptions() {
  const res = await api.get<ApiResponse<ApiPayload>>('/payroll/leave-pay-exceptions');
  return res.data.data;
}

export async function deleteLeavePayException(id: number | string) {
  const res = await api.delete<ApiResponse<ApiPayload>>(`/payroll/leave-pay-exceptions/${id}`);
  return res.data.data;
}

export async function createLeaveReturnReport(payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>('/payroll/leave-return-reports', payload);
  return res.data.data;
}

export async function listLeaveReturnReports() {
  const res = await api.get<ApiResponse<ApiPayload>>('/payroll/leave-return-reports');
  return res.data.data;
}

export async function deleteLeaveReturnReport(id: number | string) {
  const res = await api.delete<ApiResponse<ApiPayload>>(`/payroll/leave-return-reports/${id}`);
  return res.data.data;
}
