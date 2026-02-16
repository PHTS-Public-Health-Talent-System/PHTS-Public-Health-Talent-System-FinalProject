"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveByDirector,
  approveByHR,
  approveByHeadFinance,
  addPeriodItems,
  calculateOnDemand,
  calculatePeriod,
  createLeavePayException,
  createLeaveReturnReport,
  createPeriod,
  deletePeriod,
  deleteLeavePayException,
  deleteLeaveReturnReport,
  downloadPeriodReport,
  getPeriodDetail,
  getPeriodPayouts,
  getPayoutDetail,
  getPeriodReviewProgress,
  getPeriodSummaryByProfession,
  listPeriods,
  removePeriodItem,
  listLeavePayExceptions,
  listLeaveReturnReports,
  rejectPeriod,
  searchPayouts,
  setPeriodProfessionReview,
  submitToHR,
  updatePayout,
} from './api';

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ['navigation'] });

export function usePeriodPayouts(periodId: number | string | undefined) {
  return useQuery({
    queryKey: ['payroll-period-payouts', periodId],
    queryFn: () => getPeriodPayouts(periodId!),
    enabled: !!periodId,
  });
}

export function usePayoutDetail(payoutId: number | string | undefined) {
  return useQuery({
    queryKey: ['payroll-payout-detail', payoutId],
    queryFn: () => getPayoutDetail(payoutId!),
    enabled: !!payoutId,
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
      qc.invalidateQueries({ queryKey: ['payroll-period-payouts'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-review-progress'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-detail'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-summary'] });
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-payout-detail'] });
      invalidateNavigation(qc);
    },
  });
}

export function usePeriodSummaryByProfession(periodId: number | string | undefined) {
  return useQuery({
    queryKey: ['payroll-period-summary', periodId],
    queryFn: () => getPeriodSummaryByProfession(periodId!),
    enabled: !!periodId,
  });
}

export function usePeriodReviewProgress(periodId: number | string | undefined) {
  return useQuery({
    queryKey: ['payroll-period-review-progress', periodId],
    queryFn: () => getPeriodReviewProgress(periodId!),
    enabled: !!periodId,
  });
}

export function usePeriods() {
  return useQuery({
    queryKey: ['payroll-periods'],
    queryFn: listPeriods,
  });
}

export function usePeriodDetail(periodId: number | string | undefined) {
  return useQuery({
    queryKey: ['payroll-period-detail', periodId],
    queryFn: () => getPeriodDetail(periodId!),
    enabled: !!periodId,
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPeriod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      invalidateNavigation(qc);
    },
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => deletePeriod(periodId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-detail'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-payouts'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-review-progress'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-summary'] });
      invalidateNavigation(qc);
    },
  });
}

export function useAddPeriodItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: number | string; payload: { request_ids: number[] } }) =>
      addPeriodItems(periodId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['payroll-period-detail', variables.periodId] });
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      invalidateNavigation(qc);
    },
  });
}

export function useRemovePeriodItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, itemId }: { periodId: number | string; itemId: number | string }) =>
      removePeriodItem(periodId, itemId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['payroll-period-detail', variables.periodId] });
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      invalidateNavigation(qc);
    },
  });
}

export function useSearchPayouts(params: { q: string; year?: number; month?: number }) {
  return useQuery({
    queryKey: ['payroll-search', params],
    queryFn: () => searchPayouts(params),
    enabled: !!params.q,
  });
}

export function useDownloadPeriodReport() {
  return useMutation({
    mutationFn: (periodId: number | string) => downloadPeriodReport(periodId),
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
      qc.invalidateQueries({ queryKey: ['payroll-period-payouts', periodId] });
      qc.invalidateQueries({ queryKey: ['payroll-period-review-progress', periodId] });
      qc.invalidateQueries({ queryKey: ['payroll-period-detail', periodId] });
      qc.invalidateQueries({ queryKey: ['payroll-period-summary', periodId] });
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      invalidateNavigation(qc);
    },
  });
}

export function useSubmitToHR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => submitToHR(periodId),
    onSuccess: (_data, periodId) => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-period-review-progress', periodId] });
      qc.invalidateQueries({ queryKey: ['payroll-period-detail', periodId] });
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
        queryKey: ['payroll-period-review-progress', variables.periodId],
      });
      invalidateNavigation(qc);
    },
  });
}

export function useApproveByHR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => approveByHR(periodId),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useApproveByDirector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => approveByDirector(periodId),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useApproveByHeadFinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number | string) => approveByHeadFinance(periodId),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useRejectPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: number | string; payload: { reason: string } }) =>
      rejectPeriod(periodId, payload),
    onSuccess: () => invalidateNavigation(qc),
  });
}

export function useCreateLeavePayException() {
  return useMutation({
    mutationFn: createLeavePayException,
  });
}

export function useLeavePayExceptions() {
  return useQuery({
    queryKey: ['leave-pay-exceptions'],
    queryFn: listLeavePayExceptions,
  });
}

export function useDeleteLeavePayException() {
  return useMutation({
    mutationFn: (id: number | string) => deleteLeavePayException(id),
  });
}

export function useCreateLeaveReturnReport() {
  return useMutation({
    mutationFn: createLeaveReturnReport,
  });
}

export function useLeaveReturnReports() {
  return useQuery({
    queryKey: ['leave-return-reports'],
    queryFn: listLeaveReturnReports,
  });
}

export function useDeleteLeaveReturnReport() {
  return useMutation({
    mutationFn: (id: number | string) => deleteLeaveReturnReport(id),
  });
}
