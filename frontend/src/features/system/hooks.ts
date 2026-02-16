"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiParams, ApiPayload } from '@/shared/api/types';
import {
  getJobStatus,
  getMaintenanceStatus,
  getVersionInfo,
  getUserById,
  getBackupHistory,
  searchUsers,
  toggleMaintenance,
  triggerBackup,
  triggerSync,
  triggerUserSync,
  updateUserRole,
} from './api';

export function useSearchUsers(params: ApiParams) {
  return useQuery({
    queryKey: ['system-users', params],
    queryFn: () => searchUsers(params),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number | string; payload: ApiPayload & { role: string } }) =>
      updateUserRole(userId, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['system-users'] });
      await queryClient.invalidateQueries({
        queryKey: ['system-user-by-id', variables.userId],
      });
    },
  });
}

export function useSystemUserById(userId: number | string | undefined) {
  return useQuery({
    queryKey: ['system-user-by-id', userId],
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
    mutationFn: (payload: { enabled: boolean; reason?: string }) => toggleMaintenance(payload),
  });
}

export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ['system-maintenance'],
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
    queryKey: ['system-backup-history', limit],
    queryFn: () => getBackupHistory(limit),
  });
}

export function useSystemJobStatus() {
  return useQuery({
    queryKey: ['system-jobs'],
    queryFn: getJobStatus,
  });
}

export function useSystemVersionInfo() {
  return useQuery({
    queryKey: ['system-version'],
    queryFn: getVersionInfo,
  });
}
