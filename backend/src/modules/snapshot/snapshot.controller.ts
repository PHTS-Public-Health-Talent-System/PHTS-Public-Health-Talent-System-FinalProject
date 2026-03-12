/**
 * PHTS System - Snapshot Controller
 *
 * Handles HTTP requests for snapshot operations.
 */

import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "@shared/utils/errors.js";
import { ApiResponse } from '@/types/auth.js';
import * as snapshotService from '@/modules/snapshot/services/snapshot.service.js';
import { SnapshotType } from '@/modules/snapshot/services/snapshot.service.js';

/**
 * Get period with snapshot info
 * GET /api/snapshots/periods/:id
 */
export const getPeriodWithSnapshot = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  const period = await snapshotService.getPeriodWithSnapshot(periodId);

  if (!period) {
    throw new NotFoundError("period", periodId);
  }

  res.json({ success: true, data: period });
});

/**
 * Freeze a period
 * POST /api/snapshots/periods/:id/freeze
 */
export const freezePeriod = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const userId = user.userId;

  try {
    await snapshotService.freezePeriod(periodId, userId);
    res.json({ success: true, message: "Period frozen successfully" });
  } catch (error) {
    throw new ValidationError((error as Error).message);
  }
});

/**
 * Unfreeze a period (admin + PTS officer)
 * POST /api/snapshots/periods/:id/unfreeze
 */
export const unfreezePeriod = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const userId = user.userId;
  const { reason } = req.body;

  try {
    await snapshotService.unfreezePeriod(periodId, userId, reason);
    res.json({ success: true, message: "Period unfrozen successfully" });
  } catch (error) {
    throw new ValidationError((error as Error).message);
  }
});

/**
 * Get snapshot by type
 * GET /api/snapshots/periods/:id/snapshot/:type
 */
export const getSnapshot = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  const snapshotType = req.params.type.toUpperCase() as SnapshotType;

  if (!Object.values(SnapshotType).includes(snapshotType)) {
    throw new ValidationError("Invalid snapshot type");
  }

  const snapshot = await snapshotService.getSnapshot(periodId, snapshotType);

  if (!snapshot) {
    throw new NotFoundError("snapshot");
  }

  res.json({ success: true, data: snapshot });
});

/**
 * Get all snapshots for a period
 * GET /api/snapshots/periods/:id/snapshots
 */
export const getSnapshotsForPeriod = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  const snapshots = await snapshotService.getSnapshotsForPeriod(periodId);
  res.json({ success: true, data: snapshots });
});

/**
 * Get payout data for report (requires snapshot ready)
 * GET /api/snapshots/periods/:id/report-data
 */
export const getReportData = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  try {
    const data = await snapshotService.getPayoutDataForReport(periodId);
    res.json({ success: true, data });
  } catch (error) {
    if (String((error as Error)?.message) === "SNAPSHOT_NOT_READY") {
      res.status(409).json({
        success: false,
        error: "Snapshot is not ready for this period",
        data: { code: "SNAPSHOT_NOT_READY" },
      });
      return;
    }
    throw error;
  }
});

/**
 * Get summary data for report (requires snapshot ready)
 * GET /api/snapshots/periods/:id/summary-data
 */
export const getSummaryData = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  try {
    const data = await snapshotService.getSummaryDataForReport(periodId);
    res.json({ success: true, data });
  } catch (error) {
    if (String((error as Error)?.message) === "SNAPSHOT_NOT_READY") {
      res.status(409).json({
        success: false,
        error: "Snapshot is not ready for this period",
        data: { code: "SNAPSHOT_NOT_READY" },
      });
      return;
    }
    throw error;
  }
});

/**
 * Check snapshot readiness for report gating
 * GET /api/snapshots/periods/:id/readiness
 */
export const getSnapshotReadiness = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const periodId = Number.parseInt(req.params.id, 10);
  const period = await snapshotService.getPeriodWithSnapshot(periodId);
  if (!period) {
    throw new NotFoundError("period", periodId);
  }
  const snapshotStatus = String(period.snapshot_status ?? "").toUpperCase();
  const isReady = snapshotStatus === "READY";
  res.json({
    success: true,
    data: {
      is_ready: isReady,
      snapshot_status: snapshotStatus || "PENDING",
      snapshot_ready_at: period.snapshot_ready_at ?? null,
    },
  });
});
