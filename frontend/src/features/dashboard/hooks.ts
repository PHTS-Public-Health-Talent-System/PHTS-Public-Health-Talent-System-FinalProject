"use client";

import { useQuery } from '@tanstack/react-query';
import { getUserDashboard, getHeadHrDashboard } from './api';

export function useUserDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'user'],
    queryFn: getUserDashboard,
  });
}

export function useHeadHrDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'head-hr'],
    queryFn: getHeadHrDashboard,
  });
}
