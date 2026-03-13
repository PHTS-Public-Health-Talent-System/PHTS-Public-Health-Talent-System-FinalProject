/**
 * PHTS System - Access Review Controller
 *
 * Handles HTTP requests for access review operations.
 */

import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "@shared/utils/errors.js";
import { ApiResponse } from '@/types/auth.js';
import * as accessReviewService from '@/modules/access-review/services/access-review.service.js';
import { ReviewResult } from '@/modules/access-review/services/access-review.service.js';

function mapCycleResponse(cycle: any): any {
  return {
    ...cycle,
    source: cycle.sync_source ?? "SYNC",
    cycle_code: cycle.cycle_code ?? `SYNC-${cycle.cycle_id}`,
    opened_at: cycle.opened_at ?? cycle.start_date,
    expires_at: cycle.expires_at ?? cycle.due_date,
    is_open: cycle.status !== "COMPLETED",
  };
}

/**
 * Get all review cycles
 * GET /api/access-review/cycles
 */
export const getCycles = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const year = req.query.year
    ? Number.parseInt(req.query.year as string, 10)
    : undefined;
  const cycles = await accessReviewService.getReviewCycles(year);
  res.json({ success: true, data: cycles.map((cycle) => mapCycleResponse(cycle)) });
});

/**
 * Get a specific review cycle
 * GET /api/access-review/cycles/:id
 */
export const getCycle = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const cycleId = Number.parseInt(req.params.id, 10);
  const cycle = await accessReviewService.getReviewCycle(cycleId);

  if (!cycle) {
    throw new NotFoundError("review cycle", cycleId);
  }

  res.json({ success: true, data: mapCycleResponse(cycle) });
});

/**
 * Create a review cycle from latest sync context
 * POST /api/access-review/cycles
 */
export const createCycle = asyncHandler(async (
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const cycle = await accessReviewService.createReviewCycle();
  res.status(201).json({ success: true, data: mapCycleResponse(cycle) });
});

/**
 * Get review items for a cycle
 * GET /api/access-review/cycles/:id/items
 */
export const getItems = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const cycleId = Number.parseInt(req.params.id, 10);
  const result = req.query.result as ReviewResult | undefined;

  const items = await accessReviewService.getReviewItems(cycleId, result);
  res.json({ success: true, data: items });
});

/**
 * Get review queue (global pending view)
 * GET /api/access-review/queue
 */
export const getQueue = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const query = req.query as Record<string, unknown>;
  const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

  const page = asString(query.page) ? Number.parseInt(String(query.page), 10) : 1;
  const limit = asString(query.limit) ? Number.parseInt(String(query.limit), 10) : 20;
  const batchId = asString(query.batch_id) ? Number.parseInt(String(query.batch_id), 10) : undefined;
  const status = asString(query.status) as accessReviewService.AccessReviewQueueListInput["status"];
  const reasonCode = asString(query.reason_code);
  const currentRole = asString(query.current_role);
  const isActive = query.is_active !== undefined ? Number(query.is_active) : undefined;
  const detectedFrom = asString(query.detected_from);
  const detectedTo = asString(query.detected_to);

  const queue = await accessReviewService.getAccessReviewQueue({
    page,
    limit,
    status,
    reasonCode,
    currentRole,
    isActive,
    detectedFrom,
    detectedTo,
    batchId,
  });
  res.json({ success: true, data: queue });
});

/**
 * Get queue events timeline
 * GET /api/access-review/queue/:id/events
 */
export const getQueueEvents = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const queueId = Number.parseInt(req.params.id, 10);
  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 100;
  const events = await accessReviewService.getAccessReviewQueueEvents(queueId, limit);
  res.json({ success: true, data: events });
});

/**
 * Resolve or dismiss queue item
 * POST /api/access-review/queue/:id/resolve
 */
export const resolveQueueItem = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const queueId = Number.parseInt(req.params.id, 10);
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const reviewerId = user.userId;
  const { action, note } = req.body as {
    action: "RESOLVE" | "DISMISS";
    note?: string;
  };
  await accessReviewService.resolveAccessReviewQueueItem({
    queueId,
    actorId: reviewerId,
    action,
    note: note ?? null,
  });
  res.json({ success: true, message: "Queue item updated" });
});

/**
 * Resolve or dismiss multiple queue items
 * POST /api/access-review/queue/bulk-resolve
 */
export const bulkResolveQueueItems = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const reviewerId = user.userId;
  const { queue_ids, action, note } = req.body as {
    queue_ids: number[];
    action: "RESOLVE" | "DISMISS";
    note?: string;
  };
  const result = await accessReviewService.resolveAccessReviewQueueItems({
    queueIds: queue_ids,
    actorId: reviewerId,
    action,
    note: note ?? null,
  });
  res.json({ success: true, data: result, message: "Queue items updated" });
});

/**
 * Update review result for a user
 * PUT /api/access-review/items/:id
 */
export const updateItem = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const itemId = Number.parseInt(req.params.id, 10);
  const { result, note } = req.body;
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const reviewerId = user.userId;

  if (!result || !Object.values(ReviewResult).includes(result)) {
    throw new ValidationError("Invalid review result");
  }

  await accessReviewService.updateReviewItem(
    itemId,
    result,
    reviewerId,
    note,
  );
  res.json({ success: true, message: "Review item updated" });
});

/**
 * Complete a review cycle
 * POST /api/access-review/cycles/:id/complete
 */
export const completeCycle = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const cycleId = Number.parseInt(req.params.id, 10);
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const completedBy = user.userId;
  const { autoKeepPending, note } = (req.body ?? {}) as {
    autoKeepPending?: boolean;
    note?: string;
  };

  await accessReviewService.completeReviewCycle(cycleId, completedBy, {
    autoKeepPending: Boolean(autoKeepPending),
    note,
  });
  res.json({ success: true, message: "Review cycle completed" });
});

/**
 * Auto-review pending items by sync-derived rules
 * POST /api/access-review/cycles/:id/auto-review
 */
export const autoReviewCycle = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const cycleId = Number.parseInt(req.params.id, 10);
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const reviewerId = user.userId;
  const { disableInactive } = (req.body ?? {}) as {
    disableInactive?: boolean;
  };
  const result = await accessReviewService.autoReviewCycle(cycleId, reviewerId, {
    disableInactive: disableInactive ?? true,
  });
  res.json({ success: true, data: result });
});
