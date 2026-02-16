/**
 * PHTS System - Snapshot Controller
 *
 * Handles HTTP requests for snapshot operations.
 */

import { Request, Response } from "express";
import { ApiResponse } from '@/types/auth.js';
import * as snapshotService from '@/modules/snapshot/services/snapshot.service.js';
import { SnapshotType } from '@/modules/snapshot/services/snapshot.service.js';

/**
 * Get period with snapshot info
 * GET /api/snapshots/periods/:id
 */
export async function getPeriodWithSnapshot(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const period = await snapshotService.getPeriodWithSnapshot(periodId);

    if (!period) {
      res.status(404).json({ success: false, error: "Period not found" });
      return;
    }

    res.json({ success: true, data: period });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Freeze a period
 * POST /api/snapshots/periods/:id/freeze
 */
export async function freezePeriod(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const userId = req.user!.userId;

    await snapshotService.freezePeriod(periodId, userId);
    res.json({ success: true, message: "Period frozen successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * Unfreeze a period (admin only)
 * POST /api/snapshots/periods/:id/unfreeze
 */
export async function unfreezePeriod(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const userId = req.user!.userId;
    const { reason } = req.body;

    await snapshotService.unfreezePeriod(periodId, userId, reason);
    res.json({ success: true, message: "Period unfrozen successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * Get snapshot by type
 * GET /api/snapshots/periods/:id/snapshot/:type
 */
export async function getSnapshot(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const snapshotType = req.params.type.toUpperCase() as SnapshotType;

    if (!Object.values(SnapshotType).includes(snapshotType)) {
      res.status(400).json({ success: false, error: "Invalid snapshot type" });
      return;
    }

    const snapshot = await snapshotService.getSnapshot(periodId, snapshotType);

    if (!snapshot) {
      res.status(404).json({ success: false, error: "Snapshot not found" });
      return;
    }

    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get all snapshots for a period
 * GET /api/snapshots/periods/:id/snapshots
 */
export async function getSnapshotsForPeriod(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const snapshots = await snapshotService.getSnapshotsForPeriod(periodId);
    res.json({ success: true, data: snapshots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get payout data for report (respects freeze status)
 * GET /api/snapshots/periods/:id/report-data
 */
export async function getReportData(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const data = await snapshotService.getPayoutDataForReport(periodId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get summary data for report (respects freeze status)
 * GET /api/snapshots/periods/:id/summary-data
 */
export async function getSummaryData(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const data = await snapshotService.getSummaryDataForReport(periodId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Check if period is frozen
 * GET /api/snapshots/periods/:id/is-frozen
 */
export async function checkFrozen(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const periodId = Number.parseInt(req.params.id, 10);
    const isFrozen = await snapshotService.isPeriodFrozen(periodId);
    res.json({ success: true, data: { is_frozen: isFrozen } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
