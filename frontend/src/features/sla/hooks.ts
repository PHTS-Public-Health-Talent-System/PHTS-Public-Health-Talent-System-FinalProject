"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiParams, ApiPayload } from '@/shared/api/types';
import {
  calculateBusinessDays,
  getPendingWithSla,
  getSlaConfigs,
  getSlaReport,
  sendSlaReminders,
  updateSlaConfig,
} from './api';

export function useSlaConfigs() {
  return useQuery({
    queryKey: ['sla-configs'],
    queryFn: getSlaConfigs,
  });
}

export function useUpdateSlaConfig() {
  return useMutation({
    mutationFn: ({ stepNo, payload }: { stepNo: number | string; payload: ApiPayload }) =>
      updateSlaConfig(stepNo, payload),
  });
}

export function useSlaReport(params?: ApiParams) {
  return useQuery({
    queryKey: ['sla-report', params ?? {}],
    queryFn: () => getSlaReport(params),
  });
}

export function usePendingWithSla(params?: ApiParams) {
  return useQuery({
    queryKey: ['sla-pending', params ?? {}],
    queryFn: () => getPendingWithSla(params),
  });
}

export function useSendSlaReminders() {
  return useMutation({
    mutationFn: sendSlaReminders,
  });
}

export function useCalculateBusinessDays(params: ApiParams) {
  return useQuery({
    queryKey: ['sla-business-days', params],
    queryFn: () => calculateBusinessDays(params),
  });
}
