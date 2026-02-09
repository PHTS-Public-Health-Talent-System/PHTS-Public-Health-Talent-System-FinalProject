"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiParams } from '@/shared/api/types';
import {
  exportAuditEvents,
  getAuditEventTypes,
  getAuditSummary,
  getEntityAuditTrail,
  searchAuditEvents,
} from './api';

export function useAuditEventTypes() {
  return useQuery({
    queryKey: ['audit-event-types'],
    queryFn: getAuditEventTypes,
  });
}

export function useAuditSummary(params?: ApiParams) {
  return useQuery({
    queryKey: ['audit-summary', params ?? {}],
    queryFn: () => getAuditSummary(params),
  });
}

export function useAuditEvents(params?: ApiParams) {
  return useQuery({
    queryKey: ['audit-events', params ?? {}],
    queryFn: () => searchAuditEvents(params),
  });
}

export function useExportAuditEvents() {
  return useMutation({
    mutationFn: (params?: ApiParams) => exportAuditEvents(params),
  });
}

export function useEntityAuditTrail(entityType: string, entityId: number | string | undefined) {
  return useQuery({
    queryKey: ['audit-entity', entityType, entityId],
    queryFn: () => getEntityAuditTrail(entityType, entityId!),
    enabled: !!entityId,
  });
}
