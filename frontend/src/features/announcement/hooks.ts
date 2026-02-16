"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateAnnouncement,
  createAnnouncement,
  deactivateAnnouncement,
  getActiveAnnouncements,
  getAllAnnouncements,
  updateAnnouncement,
} from './api';

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: getActiveAnnouncements,
  });
}

export function useAllAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'all'],
    queryFn: getAllAnnouncements,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: Parameters<typeof updateAnnouncement>[1] }) =>
      updateAnnouncement(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useActivateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => activateAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useDeactivateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deactivateAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}
