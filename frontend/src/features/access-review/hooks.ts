/**
 * access-review module - React query hooks
 *
 */
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { ApiParams, ApiPayload } from "@/shared/api/types";
import {
  autoReviewAccessReviewCycle,
  completeAccessReviewCycle,
  createAccessReviewCycle,
  getAccessReviewCycle,
  getAccessReviewCycles,
  getAccessReviewItems,
  getAccessReviewQueue,
  getAccessReviewQueueEvents,
  resolveAccessReviewQueueItem,
  updateAccessReviewItem,
} from "./api";

export function useAccessReviewCycles(params?: ApiParams) {
  return useQuery({
    queryKey: ["access-review-cycles", params ?? {}],
    queryFn: () => getAccessReviewCycles(params),
  });
}

export function useAccessReviewCycle(id: number | string | undefined) {
  return useQuery({
    queryKey: ["access-review-cycle", id],
    queryFn: () => getAccessReviewCycle(id!),
    enabled: !!id,
  });
}

export function useAccessReviewItems(
  id: number | string | undefined,
  params?: ApiParams,
) {
  return useQuery({
    queryKey: ["access-review-items", id, params ?? {}],
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
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload?: ApiPayload;
    }) => completeAccessReviewCycle(id, payload),
  });
}

export function useUpdateAccessReviewItem() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: ApiPayload;
    }) => updateAccessReviewItem(id, payload),
  });
}

export function useAutoReviewAccessReviewCycle() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload?: ApiPayload;
    }) => autoReviewAccessReviewCycle(id, payload),
  });
}

export function useAccessReviewQueue(params?: {
  page?: number;
  limit?: number;
  status?: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  reason_code?: string;
  current_role?: string;
  is_active?: 0 | 1;
  detected_from?: string;
  detected_to?: string;
  batch_id?: number;
  search?: string;
}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["access-review-queue", params ?? {}],
    queryFn: () => getAccessReviewQueue(params),
    enabled: options?.enabled ?? true,
  });
}

export function useAccessReviewQueueEvents(
  queueId: number | string | undefined,
  params?: { limit?: number },
) {
  return useQuery({
    queryKey: ["access-review-queue-events", queueId, params ?? {}],
    queryFn: () => getAccessReviewQueueEvents(queueId!, params),
    enabled: !!queueId,
  });
}

export function useResolveAccessReviewQueueItem() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: { action: "RESOLVE" | "DISMISS"; note?: string };
    }) => resolveAccessReviewQueueItem(id, payload),
  });
}
