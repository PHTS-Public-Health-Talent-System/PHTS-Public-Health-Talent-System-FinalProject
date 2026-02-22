/**
 * leave-management module - React query hooks
 *
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addLeaveRecordDocuments,
  deleteLeaveRecordDocument,
  listLeavePersonnel,
  listLeaveRecordDocuments,
  listLeaveRecords,
  deleteLeaveRecordExtension,
  upsertLeaveRecordExtension,
  createLeaveRecord,
  listLeaveReturnReportEvents,
  replaceLeaveReturnReportEvents,
  type LeaveRecordExtensionPayload,
  type LeaveRecordListResponse,
  type LeavePersonnelRow,
  getLeaveRecordStats,
  type LeaveRecordStats,
  type LeaveRecordCreatePayload,
  type LeaveReturnReportEvent,
} from "../api";

export function useLeaveRecords(
  params?: {
    citizen_id?: string;
    leave_type?: string;
    profession_code?: string;
    fiscal_year?: number;
    pending_report?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    sort_by?: "start_date" | "name";
    sort_dir?: "asc" | "desc";
  },
  options?: { enabled?: boolean },
) {
  return useQuery<LeaveRecordListResponse>({
    queryKey: ["leave-management", params ?? {}],
    queryFn: () => listLeaveRecords(params),
    enabled: options?.enabled ?? true,
    placeholderData: (prev) => prev,
  });
}

export function useUpsertLeaveRecordExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeaveRecordExtensionPayload) =>
      upsertLeaveRecordExtension(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-management"] });
    },
  });
}

export function useCreateLeaveRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeaveRecordCreatePayload) =>
      createLeaveRecord(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-management"] });
    },
  });
}

export function useDeleteLeaveRecordExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leaveRecordId: number | string) =>
      deleteLeaveRecordExtension(leaveRecordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-management"] });
    },
  });
}

export function useLeaveRecordDocuments(leaveRecordId: number | string | null) {
  return useQuery({
    queryKey: ["leave-record-documents", leaveRecordId],
    queryFn: () => listLeaveRecordDocuments(leaveRecordId!),
    enabled: !!leaveRecordId,
  });
}

export function useAddLeaveRecordDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leaveRecordId,
      files,
    }: {
      leaveRecordId: number | string;
      files: File[];
    }) => addLeaveRecordDocuments(leaveRecordId, files),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["leave-record-documents", variables.leaveRecordId],
      });
    },
  });
}

export function useDeleteLeaveRecordDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
    }: {
      documentId: number | string;
      leaveRecordId: number | string;
    }) => deleteLeaveRecordDocument(documentId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["leave-record-documents", variables.leaveRecordId],
      });
    },
  });
}

export function useLeaveRecordStats() {
  return useQuery<LeaveRecordStats>({
    queryKey: ["leave-management", "stats"],
    queryFn: () => getLeaveRecordStats(),
  });
}

export function useLeaveReturnReportEvents(
  leaveRecordId: number | string | null,
) {
  return useQuery<LeaveReturnReportEvent[]>({
    queryKey: ["leave-record-return-report-events", leaveRecordId],
    queryFn: () => listLeaveReturnReportEvents(leaveRecordId!),
    enabled: Boolean(leaveRecordId),
  });
}

export function useReplaceLeaveReturnReportEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leaveRecordId,
      events,
    }: {
      leaveRecordId: number | string;
      events: LeaveReturnReportEvent[];
    }) => replaceLeaveReturnReportEvents(leaveRecordId, events),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["leave-management"] });
      qc.invalidateQueries({
        queryKey: ["leave-record-return-report-events", vars.leaveRecordId],
      });
    },
  });
}

export function useLeavePersonnel(
  params?: { q?: string; limit?: number },
  options?: { enabled?: boolean },
) {
  return useQuery<LeavePersonnelRow[]>({
    queryKey: ["leave-management", "personnel", params ?? {}],
    queryFn: () => listLeavePersonnel(params),
    enabled: options?.enabled ?? true,
    placeholderData: (prev) => prev,
  });
}
