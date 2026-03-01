/**
 * signature module - API client
 *
 */
import api from "@/shared/api/axios";
import { ApiResponse } from "@/shared/api/types";
import type {
  SignatureCheckResult,
  SignatureData,
  SignatureRefreshResult,
} from "./types";

export async function getMySignature() {
  const res = await api.get<ApiResponse<SignatureData>>("/signatures/my-signature");
  return res.data.data;
}

export async function checkSignature() {
  const res = await api.get<ApiResponse<SignatureCheckResult>>("/signatures/check");
  return res.data.data;
}

export async function refreshMySignature() {
  const res = await api.post<ApiResponse<SignatureRefreshResult>>("/signatures/refresh");
  return res.data.data;
}
