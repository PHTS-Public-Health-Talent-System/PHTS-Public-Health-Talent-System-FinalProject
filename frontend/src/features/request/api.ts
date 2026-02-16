import api from '@/shared/api/axios';
import { ApiPayload, ApiResponse } from '@/shared/api/types';
import { RequestWithDetails } from '@/types/request.types';
import type { DisplayScope } from './utils';

export interface MasterRate {
  rate_id: number;
  group_no: number;
  item_no: string | number | null;
  sub_item_no?: string | number | null;
  amount: number;
  profession_code: string;
  condition_desc?: string | null;
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

export interface EligibilityRecord {
  eligibility_id: number;
  user_id: number | null;
  citizen_id?: string | null;
  master_rate_id: number;
  request_id: number | null;
  effective_date: string;
  expiry_date?: string | null;
  is_active?: boolean | number | null;
  created_at?: string | null;
  request_no?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  position_number?: string | null;
  department?: string | null;
  sub_department?: string | null;
  emp_type?: string | null;
  original_status?: string | null;
  email?: string | null;
  phone?: string | null;
  profession_code?: string | null;
  group_no?: number | null;
  item_no?: string | number | null;
  sub_item_no?: string | number | null;
  rate_amount?: number | null;
  attachments?: Array<{
    attachment_id: number;
    request_id: number;
    file_type?: string | null;
    file_path: string;
    file_name: string;
    uploaded_at?: string | null;
  }>;
  license?: {
    license_id: number;
    citizen_id: string;
    license_name?: string | null;
    license_no?: string | null;
    valid_from: string;
    valid_until: string;
    status?: string | null;
    synced_at?: string | null;
  } | null;
}

export interface EligibilitySummaryRow {
  profession_code: string;
  people_count: number;
  total_rate_amount: number;
}

export interface EligibilitySummary {
  updated_at: string | null;
  total_people: number;
  total_rate_amount: number;
  by_profession: EligibilitySummaryRow[];
}

export interface EligibilityPagedMeta {
  page: number;
  limit: number;
  total: number;
  updated_at: string | null;
  total_rate_amount: number;
}

export interface EligibilityPagedResult {
  items: EligibilityRecord[];
  meta: EligibilityPagedMeta;
}

export interface ScopeMember {
  citizenId: string;
  fullName: string;
  position: string;
  department: string | null;
  subDepartment: string | null;
  userRole: string | null;
  userRoleLabel: string;
}

export interface ScopeWithMembers extends DisplayScope {
  memberCount: number;
  members: ScopeMember[];
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

export async function getMyScopeMembers(): Promise<ScopeWithMembers[]> {
  const res = await api.get<ApiResponse<ScopeWithMembers[]>>('/requests/my-scopes/members');
  return res.data.data;
}

export async function getEligibilityList(activeOnly = true): Promise<EligibilityRecord[]> {
  const res = await api.get<ApiResponse<EligibilityRecord[]>>('/requests/eligibility', {
    params: { active_only: activeOnly ? "1" : "0" },
  });
  return res.data.data;
}

export async function getEligibilitySummary(activeOnly = true): Promise<EligibilitySummary> {
  const res = await api.get<ApiResponse<EligibilitySummary>>('/requests/eligibility/summary', {
    params: { active_only: activeOnly ? "1" : "0" },
  });
  return res.data.data;
}

export async function getEligibilityPaged(params: {
  active_only?: "0" | "1";
  page?: number;
  limit?: number;
  profession_code?: string;
  search?: string;
  rate_group?: string;
  department?: string;
  sub_department?: string;
  license_status?: "all" | "active" | "expiring" | "expired";
}): Promise<EligibilityPagedResult> {
  const res = await api.get<ApiResponse<EligibilityPagedResult>>('/requests/eligibility', {
    params,
  });
  return res.data.data;
}

export async function getEligibilityById(id: number | string): Promise<EligibilityRecord> {
  const res = await api.get<ApiResponse<EligibilityRecord>>(`/requests/eligibility/${id}`);
  return res.data.data;
}

export async function exportEligibilityCsv(params: {
  active_only?: "0" | "1";
  profession_code?: string;
  search?: string;
  rate_group?: string;
  department?: string;
  sub_department?: string;
  license_status?: "all" | "active" | "expiring" | "expired";
}): Promise<Blob> {
  const res = await api.get('/requests/eligibility/export', {
    params,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function getPendingApprovals(scope?: string) {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>('/requests/pending', {
    params: scope ? { scope } : undefined,
  });
  return res.data.data;
}

export async function getApprovalHistory(params?: {
  view?: 'mine' | 'team';
  actions?: 'important' | 'all';
}): Promise<RequestWithDetails[]> {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>('/requests/history', {
    params,
  });
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

export async function updateRateMapping(
  id: number | string,
  payload: { group_no: number; item_no: string | null; sub_item_no?: string | null },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/rate-mapping`, payload);
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
  payload: { action: 'APPROVE' | 'REJECT' | 'RETURN'; comment?: string; signature_base64?: string },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/action`, payload);
  return res.data.data;
}

export async function approveRequest(id: number | string, comment?: string, signature_base64?: string) {
  const res = await api.post<ApiResponse<ApiPayload>>(`/requests/${id}/approve`, { comment, signature_base64 });
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
