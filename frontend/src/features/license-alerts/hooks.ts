"use client";

import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiParams } from '@/shared/api/types';
import { getLicenseAlertsList, getLicenseAlertsSummary, notifyLicenseAlerts } from './api';

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

export function useNotifyLicenseAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ citizen_id: string; bucket: 'expired' | '30' | '60' | '90' }>) =>
      notifyLicenseAlerts(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['license-alerts-summary'] });
    },
  });
}
