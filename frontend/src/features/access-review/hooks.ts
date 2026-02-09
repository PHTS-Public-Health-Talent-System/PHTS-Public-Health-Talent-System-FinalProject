"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiParams, ApiPayload } from '@/shared/api/types';
import {
  completeAccessReviewCycle,
  createAccessReviewCycle,
  getAccessReviewCycle,
  getAccessReviewCycles,
  getAccessReviewItems,
  runAccessReviewAutoDisable,
  sendAccessReviewReminders,
  updateAccessReviewItem,
} from './api';

export function useAccessReviewCycles(params?: ApiParams) {
  return useQuery({
    queryKey: ['access-review-cycles', params ?? {}],
    queryFn: () => getAccessReviewCycles(params),
  });
}

export function useAccessReviewCycle(id: number | string | undefined) {
  return useQuery({
    queryKey: ['access-review-cycle', id],
    queryFn: () => getAccessReviewCycle(id!),
    enabled: !!id,
  });
}

export function useAccessReviewItems(id: number | string | undefined, params?: ApiParams) {
  return useQuery({
    queryKey: ['access-review-items', id, params ?? {}],
    queryFn: () => getAccessReviewItems(id!, params),
    enabled: !!id,
  });
}

export function useCreateAccessReviewCycle() {
  return useMutation({
    mutationFn: createAccessReviewCycle,
  });
}

export function useCompleteAccessReviewCycle() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload?: ApiPayload }) =>
      completeAccessReviewCycle(id, payload),
  });
}

export function useUpdateAccessReviewItem() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: ApiPayload }) =>
      updateAccessReviewItem(id, payload),
  });
}

export function useRunAccessReviewAutoDisable() {
  return useMutation({
    mutationFn: runAccessReviewAutoDisable,
  });
}

export function useSendAccessReviewReminders() {
  return useMutation({
    mutationFn: sendAccessReviewReminders,
  });
}
