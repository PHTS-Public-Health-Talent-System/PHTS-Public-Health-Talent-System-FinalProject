"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiParams, ApiPayload } from '@/shared/api/types';
import {
  searchUsers,
  toggleMaintenance,
  triggerBackup,
  triggerSync,
  updateUserRole,
} from './api';

export function useSearchUsers(params: ApiParams) {
  return useQuery({
    queryKey: ['system-users', params],
    queryFn: () => searchUsers(params),
  });
}

export function useUpdateUserRole() {
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number | string; payload: ApiPayload & { role: string } }) =>
      updateUserRole(userId, payload),
  });
}

export function useTriggerSync() {
  return useMutation({
    mutationFn: triggerSync,
  });
}

export function useToggleMaintenance() {
  return useMutation({
    mutationFn: (payload: { enabled: boolean; reason?: string }) => toggleMaintenance(payload),
  });
}

export function useTriggerBackup() {
  return useMutation({
    mutationFn: triggerBackup,
  });
}
