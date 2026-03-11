/**
 * request module - React query hooks
 *
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import {
  getMyRequests,
  getRequestById,
  createRequest,
  updateRequest,
  uploadEligibilityAttachments,
  deleteEligibilityAttachment,
  submitRequest,
  cancelRequest,
  getMasterRates,
  getEligibilityById,
  getEligibilityList,
  getEligibilityPaged,
  getEligibilitySummary,
  setPrimaryEligibility,
  deactivateEligibility,
  reactivateEligibility,
  getPrefill,
  searchPersonnelOptions,
  getMyScopes,
  getMyScopeMembers,
  getPendingApprovals,
  getApprovalHistory,
  persistManualOcrPrecheck,
  runRequestAttachmentsOcr,
  clearRequestAttachmentOcr,
  persistEligibilityManualOcrPrecheck,
  runEligibilityAttachmentsOcr,
  clearEligibilityAttachmentOcr,
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
} from "./api";
import type {
  EligibilityRecord,
  EligibilityPagedResult,
  EligibilitySummary,
  MasterRate,
  OfficerOption,
  PersonnelOption,
  PrefillProfile,
  ReassignHistoryItem,
  ScopeWithMembers,
} from "./api";
import type { RequestWithDetails } from "@/types/request.types";
import type { DisplayScope } from "./utils";

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["navigation"] });

export function useMyRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-requests", user?.id ?? "anonymous", user?.role ?? "unknown"],
    queryFn: getMyRequests,
    enabled: Boolean(user),
  });
}

export function useRequestDetail(id: number | string | undefined) {
  return useQuery({
    queryKey: ["request", id !== undefined ? String(id) : undefined],
    queryFn: () => getRequestById(id!),
    enabled: !!id,
    retry: (failureCount, error: unknown) => {
      const status =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: number } }).response === "object"
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      if (status === 404 || status === 403 || status === 400) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useMasterRates() {
  return useQuery({
    queryKey: ["request-master-rates"],
    queryFn: getMasterRates,
    select: (data) => data as MasterRate[],
  });
}

export function usePrefill(targetUserId?: number | string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["request-prefill", user?.id ?? "anonymous", targetUserId ?? "self"],
    queryFn: () => getPrefill(targetUserId),
    select: (data) => data as PrefillProfile | null,
  });
}

export function usePersonnelOptions(search: string, limit = 20) {
  return useQuery({
    queryKey: ["request-personnel-options", search, limit],
    queryFn: () => searchPersonnelOptions(search, limit),
    enabled: search.trim().length >= 2,
    select: (data) => data as PersonnelOption[],
  });
}

export function useMyScopes() {
  return useQuery({
    queryKey: ["my-scopes"],
    queryFn: getMyScopes,
    select: (data) => data as DisplayScope[],
  });
}

export function useMyScopeMembers() {
  return useQuery({
    queryKey: ["my-scopes-members"],
    queryFn: getMyScopeMembers,
    select: (data) => data as ScopeWithMembers[],
  });
}

export function useEligibilityList(activeOnly = true) {
  return useQuery({
    queryKey: ["eligibility-list", activeOnly ? "active" : "all"],
    queryFn: () => getEligibilityList(activeOnly),
    select: (data) => data as EligibilityRecord[],
  });
}

export function useEligibilitySummary(
  params:
    | boolean
    | {
        active_only?: "0" | "1" | "2";
        profession_code?: string;
        search?: string;
        rate_group?: string;
        department?: string;
        sub_department?: string;
        license_status?: "all" | "active" | "expiring" | "expired";
        alert_filter?: "all" | "any" | "error" | "no-license" | "duplicate" | "upcoming-change";
      } = true,
) {
  return useQuery({
    queryKey: ["eligibility-summary", params],
    queryFn: () => getEligibilitySummary(params),
    select: (data) => data as EligibilitySummary,
  });
}

export function useEligibilityPaged(params: {
  active_only?: "0" | "1" | "2";
  page?: number;
  limit?: number;
  profession_code?: string;
  search?: string;
  rate_group?: string;
  department?: string;
  sub_department?: string;
  license_status?: "all" | "active" | "expiring" | "expired";
  alert_filter?: "all" | "any" | "error" | "no-license" | "duplicate" | "upcoming-change";
}) {
  return useQuery({
    queryKey: ["eligibility-paged", params],
    queryFn: () => getEligibilityPaged(params),
    select: (data) => data as EligibilityPagedResult,
  });
}

export function useEligibilityDetail(id: number | string | undefined) {
  return useQuery({
    queryKey: ["eligibility-detail", id !== undefined ? String(id) : undefined],
    queryFn: () => getEligibilityById(id!),
    enabled: !!id,
    select: (data) => data as EligibilityRecord,
  });
}

export function useUploadEligibilityAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      formData,
    }: {
      eligibilityId: number | string;
      formData: FormData;
    }) => uploadEligibilityAttachments(eligibilityId, formData),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useDeleteEligibilityAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      attachmentId,
    }: {
      eligibilityId: number | string;
      attachmentId: number | string;
    }) => deleteEligibilityAttachment(eligibilityId, attachmentId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useSetPrimaryEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      reason,
    }: {
      eligibilityId: number | string;
      reason?: string;
    }) => setPrimaryEligibility(eligibilityId, reason ? { reason } : undefined),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useDeactivateEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      reason,
    }: {
      eligibilityId: number | string;
      reason?: string;
    }) => deactivateEligibility(eligibilityId, reason ? { reason } : undefined),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useReactivateEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      reason,
    }: {
      eligibilityId: number | string;
      reason?: string;
    }) => reactivateEligibility(eligibilityId, reason ? { reason } : undefined),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function usePendingApprovals(scope?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "pending-approvals",
      scope ?? "all",
      user?.id ?? "anonymous",
      user?.role ?? "unknown",
    ],
    queryFn: () => getPendingApprovals(scope),
    enabled: Boolean(user),
  });
}

export function useApprovalHistory(params?: {
  view?: "mine" | "team";
  actions?: "important" | "all";
}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "approval-history",
      params?.view ?? "team",
      params?.actions ?? "important",
      user?.id ?? "anonymous",
      user?.role ?? "unknown",
    ],
    queryFn: () => getApprovalHistory(params),
    enabled: Boolean(user),
    select: (data) => data as unknown as RequestWithDetails[],
  });
}

export function usePersistManualOcrPrecheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: {
        service_url?: string;
        worker?: string;
        count?: number;
        success_count?: number;
        failed_count?: number;
        error?: string | null;
        results?: Array<{
          name?: string;
          ok?: boolean;
          markdown?: string;
          error?: string;
        }>;
      };
    }) => persistManualOcrPrecheck(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["request", String(variables.id)] });
    },
  });
}

export function useRunRequestAttachmentsOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: number | string;
      payload: {
        attachments: Array<{
          attachment_id: number;
        }>;
      };
    }) => runRequestAttachmentsOcr(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["request", String(variables.requestId)] });
    },
  });
}

export function useClearRequestAttachmentOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: number | string;
      payload: {
        file_name: string;
      };
    }) => clearRequestAttachmentOcr(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["request", String(variables.requestId)] });
    },
  });
}

export function usePersistEligibilityManualOcrPrecheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: {
        service_url?: string;
        worker?: string;
        count?: number;
        success_count?: number;
        failed_count?: number;
        error?: string | null;
        results?: Array<{
          name?: string;
          ok?: boolean;
          markdown?: string;
          error?: string;
          engine_used?: string;
          fallback_used?: boolean;
          document_kind?: string;
          fields?: Record<string, unknown>;
          missing_fields?: string[];
          fallback_reason?: string;
          quality?: {
            required_fields?: number;
            captured_fields?: number;
            passed?: boolean;
          };
        }>;
      };
    }) => persistEligibilityManualOcrPrecheck(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.id)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useRunEligibilityAttachmentsOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      payload,
    }: {
      eligibilityId: number | string;
      payload: {
        attachments: Array<{
          attachment_id: number;
          source: "eligibility" | "request";
        }>;
      };
    }) => runEligibilityAttachmentsOcr(eligibilityId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useClearEligibilityAttachmentOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      payload,
    }: {
      eligibilityId: number | string;
      payload: {
        file_name: string;
      };
    }) => clearEligibilityAttachmentOcr(eligibilityId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useAvailableOfficers() {
  return useQuery({
    queryKey: ["available-officers"],
    queryFn: getAvailableOfficers,
    select: (data) => data as OfficerOption[],
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      invalidateNavigation(qc);
    },
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      formData,
    }: {
      id: number | string;
      formData: FormData;
    }) => updateRequest(id, formData),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["request", String(variables.id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useSubmitRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => submitRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["request", String(id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => cancelRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["request", String(id)] });
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
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: {
        group_no: number;
        item_no: string | null;
        sub_item_no?: string | null;
      };
    }) => updateRateMapping(id, payload),
  });
}

export function useUpdateVerificationChecks() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: { qualification_ok: boolean; evidence_ok: boolean };
    }) => updateVerificationChecks(id, payload),
  });
}

export function useCreateVerificationSnapshot() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: {
        master_rate_id: number;
        effective_date: string;
        expiry_date?: string;
        snapshot_data: Record<string, unknown>;
      };
    }) => createVerificationSnapshot(id, payload),
  });
}

export function useProcessAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: {
        action: "APPROVE" | "REJECT" | "RETURN";
        comment?: string;
        signature_base64?: string;
      };
    }) => processAction(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["request", String(variables.id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      comment,
      signature_base64,
    }: {
      id: number | string;
      comment?: string;
      signature_base64?: string;
    }) => approveRequest(id, comment, signature_base64),
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
    mutationFn: (payload: { requestIds: number[]; comment?: string }) =>
      approveBatch(payload),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useReassignRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: { target_officer_id: number; remark?: string };
    }) => reassignRequest(id, payload),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useReassignHistory(id: number | string | undefined) {
  return useQuery({
    queryKey: ["reassign-history", id],
    queryFn: () => getReassignHistory(id!),
    enabled: !!id,
    select: (data) => data as ReassignHistoryItem[],
  });
}
