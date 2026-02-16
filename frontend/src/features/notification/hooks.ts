"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyNotifications, markNotificationRead, getNotificationSettings, updateNotificationSettings, deleteReadNotifications } from './api';

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ['navigation'] });

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: getMyNotifications,
    refetchInterval: 60000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      invalidateNavigation(qc);
    },
  });
}

export function useDeleteReadNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { older_than_days?: number }) => deleteReadNotifications(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      invalidateNavigation(qc);
    },
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: getNotificationSettings,
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-settings'] }),
  });
}
