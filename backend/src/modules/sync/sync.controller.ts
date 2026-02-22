import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { SyncService } from "@/modules/sync/services/sync.service.js";
import { TransformMonitorRepository } from "@/modules/sync/repositories/transform-monitor.repository.js";
import type {
  CreateTransformRuleBody,
  DataIssuesQuery,
  RefreshAccessReviewBody,
  SyncBatchesQuery,
  SyncUserParams,
  TransformLogsQuery,
  UpdateTransformRuleBody,
  UpdateTransformRuleParams,
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
  const { limit } = req.query as unknown as SyncBatchesQuery;
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
  const data = await TransformMonitorRepository.getSyncBatches(safeLimit);
  res.json({ success: true, data });
});

export const getTransformRules = asyncHandler(async (_req: Request, res: Response) => {
  const data = await TransformMonitorRepository.getTransformRules();
  res.json({ success: true, data });
});

export const getTransformLogs = asyncHandler(async (req: Request, res: Response) => {
  const { limit, batch_id } = req.query as unknown as TransformLogsQuery;
  const safeLimit = Math.max(1, Math.min(Number(limit || 50), 200));
  const data = await TransformMonitorRepository.getTransformLogs({
    limit: safeLimit,
    batchId: batch_id ? Number(batch_id) : undefined,
  });
  res.json({ success: true, data });
});

export const getDataIssues = asyncHandler(async (req: Request, res: Response) => {
  const { limit, status } = req.query as unknown as DataIssuesQuery;
  const safeLimit = Math.max(1, Math.min(Number(limit || 50), 200));
  const data = await TransformMonitorRepository.getDataIssues({
    limit: safeLimit,
    status,
  });
  res.json({ success: true, data });
});

export const createTransformRule = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateTransformRuleBody;
  const actorId = req.user?.userId ?? null;
  const ruleId = await TransformMonitorRepository.createTransformRule({
    targetView: body.target_view,
    targetField: body.target_field,
    ruleType: body.rule_type,
    matchPattern: body.match_pattern ?? null,
    replaceValue: body.replace_value ?? null,
    priority: body.priority ?? 100,
    isActive: body.is_active ?? true,
    notes: body.notes ?? null,
    actorId,
  });
  const data = await TransformMonitorRepository.getTransformRuleById(ruleId);
  res.status(201).json({ success: true, data });
});

export const updateTransformRule = asyncHandler(async (req: Request, res: Response) => {
  const { ruleId } = req.params as unknown as UpdateTransformRuleParams;
  const body = req.body as UpdateTransformRuleBody;
  const actorId = req.user?.userId ?? null;
  await TransformMonitorRepository.updateTransformRule(Number(ruleId), {
    matchPattern: body.match_pattern,
    replaceValue: body.replace_value,
    priority: body.priority,
    isActive: body.is_active,
    notes: body.notes,
    actorId,
  });
  const data = await TransformMonitorRepository.getTransformRuleById(Number(ruleId));
  if (!data) {
    res.status(404).json({ success: false, error: "Transform rule not found" });
    return;
  }
  res.json({ success: true, data });
});
