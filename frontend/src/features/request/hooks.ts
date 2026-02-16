"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import {
  getMyRequests,
  getRequestById,
  createRequest,
  updateRequest,
  submitRequest,
  cancelRequest,
  getMasterRates,
  getEligibilityById,
  getEligibilityList,
  getEligibilityPaged,
  getEligibilitySummary,
  getPrefill,
  getMyScopes,
  getMyScopeMembers,
  getPendingApprovals,
  getApprovalHistory,
  getAvailableOfficers,
  confirmAttachments,
  updateRateMapping,
  updateVerificationChecks,
  createVerificationSnapshot,
  processAction,
  approveRequest,
  rejectRequest,
  returnRequest,
  approveBatch,
  reassignRequest,
  getReassignHistory,
  adjustLeaveRequest,
} from './api';
import type {
  EligibilityRecord,
  EligibilityPagedResult,
  EligibilitySummary,
  MasterRate,
  OfficerOption,
  PrefillProfile,
  ReassignHistoryItem,
  ScopeWithMembers,
} from './api';
import type { RequestWithDetails } from '@/types/request.types';
import type { DisplayScope } from './utils';

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ['navigation'] });

export function useMyRequests() {
  return useQuery({
    queryKey: ['my-requests'],
    queryFn: getMyRequests,
  });
}

export function useRequestDetail(id: number | string | undefined) {
  return useQuery({
    queryKey: ['request', id !== undefined ? String(id) : undefined],
    queryFn: () => getRequestById(id!),
    enabled: !!id,
  });
}

export function useMasterRates() {
  return useQuery({
    queryKey: ['request-master-rates'],
    queryFn: getMasterRates,
    select: (data) => data as MasterRate[],
  });
}

export function usePrefill() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['request-prefill', user?.id ?? 'anonymous'],
    queryFn: getPrefill,
    select: (data) => data as PrefillProfile | null,
  });
}

export function useMyScopes() {
  return useQuery({
    queryKey: ['my-scopes'],
    queryFn: getMyScopes,
    select: (data) => data as DisplayScope[],
  });
}

export function useMyScopeMembers() {
  return useQuery({
    queryKey: ['my-scopes-members'],
    queryFn: getMyScopeMembers,
    select: (data) => data as ScopeWithMembers[],
  });
}

export function useEligibilityList(activeOnly = true) {
  return useQuery({
    queryKey: ['eligibility-list', activeOnly ? 'active' : 'all'],
    queryFn: () => getEligibilityList(activeOnly),
    select: (data) => data as EligibilityRecord[],
  });
}

export function useEligibilitySummary(activeOnly = true) {
  return useQuery({
    queryKey: ['eligibility-summary', activeOnly ? 'active' : 'all'],
    queryFn: () => getEligibilitySummary(activeOnly),
    select: (data) => data as EligibilitySummary,
  });
}

export function useEligibilityPaged(params: {
  active_only?: "0" | "1";
  page?: number;
  limit?: number;
  profession_code?: string;
  search?: string;
  rate_group?: string;
  department?: string;
  sub_department?: string;
  license_status?: "all" | "active" | "expiring" | "expired";
}) {
  return useQuery({
    queryKey: ['eligibility-paged', params],
    queryFn: () => getEligibilityPaged(params),
    select: (data) => data as EligibilityPagedResult,
  });
}

export function useEligibilityDetail(id: number | string | undefined) {
  return useQuery({
    queryKey: ['eligibility-detail', id !== undefined ? String(id) : undefined],
    queryFn: () => getEligibilityById(id!),
    enabled: !!id,
    select: (data) => data as EligibilityRecord,
  });
}

export function usePendingApprovals(scope?: string) {
  return useQuery({
    queryKey: ['pending-approvals', scope ?? 'all'],
    queryFn: () => getPendingApprovals(scope),
  });
}

export function useApprovalHistory(params?: {
  view?: 'mine' | 'team';
  actions?: 'important' | 'all';
}) {
  return useQuery({
    queryKey: ['approval-history', params?.view ?? 'team', params?.actions ?? 'important'],
    queryFn: () => getApprovalHistory(params),
    select: (data) => data as unknown as RequestWithDetails[],
  });
}

export function useAvailableOfficers() {
  return useQuery({
    queryKey: ['available-officers'],
    queryFn: getAvailableOfficers,
    select: (data) => data as OfficerOption[],
  });
}


export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      invalidateNavigation(qc);
    },
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: number | string; formData: FormData }) =>
      updateRequest(id, formData),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: ['request', String(variables.id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useSubmitRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => submitRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: ['request', String(id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => cancelRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: ['request', String(id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useConfirmAttachments() {
  return useMutation({
    mutationFn: (id: number | string) => confirmAttachments(id),
  });
}

export function useUpdateRateMapping() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: { group_no: number; item_no: string | null; sub_item_no?: string | null } }) =>
      updateRateMapping(id, payload),
  });
}

export function useUpdateVerificationChecks() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: { qualification_ok: boolean; evidence_ok: boolean } }) =>
      updateVerificationChecks(id, payload),
  });
}

export function useCreateVerificationSnapshot() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: { master_rate_id: number; effective_date: string; expiry_date?: string; snapshot_data: Record<string, unknown> } }) =>
      createVerificationSnapshot(id, payload),
  });
}

export function useProcessAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: { action: 'APPROVE' | 'REJECT' | 'RETURN'; comment?: string; signature_base64?: string } }) =>
      processAction(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['request', String(variables.id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment, signature_base64 }: { id: number | string; comment?: string; signature_base64?: string }) =>
      approveRequest(id, comment, signature_base64),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: number | string; comment?: string }) =>
      rejectRequest(id, comment),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useReturnRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: number | string; comment?: string }) =>
      returnRequest(id, comment),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useApproveBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { requestIds: number[]; comment?: string }) => approveBatch(payload),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useReassignRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: { target_officer_id: number; remark?: string } }) =>
      reassignRequest(id, payload),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useReassignHistory(id: number | string | undefined) {
  return useQuery({
    queryKey: ['reassign-history', id],
    queryFn: () => getReassignHistory(id!),
    enabled: !!id,
    select: (data) => data as ReassignHistoryItem[],
  });
}

export function useAdjustLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: { manual_start_date: string; manual_end_date: string; manual_duration_days: number; remark?: string } }) =>
      adjustLeaveRequest(id, payload),
    onSuccess: () => invalidateNavigation(qc),
  });
}
