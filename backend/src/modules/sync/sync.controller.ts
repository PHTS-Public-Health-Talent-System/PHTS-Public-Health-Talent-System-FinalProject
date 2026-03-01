import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { SyncService } from "@/modules/sync/services/sync.service.js";
import { TransformMonitorRepository } from "@/modules/sync/repositories/transform-monitor.repository.js";
import {
  getSyncAutoScheduleConfig,
  setSyncAutoScheduleConfig,
} from "@/modules/sync/services/sync-auto-schedule.service.js";
import type {
  DataIssuesQuery,
  RefreshAccessReviewBody,
  SyncScheduleBody,
  SyncRecordsQuery,
  SyncBatchesQuery,
  SyncUserParams,
  UserSyncAuditsQuery,
} from "@/modules/sync/sync.schema.js";

export const triggerSync = asyncHandler(async (_req: Request, res: Response) => {
  const result = await SyncService.performFullSync({
    triggeredBy: _req.user?.userId ?? null,
  });
  res.json({ success: true, data: result });
});

export const refreshAccessReview = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as RefreshAccessReviewBody;
  const result = await SyncService.refreshAccessReviewOnly({
    triggeredBy: req.user?.userId ?? null,
    citizenId: body?.citizen_id ?? null,
  });
  res.json({ success: true, data: result });
});

export const triggerUserSync = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params as unknown as SyncUserParams;
    const result = await SyncService.performUserSync(Number(userId), {
      triggeredBy: req.user?.userId ?? null,
    });
    res.json({ success: true, data: result });
  },
);

export const getSyncBatches = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as SyncBatchesQuery;
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
  const data = await TransformMonitorRepository.getSyncBatches({
    page: safePage,
    limit: safeLimit,
  });
  res.json({ success: true, data });
});

export const getDataIssues = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, batch_id, target_table, issue_code, severity } =
    req.query as unknown as DataIssuesQuery;
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.max(1, Math.min(Number(limit || 50), 200));
  const data = await TransformMonitorRepository.getDataIssues({
    page: safePage,
    limit: safeLimit,
    batchId: batch_id ? Number(batch_id) : undefined,
    targetTable: target_table?.trim() || undefined,
    issueCode: issue_code?.trim() || undefined,
    severity: severity || undefined,
  });
  res.json({ success: true, data });
});

export const getSyncRecords = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, batch_id, target_table, search } = req.query as unknown as SyncRecordsQuery;
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 200));
  const data = await TransformMonitorRepository.getSyncRecords({
    page: safePage,
    limit: safeLimit,
    batchId: batch_id ? Number(batch_id) : undefined,
    targetTable: target_table,
    search: search?.trim() || undefined,
  });
  res.json({ success: true, data });
});

export const getUserSyncAudits = asyncHandler(async (req: Request, res: Response) => {
  const { limit, batch_id, citizen_id, action } = req.query as unknown as UserSyncAuditsQuery;
  const safeLimit = Math.max(1, Math.min(Number(limit || 100), 500));
  const data = await TransformMonitorRepository.getUserSyncStateAudits({
    limit: safeLimit,
    batchId: batch_id ? Number(batch_id) : undefined,
    citizenId: citizen_id,
    action,
  });
  res.json({ success: true, data });
});

export const getSyncReconciliation = asyncHandler(async (_req: Request, res: Response) => {
  const data = await SyncService.getReconciliationSummary();
  res.json({ success: true, data });
});

export const getRoleMappingDiagnostics = asyncHandler(async (_req: Request, res: Response) => {
  const data = await SyncService.getRoleMappingDiagnostics();
  res.json({ success: true, data });
});

export const getSyncSchedule = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSyncAutoScheduleConfig();
  res.json({ success: true, data });
});

export const updateSyncSchedule = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SyncScheduleBody;
  const data = await setSyncAutoScheduleConfig({
    mode: body.mode,
    hour: body.hour,
    minute: body.minute,
    interval_minutes: body.interval_minutes,
    timezone: body.timezone,
  });
  res.json({ success: true, data, message: "Sync schedule updated" });
});
