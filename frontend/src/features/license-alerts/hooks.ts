"use client";

import { useQuery } from '@tanstack/react-query';
import type { ApiParams } from '@/shared/api/types';
import { getLicenseAlertsList, getLicenseAlertsSummary } from './api';

export function useLicenseAlertsSummary() {
  return useQuery({
    queryKey: ['license-alerts-summary'],
    queryFn: getLicenseAlertsSummary,
  });
}

export function useLicenseAlertsList(params?: ApiParams) {
  return useQuery({
    queryKey: ['license-alerts-list', params ?? {}],
    queryFn: () => getLicenseAlertsList(params),
  });
}
