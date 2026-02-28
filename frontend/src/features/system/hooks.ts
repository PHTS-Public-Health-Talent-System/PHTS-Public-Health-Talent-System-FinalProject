/**
 * system module - React query hooks
 *
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiParams, ApiPayload } from "@/shared/api/types";
import {
  getBackupHistory,
  getBackupSchedule,
  getJobStatus,
  getMaintenanceStatus,
  getSyncSchedule,
  getSyncBatches,
  getDataIssues,
  getSyncRecords,
  getSnapshotOutbox,
  getSyncReconciliation,
  getUserSyncAudits,
  getUserById,
  getVersionInfo,
  retrySnapshotDeadLetters,
  retrySnapshotOutbox,
  searchUsers,
  toggleMaintenance,
  triggerBackup,
  triggerSync,
  triggerUserSync,
  updateBackupSchedule,
  updateSyncSchedule,
  updateUserRole,
} from "./api";
import type { SnapshotOutboxFilterStatus, UserSyncAuditAction } from "./types";

export function useSearchUsers(params: ApiParams) {
  return useQuery({
    queryKey: ["system-users", params],
    queryFn: () => searchUsers(params),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number | string;
      payload: ApiPayload & { role: string };
    }) => updateUserRole(userId, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["system-users"] });
      await queryClient.invalidateQueries({
        queryKey: ["system-user-by-id", variables.userId],
      });
    },
  });
}

export function useSystemUserById(userId: number | string | undefined) {
  return useQuery({
    queryKey: ["system-user-by-id", userId],
    queryFn: () => getUserById(userId!),
    enabled: !!userId,
  });
}

export function useTriggerSync() {
  return useMutation({
    mutationFn: triggerSync,
  });
}

export function useTriggerUserSync() {
  return useMutation({
    mutationFn: (userId: number | string) => triggerUserSync(userId),
  });
}

export function useToggleMaintenance() {
  return useMutation({
    mutationFn: (payload: { enabled: boolean; reason?: string }) =>
      toggleMaintenance(payload),
  });
}

export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ["system-maintenance"],
    queryFn: getMaintenanceStatus,
  });
}

export function useTriggerBackup() {
  return useMutation({
    mutationFn: triggerBackup,
  });
}

export function useBackupHistory(limit: number = 20) {
  return useQuery({
    queryKey: ["system-backup-history", limit],
    queryFn: () => getBackupHistory(limit),
  });
}

export function useBackupSchedule() {
  return useQuery({
    queryKey: ["system-backup-schedule"],
    queryFn: getBackupSchedule,
  });
}

export function useUpdateBackupSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { hour: number; minute: number }) =>
      updateBackupSchedule(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-backup-schedule"] });
      await queryClient.invalidateQueries({ queryKey: ["system-backup-history"] });
    },
  });
}

export function useSyncSchedule() {
  return useQuery({
    queryKey: ["system-sync-schedule"],
    queryFn: getSyncSchedule,
  });
}

export function useUpdateSyncSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      mode: "DAILY" | "INTERVAL";
      hour?: number;
      minute?: number;
      interval_minutes?: number;
      timezone?: string;
    }) => updateSyncSchedule(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-sync-schedule"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-batches"] });
    },
  });
}

export function useSystemJobStatus() {
  return useQuery({
    queryKey: ["system-jobs"],
    queryFn: getJobStatus,
  });
}

export function useSystemVersionInfo() {
  return useQuery({
    queryKey: ["system-version"],
    queryFn: getVersionInfo,
  });
}

export function useSyncReconciliation() {
  return useQuery({
    queryKey: ["sync-reconciliation"],
    queryFn: getSyncReconciliation,
    refetchInterval: 60_000,
  });
}

export function useSyncBatches(limit: number = 20) {
  return useQuery({
    queryKey: ['sync-batches', limit],
    queryFn: () => getSyncBatches(limit),
    refetchInterval: 60_000,
  });
}

export function useUserSyncAudits(params?: {
  limit?: number;
  batch_id?: number;
  citizen_id?: string;
  action?: UserSyncAuditAction;
}, options?: { enabled?: boolean }) {
  const normalized = {
    limit: params?.limit ?? 20,
    batch_id: params?.batch_id,
    citizen_id: params?.citizen_id,
    action: params?.action,
  };
  return useQuery({
    queryKey: ["sync-user-audits", normalized],
    queryFn: () => getUserSyncAudits(normalized),
    enabled: options?.enabled ?? true,
    refetchInterval: 60_000,
  });
}

export function useDataIssues(params?: {
  page?: number;
  limit?: number;
  batch_id?: number;
  target_table?: string;
  issue_code?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH";
}) {
  const normalized = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    batch_id: params?.batch_id,
    target_table: params?.target_table,
    issue_code: params?.issue_code,
    severity: params?.severity,
  };
  return useQuery({
    queryKey: ["sync-data-issues", normalized],
    queryFn: () => getDataIssues(normalized),
    refetchInterval: 60_000,
  });
}

export function useSyncRecords(params?: {
  page?: number;
  limit?: number;
  batch_id?: number;
  target_table?: string;
  search?: string;
}) {
  const normalized = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    batch_id: params?.batch_id,
    target_table: params?.target_table,
    search: params?.search,
  };
  return useQuery({
    queryKey: ["sync-records", normalized],
    queryFn: () => getSyncRecords(normalized),
    refetchInterval: 60_000,
  });
}

export function useSnapshotOutbox(params?: {
  page?: number;
  limit?: number;
  status?: SnapshotOutboxFilterStatus;
  period_id?: number;
}) {
  const normalized = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    status: params?.status,
    period_id: params?.period_id,
  };
  return useQuery({
    queryKey: ["snapshot-outbox", normalized],
    queryFn: () => getSnapshotOutbox(normalized),
    refetchInterval: 60_000,
  });
}

export function useRetrySnapshotOutbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (outboxId: number) => retrySnapshotOutbox(outboxId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["snapshot-outbox"] });
      await queryClient.invalidateQueries({ queryKey: ["system-jobs"] });
    },
  });
}

export function useRetrySnapshotDeadLetters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retrySnapshotDeadLetters,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["snapshot-outbox"] });
      await queryClient.invalidateQueries({ queryKey: ["system-jobs"] });
    },
  });
}
