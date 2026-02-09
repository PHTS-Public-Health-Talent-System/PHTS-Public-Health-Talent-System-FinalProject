"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiPayload } from '@/shared/api/types';
import {
  checkPeriodFrozen,
  freezePeriod,
  getPeriodWithSnapshot,
  getReportData,
  getSnapshot,
  getSnapshotsForPeriod,
  getSummaryData,
  unfreezePeriod,
} from './api';

export function usePeriodWithSnapshot(id: number | string | undefined) {
  return useQuery({
    queryKey: ['snapshot-period', id],
    queryFn: () => getPeriodWithSnapshot(id!),
    enabled: !!id,
  });
}

export function usePeriodFrozen(id: number | string | undefined) {
  return useQuery({
    queryKey: ['snapshot-frozen', id],
    queryFn: () => checkPeriodFrozen(id!),
    enabled: !!id,
  });
}

export function useSnapshotsForPeriod(id: number | string | undefined) {
  return useQuery({
    queryKey: ['snapshots', id],
    queryFn: () => getSnapshotsForPeriod(id!),
    enabled: !!id,
  });
}

export function useSnapshot(id: number | string | undefined, type: string | undefined) {
  return useQuery({
    queryKey: ['snapshot', id, type],
    queryFn: () => getSnapshot(id!, type!),
    enabled: !!id && !!type,
  });
}

export function useReportData(id: number | string | undefined) {
  return useQuery({
    queryKey: ['snapshot-report-data', id],
    queryFn: () => getReportData(id!),
    enabled: !!id,
  });
}

export function useSummaryData(id: number | string | undefined) {
  return useQuery({
    queryKey: ['snapshot-summary-data', id],
    queryFn: () => getSummaryData(id!),
    enabled: !!id,
  });
}

export function useFreezePeriod() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload?: ApiPayload }) =>
      freezePeriod(id, payload),
  });
}

export function useUnfreezePeriod() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: ApiPayload }) =>
      unfreezePeriod(id, payload),
  });
}
