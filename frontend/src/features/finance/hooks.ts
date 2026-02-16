"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiParams, ApiPayload } from '@/shared/api/types';
import {
  batchMarkAsPaid,
  cancelPayout,
  getFinanceDashboard,
  getFinanceSummary,
  getFinanceYearlySummary,
  getPayoutsByPeriod,
  markPayoutAsPaid,
} from './api';

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ['navigation'] });

export function useFinanceDashboard() {
  return useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: getFinanceDashboard,
  });
}

export function useFinanceSummary(params?: ApiParams) {
  return useQuery({
    queryKey: ['finance-summary', params ?? {}],
    queryFn: () => getFinanceSummary(params),
  });
}

export function useFinanceYearlySummary(params?: ApiParams) {
  return useQuery({
    queryKey: ['finance-yearly', params ?? {}],
    queryFn: () => getFinanceYearlySummary(params),
  });
}

export function usePayoutsByPeriod(periodId: number | string | undefined, params?: ApiParams) {
  return useQuery({
    queryKey: ['finance-payouts', periodId, params ?? {}],
    queryFn: () => getPayoutsByPeriod(periodId!, params),
    enabled: !!periodId,
  });
}

export function useMarkPayoutAsPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, payload }: { payoutId: number | string; payload: ApiPayload }) =>
      markPayoutAsPaid(payoutId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-payouts'] });
      invalidateNavigation(qc);
    },
  });
}

export function useBatchMarkAsPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApiPayload) => batchMarkAsPaid(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-payouts'] });
      invalidateNavigation(qc);
    },
  });
}

export function useCancelPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, payload }: { payoutId: number | string; payload?: ApiPayload }) =>
      cancelPayout(payoutId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-payouts'] });
      invalidateNavigation(qc);
    },
  });
}
