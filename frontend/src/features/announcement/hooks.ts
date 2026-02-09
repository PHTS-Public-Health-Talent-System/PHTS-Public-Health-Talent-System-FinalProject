"use client";

import { useQuery } from '@tanstack/react-query';
import { getActiveAnnouncements } from './api';

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: getActiveAnnouncements,
  });
}
