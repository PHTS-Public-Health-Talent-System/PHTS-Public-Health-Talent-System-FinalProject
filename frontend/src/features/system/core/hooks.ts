/**
 * system module - React query hooks
 *
 */
"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
    placeholderData: keepPreviousData,
    staleTime: 30_000,
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-users"] });
      await queryClient.invalidateQueries({ queryKey: ["system-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-reconciliation"] });
      await queryClient.invalidateQueries({ queryKey: ["access-review-queue"] });
    },
  });
}

export function useTriggerUserSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number | string) => triggerUserSync(userId),
    onSuccess: async (_data, userId) => {
      await queryClient.invalidateQueries({ queryKey: ["system-users"] });
      await queryClient.invalidateQueries({
        queryKey: ["system-user-by-id", userId],
      });
      await queryClient.invalidateQueries({ queryKey: ["access-review-queue"] });
    },
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
    staleTime: 60_000,
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
    staleTime: 60_000,
  });
}

export function useBackupSchedule() {
  return useQuery({
    queryKey: ["system-backup-schedule"],
    queryFn: getBackupSchedule,
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
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
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useSystemVersionInfo() {
  return useQuery({
    queryKey: ["system-version"],
    queryFn: getVersionInfo,
    staleTime: 30 * 60_000,
  });
}

export function useSyncReconciliation() {
  return useQuery({
    queryKey: ["sync-reconciliation"],
    queryFn: getSyncReconciliation,
    refetchInterval: 60_000,
  });
}

export function useInfiniteSyncBatches(limit: number = 20) {
  return useInfiniteQuery({
    queryKey: ['sync-batches', 'infinite', limit],
    queryFn: ({ pageParam }) =>
      getSyncBatches({
        page: pageParam,
        limit,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
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
    placeholderData: keepPreviousData,
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
    placeholderData: keepPreviousData,
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
    placeholderData: keepPreviousData,
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
    placeholderData: keepPreviousData,
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
