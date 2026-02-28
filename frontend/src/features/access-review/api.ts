/**
 * access-review module - API client
 *
 */
import api from "@/shared/api/axios";
import { ApiPayload, ApiParams, ApiResponse } from "@/shared/api/types";

export type AccessReviewQueueStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
export type AccessReviewQueueReasonCode =
  | "NEW_USER"
  | "ROLE_MISMATCH"
  | "PROFILE_CHANGED"
  | "INACTIVE_BUT_ACTIVE";

export type AccessReviewQueueRow = {
  queue_id: number;
  user_id: number;
  citizen_id: string;
  user_name: string;
  current_role: string;
  is_active: number;
  reason_code: AccessReviewQueueReasonCode | string;
  status: AccessReviewQueueStatus;
  source_batch_id: number | null;
  last_seen_batch_id: number | null;
  first_detected_at: string;
  last_detected_at: string;
  opened_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
  note: string | null;
  payload_json?: Record<string, unknown> | null;
};

export type AccessReviewQueueListResponse = {
  rows: AccessReviewQueueRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    open_count: number;
    in_review_count: number;
    resolved_count: number;
    dismissed_count: number;
  };
  reason_options: string[];
};

export type AccessReviewQueueEvent = {
  event_id: number;
  queue_id: number;
  event_type: string;
  batch_id: number | null;
  actor_id: number | null;
  event_payload?: Record<string, unknown> | null;
  created_at: string;
};

export async function getAccessReviewCycles(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>("/access-review/cycles", {
    params,
  });
  return res.data.data;
}

export async function createAccessReviewCycle(payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    "/access-review/cycles",
    payload,
  );
  return res.data.data;
}

export async function getAccessReviewCycle(id: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/access-review/cycles/${id}`,
  );
  return res.data.data;
}

export async function getAccessReviewItems(
  id: number | string,
  params?: ApiParams,
) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/access-review/cycles/${id}/items`,
    { params },
  );
  return res.data.data;
}

export async function completeAccessReviewCycle(
  id: number | string,
  payload?: ApiPayload,
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/access-review/cycles/${id}/complete`,
    payload ?? {},
  );
  return res.data.data;
}

export async function updateAccessReviewItem(
  id: number | string,
  payload: ApiPayload,
) {
  const res = await api.put<ApiResponse<ApiPayload>>(
    `/access-review/items/${id}`,
    payload,
  );
  return res.data.data;
}

export async function autoReviewAccessReviewCycle(
  id: number | string,
  payload?: ApiPayload,
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/access-review/cycles/${id}/auto-review`,
    payload ?? {},
  );
  return res.data.data;
}

export async function getAccessReviewQueue(params?: {
  page?: number;
  limit?: number;
  status?: AccessReviewQueueStatus;
  reason_code?: string;
  current_role?: string;
  is_active?: 0 | 1;
  detected_from?: string;
  detected_to?: string;
  batch_id?: number;
  search?: string;
}) {
  const res = await api.get<ApiResponse<AccessReviewQueueListResponse>>(
    "/access-review/queue",
    { params },
  );
  return res.data.data;
}

export async function getAccessReviewQueueEvents(
  queueId: number | string,
  params?: { limit?: number },
) {
  const res = await api.get<ApiResponse<AccessReviewQueueEvent[]>>(
    `/access-review/queue/${queueId}/events`,
    { params },
  );
  return res.data.data;
}

export async function resolveAccessReviewQueueItem(
  queueId: number | string,
  payload: { action: "RESOLVE" | "DISMISS"; note?: string },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/access-review/queue/${queueId}/resolve`,
    payload,
  );
  return res.data.data;
}
