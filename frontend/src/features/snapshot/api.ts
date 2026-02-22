/**
 * snapshot module - API client
 *
 */
import api from "@/shared/api/axios";
import { ApiPayload, ApiResponse } from "@/shared/api/types";

export async function getPeriodWithSnapshot(id: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}`,
  );
  return res.data.data;
}

export async function getPeriodReadiness(id: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}/readiness`,
  );
  return res.data.data;
}

export async function getSnapshotsForPeriod(id: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}/snapshots`,
  );
  return res.data.data;
}

export async function getSnapshot(id: number | string, type: string) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}/snapshot/${type}`,
  );
  return res.data.data;
}

export async function getReportData(id: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}/report-data`,
  );
  return res.data.data;
}

export async function getSummaryData(id: number | string) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}/summary-data`,
  );
  return res.data.data;
}

export async function freezePeriod(id: number | string, payload?: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}/freeze`,
    payload ?? {},
  );
  return res.data.data;
}

export async function unfreezePeriod(id: number | string, payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/snapshots/periods/${id}/unfreeze`,
    payload,
  );
  return res.data.data;
}
