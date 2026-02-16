"use client";

import { useMutation } from '@tanstack/react-query';
import { downloadDetailReport, downloadSummaryReport } from './api';
import type { ApiParams } from '@/shared/api/types';

export function useDownloadDetailReport() {
  return useMutation({
    mutationFn: (params?: ApiParams) => downloadDetailReport(params),
  });
}

export function useDownloadSummaryReport() {
  return useMutation({
    mutationFn: (params?: ApiParams) => downloadSummaryReport(params),
  });
}
