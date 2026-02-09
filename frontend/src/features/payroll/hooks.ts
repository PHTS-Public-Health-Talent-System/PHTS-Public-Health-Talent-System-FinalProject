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
  deleteLeavePayException,
  deleteLeaveReturnReport,
  downloadPeriodReport,
  getPeriodDetail,
  getPeriodPayouts,
  getPeriodSummaryByProfession,
  listPeriods,
  removePeriodItem,
  listLeavePayExceptions,
  listLeaveReturnReports,
  rejectPeriod,
  searchPayouts,
  submitToHR,
} from './api';

export function usePeriodPayouts(periodId: number | string | undefined) {
  return useQuery({
    queryKey: ['payroll-period-payouts', periodId],
    queryFn: () => getPeriodPayouts(periodId!),
    enabled: !!periodId,
  });
}

export function usePeriodSummaryByProfession(periodId: number | string | undefined) {
  return useQuery({
    queryKey: ['payroll-period-summary', periodId],
    queryFn: () => getPeriodSummaryByProfession(periodId!),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-periods'] }),
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
  return useMutation({
    mutationFn: (periodId: number | string) => calculatePeriod(periodId),
  });
}

export function useSubmitToHR() {
  return useMutation({
    mutationFn: (periodId: number | string) => submitToHR(periodId),
  });
}

export function useApproveByHR() {
  return useMutation({
    mutationFn: (periodId: number | string) => approveByHR(periodId),
  });
}

export function useApproveByDirector() {
  return useMutation({
    mutationFn: (periodId: number | string) => approveByDirector(periodId),
  });
}

export function useApproveByHeadFinance() {
  return useMutation({
    mutationFn: (periodId: number | string) => approveByHeadFinance(periodId),
  });
}

export function useRejectPeriod() {
  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: number | string; payload: { reason: string } }) =>
      rejectPeriod(periodId, payload),
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
