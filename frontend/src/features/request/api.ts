import api from '@/shared/api/axios';
import { ApiPayload, ApiResponse } from '@/shared/api/types';
import { RequestWithDetails } from '@/types/request.types';
import type { DisplayScope } from '@/features/request/approver-utils';

export interface RecommendedClassification {
  group_no: number;
  item_no: number;
  sub_item_no?: number | null;
  amount: number;
  rate_id?: number;
  hint_text?: string;
  source?: string;
}

export interface MasterRate {
  rate_id?: number;
  group_no: number;
  item_no: string | number;
  sub_item_no?: string | number | null;
  amount: number;
  profession_code?: string;
  description?: string | null;
}

export interface OcrResult {
  license_no?: string;
  expiry_date?: string;
  confidence?: number;
  ocr_status?: string | null;
  [key: string]: unknown;
}

export interface OfficerOption {
  id: number;
  name: string;
  citizen_id: string;
  workload: number;
}

export interface ReassignHistoryItem {
  actionId: number;
  actorId: number;
  actorName: string;
  reason?: string | null;
  reassignedAt: string;
}

export interface PrefillProfile {
  citizen_id?: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  position_name?: string;
  position_number?: string;
  department?: string;
  sub_department?: string;
  mission_group?: string;
  employee_type?: string;
  first_entry_date?: string;
}

export async function getMyRequests(): Promise<RequestWithDetails[]> {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>('/requests');
  return res.data.data;
}

export async function getRequestById(id: number | string): Promise<RequestWithDetails> {
  const res = await api.get<ApiResponse<RequestWithDetails>>(`/requests/${id}`);
  return res.data.data;
}

export async function createRequest(formData: FormData): Promise<RequestWithDetails> {
  const res = await api.post<ApiResponse<RequestWithDetails>>('/requests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function updateRequest(id: number | string, formData: FormData): Promise<RequestWithDetails> {
  const res = await api.put<ApiResponse<RequestWithDetails>>(`/requests/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function submitRequest(id: number | string, confirmed = true): Promise<void> {
  await api.post(`/requests/${id}/submit`, { confirmed });
}

export async function cancelRequest(id: number | string): Promise<void> {
  await api.post(`/requests/${id}/cancel`);
}

export async function getMasterRates() {
  const res = await api.get<ApiResponse<MasterRate[]>>('/requests/master-rates');
  return res.data.data;
}

export async function getPrefill() {
  const res = await api.get<ApiResponse<PrefillProfile>>('/requests/prefill');
  return res.data.data;
}

export async function getMyScopes(): Promise<DisplayScope[]> {
  const res = await api.get<ApiResponse<DisplayScope[]>>('/requests/my-scopes');
  return res.data.data;
}

export async function getPendingApprovals(scope?: string) {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>('/requests/pending', {
    params: scope ? { scope } : undefined,
  });
  return res.data.data;
}

export async function getApprovalHistory(): Promise<RequestWithDetails[]> {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>('/requests/history');
  return res.data.data;
}

export async function getAvailableOfficers() {
  const res = await api.get<ApiResponse<OfficerOption[]>>('/requests/pts-officers');
  return res.data.data;
}

export async function confirmAttachments(id: number | string) {
  const res = await api.post<ApiResponse<{ message: string }>>(`/requests/${id}/attachments/confirm`);
  return res.data.data;
}

export async function getAttachmentOcr(attachmentId: number | string) {
  const res = await api.get<ApiResponse<OcrResult>>(`/requests/attachments/${attachmentId}/ocr`);
  return res.data.data;
}

export async function requestAttachmentOcr(attachmentId: number | string) {
  const res = await api.post<ApiResponse<OcrResult>>(`/requests/attachments/${attachmentId}/ocr`);
  return res.data.data;
}

export async function getRecommendedClassification(id: number | string) {
  const res = await api.get<ApiResponse<RecommendedClassification | null>>(
    `/requests/${id}/recommended-classification`,
  );
  return res.data.data;
}

export async function updateClassification(
  id: number | string,
  payload: { group_no: number; item_no: string | null; sub_item_no?: string | null },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/classification`, payload);
  return res.data.data;
}

export async function updateVerificationChecks(
  id: number | string,
  payload: { qualification_ok: boolean; evidence_ok: boolean },
) {
  const res = await api.put<ApiResponse<ApiPayload>>(`/requests/${id}/verification`, payload);
  return res.data.data;
}

export async function createVerificationSnapshot(
  id: number | string,
  payload: {
    master_rate_id: number;
    effective_date: string;
    expiry_date?: string;
    snapshot_data: Record<string, unknown>;
  },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/verification-snapshot`, payload);
  return res.data.data;
}

export async function processAction(
  id: number | string,
  payload: { action: 'APPROVE' | 'REJECT' | 'RETURN'; comment?: string },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/action`, payload);
  return res.data.data;
}

export async function approveRequest(id: number | string, comment?: string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/approve`, { comment });
  return res.data.data;
}

export async function rejectRequest(id: number | string, comment?: string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/reject`, { comment });
  return res.data.data;
}

export async function returnRequest(id: number | string, comment?: string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/return`, { comment });
  return res.data.data;
}

export async function approveBatch(payload: { requestIds: number[]; comment?: string }) {
  const res = await api.post<ApiResponse<ApiPayload>>('/requests/batch-approve', payload);
  return res.data.data;
}

export async function reassignRequest(
  id: number | string,
  payload: { target_officer_id: number; remark?: string },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/reassign`, payload);
  return res.data.data;
}

export async function getReassignHistory(id: number | string) {
  const res = await api.get<ApiResponse<ReassignHistoryItem[]>>(`/requests/${id}/reassign-history`);
  return res.data.data;
}

export async function adjustLeaveRequest(
  id: number | string,
  payload: {
    manual_start_date: string;
    manual_end_date: string;
    manual_duration_days: number;
    remark?: string;
  },
) {
  const res = await api.put<ApiResponse<ApiPayload>>(`/requests/${id}/adjust-leave`, payload);
  return res.data.data;
}
