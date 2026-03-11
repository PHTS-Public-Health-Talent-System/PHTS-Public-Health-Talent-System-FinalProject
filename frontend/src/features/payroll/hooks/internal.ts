/**
 * payroll module - React query hooks
 *
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import {
  approveByDirector,
  approveByHR,
  approveByHeadFinance,
  addPeriodItems,
  calculateOnDemand,
  calculatePeriod,
  createPeriod,
  deletePeriod,
  getPeriodDetail,
  getPeriodLeaves,
  getPeriodLeaveProfessionSummary,
  getPeriodPayouts,
  getPayoutDetail,
  getPeriodReviewProgress,
  getPeriodSummaryByProfession,
  listPeriods,
  removePeriodItem,
  rejectPeriod,
  searchPayouts,
  setPeriodProfessionReview,
  submitToHR,
  updatePayout,
} from "../api";

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["navigation"] });

const useViewerKey = () => {
  const { user } = useAuth();
  return {
    user,
    key: [user?.id ?? "anonymous", user?.role ?? "unknown"] as const,
  };
};

export function usePeriodPayouts(periodId: number | string | undefined) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-period-payouts", periodId, ...viewerKey],
    queryFn: () => getPeriodPayouts(periodId!),
    enabled: !!periodId && Boolean(user),
  });
}

export function usePeriodLeaves(
  periodId: number | string | undefined,
  params?: {
    leave_type?: string;
    profession_code?: string;
    pending_report?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    sort_by?: "start_date" | "name";
    sort_dir?: "asc" | "desc";
  },
) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-period-leaves", periodId, params ?? {}, ...viewerKey],
    queryFn: () => getPeriodLeaves(periodId!, params),
    enabled: !!periodId && Boolean(user),
    placeholderData: (prev) => prev,
  });
}

export function usePeriodLeaveProfessionSummary(
  periodId: number | string | undefined,
  params?: {
    leave_type?: string;
    pending_report?: boolean;
    search?: string;
  },
) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-period-leave-professions", periodId, params ?? {}, ...viewerKey],
    queryFn: () => getPeriodLeaveProfessionSummary(periodId!, params),
    enabled: !!periodId && Boolean(user),
    placeholderData: (prev) => prev,
  });
}

export function usePayoutDetail(payoutId: number | string | undefined) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-payout-detail", payoutId, ...viewerKey],
    queryFn: () => getPayoutDetail(payoutId!),
    enabled: !!payoutId && Boolean(user),
  });
}

export function useUpdatePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      payoutId,
      payload,
    }: {
      payoutId: number | string;
      payload: {
        eligible_days?: number;
        deducted_days?: number;
        retroactive_amount?: number;
        remark?: string | null;
      };
    }) => updatePayout(payoutId, payload),
    onSuccess: () => {
      // Some pages pass periodId as string (from route params), but API returns number.
      // Invalidate by prefix to avoid queryKey mismatches (e.g. "20" vs 20).
      qc.invalidateQueries({ queryKey: ["payroll-period-payouts"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-review-progress"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-detail"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-summary"] });
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-payout-detail"] });
      invalidateNavigation(qc);
    },
  });
}

export function usePeriodSummaryByProfession(
  periodId: number | string | undefined,
) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-period-summary", periodId, ...viewerKey],
    queryFn: () => getPeriodSummaryByProfession(periodId!),
    enabled: !!periodId && Boolean(user),
  });
}

export function usePeriodReviewProgress(periodId: number | string | undefined) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-period-review-progress", periodId, ...viewerKey],
    queryFn: () => getPeriodReviewProgress(periodId!),
    enabled: !!periodId && Boolean(user),
  });
}

export function usePeriods() {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-periods", ...viewerKey],
    queryFn: listPeriods,
    enabled: Boolean(user),
  });
}

export function usePeriodDetail(periodId: number | string | undefined) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-period-detail", periodId, ...viewerKey],
    queryFn: () => getPeriodDetail(periodId!),
    enabled: !!periodId && Boolean(user),
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPeriod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      invalidateNavigation(qc);
    },
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => deletePeriod(periodId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-detail"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-payouts"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-review-progress"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-summary"] });
      invalidateNavigation(qc);
    },
  });
}

export function useAddPeriodItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      periodId,
      payload,
    }: {
      periodId: number | string;
      payload: { request_ids: number[] };
    }) => addPeriodItems(periodId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["payroll-period-detail", variables.periodId],
      });
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      invalidateNavigation(qc);
    },
  });
}

export function useRemovePeriodItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      periodId,
      itemId,
    }: {
      periodId: number | string;
      itemId: number | string;
    }) => removePeriodItem(periodId, itemId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["payroll-period-detail", variables.periodId],
      });
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      invalidateNavigation(qc);
    },
  });
}

export function useSearchPayouts(params: {
  q: string;
  year?: number;
  month?: number;
}) {
  const { user, key: viewerKey } = useViewerKey();
  return useQuery({
    queryKey: ["payroll-search", params, ...viewerKey],
    queryFn: () => searchPayouts(params),
    enabled: !!params.q && Boolean(user),
  });
}

export function useCalculateOnDemand() {
  return useMutation({
    mutationFn: calculateOnDemand,
  });
}

export function useCalculatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => calculatePeriod(periodId),
    onSuccess: (_data, periodId) => {
      // Recalculate affects payouts list + progress + totals shown in period detail.
      qc.invalidateQueries({ queryKey: ["payroll-period-payouts", periodId] });
      qc.invalidateQueries({
        queryKey: ["payroll-period-review-progress", periodId],
      });
      qc.invalidateQueries({ queryKey: ["payroll-period-detail", periodId] });
      qc.invalidateQueries({ queryKey: ["payroll-period-summary", periodId] });
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      invalidateNavigation(qc);
    },
  });
}

export function useSubmitToHR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => submitToHR(periodId),
    onSuccess: (_data, periodId) => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({
        queryKey: ["payroll-period-review-progress", periodId],
      });
      qc.invalidateQueries({ queryKey: ["payroll-period-detail", periodId] });
      invalidateNavigation(qc);
    },
  });
}

export function useSetPeriodProfessionReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      periodId,
      professionCode,
      reviewed,
    }: {
      periodId: number | string;
      professionCode: string;
      reviewed: boolean;
    }) =>
      setPeriodProfessionReview(periodId, {
        profession_code: professionCode,
        reviewed,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["payroll-period-review-progress", variables.periodId],
      });
      invalidateNavigation(qc);
    },
  });
}

export function useApproveByHR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => approveByHR(periodId),
    onSuccess: (_data, periodId) => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-detail", periodId] });
      qc.invalidateQueries({
        queryKey: ["payroll-period-review-progress", periodId],
      });
      invalidateNavigation(qc);
    },
  });
}

export function useApproveByDirector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => approveByDirector(periodId),
    onSuccess: (_data, periodId) => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-detail", periodId] });
      qc.invalidateQueries({
        queryKey: ["payroll-period-review-progress", periodId],
      });
      invalidateNavigation(qc);
    },
  });
}

export function useApproveByHeadFinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => approveByHeadFinance(periodId),
    onSuccess: (_data, periodId) => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-detail", periodId] });
      qc.invalidateQueries({
        queryKey: ["payroll-period-review-progress", periodId],
      });
      invalidateNavigation(qc);
    },
  });
}

export function useRejectPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      periodId,
      payload,
    }: {
      periodId: number | string;
      payload: { reason: string };
    }) => rejectPeriod(periodId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({
        queryKey: ["payroll-period-detail", variables.periodId],
      });
      qc.invalidateQueries({
        queryKey: ["payroll-period-review-progress", variables.periodId],
      });
      invalidateNavigation(qc);
    },
  });
}
