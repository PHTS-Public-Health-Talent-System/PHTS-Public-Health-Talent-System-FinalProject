/**
 * PHTS System - SLA Controller
 *
 * Handles HTTP requests for SLA operations.
 */

import { Request, Response } from "express";
import { ApiResponse } from '@/types/auth.js';
import * as slaService from '@/modules/sla/services/sla.service.js';

/**
 * Get all SLA configurations
 * GET /api/sla/config
 */
export async function getSLAConfigs(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const configs = await slaService.getSLAConfigs();
    res.json({ success: true, data: configs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update SLA configuration for a step
 * PUT /api/sla/config/:stepNo
 */
export async function updateSLAConfig(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const stepNo = Number.parseInt(req.params.stepNo, 10);
    const { slaDays, reminderBeforeDays, reminderAfterDays } = req.body;

    if (!slaDays || slaDays < 1) {
      res
        .status(400)
        .json({ success: false, error: "slaDays must be at least 1" });
      return;
    }

    await slaService.updateSLAConfig(
      stepNo,
      slaDays,
      reminderBeforeDays,
      reminderAfterDays,
    );
    res.json({ success: true, message: "SLA configuration updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get SLA report
 * GET /api/sla/report
 */
export async function getSLAReport(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const report = await slaService.getSLAReport();
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSLAKpiOverview(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { from, to } = req.query;
    const data = await slaService.getSLAKpiOverview({
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSLAKpiByStep(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { from, to } = req.query;
    const data = await slaService.getSLAKpiByStep({
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSLAKpiBacklogAging(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { as_of } = req.query;
    const data = await slaService.getSLAKpiBacklogAging({
      asOf: typeof as_of === "string" ? as_of : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSLAKpiDataQuality(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { from, to } = req.query;
    const data = await slaService.getSLAKpiDataQuality({
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSLAKpiErrorOverview(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { from, to } = req.query;
    const data = await slaService.getSLAKpiErrorOverview({
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get pending requests with SLA info
 * GET /api/sla/pending
 */
export async function getPendingRequestsWithSLA(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { start, end } = req.query;
    const startDate = typeof start === "string" ? new Date(start) : null;
    const endDate = typeof end === "string" ? new Date(end) : null;
    if (startDate && Number.isNaN(startDate.getTime())) {
      res.status(400).json({ success: false, error: "Invalid start date" });
      return;
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      res.status(400).json({ success: false, error: "Invalid end date" });
      return;
    }
    const requests = await slaService.getPendingRequestsWithSLA({
      startDate,
      endDate,
    });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Manually trigger SLA reminders (for testing/admin)
 * POST /api/sla/send-reminders
 */
export async function sendReminders(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const result = await slaService.sendSLAReminders();
    res.json({
      success: true,
      data: result,
      message: `Sent ${result.approaching} approaching and ${result.overdue} overdue reminders`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Calculate business days between two dates
 * GET /api/sla/calculate-days?start=&end=
 */
export async function calculateBusinessDays(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      res
        .status(400)
        .json({ success: false, error: "start and end dates are required" });
      return;
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    const businessDays = await slaService.calculateBusinessDays(
      startDate,
      endDate,
    );

    res.json({
      success: true,
      data: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        businessDays,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
