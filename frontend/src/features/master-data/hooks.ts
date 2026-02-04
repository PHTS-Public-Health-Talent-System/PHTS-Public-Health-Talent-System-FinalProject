"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiParams, ApiPayload } from '@/shared/api/types';
import {
  addHoliday,
  deleteHoliday,
  getHolidays,
  getMasterRates,
  getProfessions,
  createMasterRate,
  updateMasterRate,
  getRateHierarchy,
} from '@/features/master-data/api';

export function useHolidays(params?: ApiParams) {
  return useQuery({
    queryKey: ['holidays', params ?? {}],
    queryFn: () => getHolidays(params),
  });
}

export function useAddHoliday() {
  return useMutation({
    mutationFn: (payload: { date: string; name: string }) => addHoliday(payload),
  });
}

export function useDeleteHoliday() {
  return useMutation({
    mutationFn: (date: string) => deleteHoliday(date),
  });
}

export function useMasterRatesConfig() {
  return useQuery({
    queryKey: ['master-rates-config'],
    queryFn: getMasterRates,
  });
}

export function useCreateMasterRate() {
  return useMutation({
    mutationFn: (payload: ApiPayload) => createMasterRate(payload),
  });
}

export function useProfessions() {
  return useQuery({
    queryKey: ['professions'],
    queryFn: getProfessions,
  });
}

export function useCreateMasterRate() {
  return useMutation({
    mutationFn: (payload: ApiPayload) => createMasterRate(payload),
  });
}

export function useUpdateMasterRate() {
  return useMutation({
    mutationFn: ({ rateId, payload }: { rateId: number | string; payload: ApiPayload }) =>
      updateMasterRate(rateId, payload),
  });
}

export function useRateHierarchy() {
  return useQuery({
    queryKey: ['rate-hierarchy'],
    queryFn: getRateHierarchy,
    staleTime: 1000 * 60 * 60, // 1 hour (static data)
  });
}
