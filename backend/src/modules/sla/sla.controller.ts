/**
 * PHTS System - SLA Controller
 *
 * Handles HTTP requests for SLA operations.
 */

import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { ValidationError } from "@shared/utils/errors.js";
import { ApiResponse } from '@/types/auth.js';
import * as slaService from '@/modules/sla/services/sla.service.js';
import { formatDateOnly } from '@/shared/utils/date-only.js';

/**
 * Get all SLA configurations
 * GET /api/sla/config
 */
export async function getSLAConfigs(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const configs = await slaService.getSLAConfigs();
  res.json({ success: true, data: configs });
}

/**
 * Update SLA configuration for a step
 * PUT /api/sla/config/:stepNo
 */
export async function updateSLAConfig(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const stepNo = Number.parseInt(req.params.stepNo, 10);
  const { slaDays, reminderBeforeDays, reminderAfterDays } = req.body;

  if (!slaDays || slaDays < 1) {
    throw new ValidationError("slaDays must be at least 1");
  }

  await slaService.updateSLAConfig(
    stepNo,
    slaDays,
    reminderBeforeDays,
    reminderAfterDays,
  );
  res.json({ success: true, message: "SLA configuration updated" });
}

/**
 * Get SLA report
 * GET /api/sla/report
 */
export async function getSLAReport(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const report = await slaService.getSLAReport();
  res.json({ success: true, data: report });
}

export async function getSLAKpiOverview(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const { from, to } = req.query;
  const data = await slaService.getSLAKpiOverview({
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
  });
  res.json({ success: true, data });
}

export async function getSLAKpiByStep(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const { from, to } = req.query;
  const data = await slaService.getSLAKpiByStep({
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
  });
  res.json({ success: true, data });
}

export async function getSLAKpiBacklogAging(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const { as_of } = req.query;
  const data = await slaService.getSLAKpiBacklogAging({
    asOf: typeof as_of === "string" ? as_of : undefined,
  });
  res.json({ success: true, data });
}

export async function getSLAKpiDataQuality(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const { from, to } = req.query;
  const data = await slaService.getSLAKpiDataQuality({
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
  });
  res.json({ success: true, data });
}

export async function getSLAKpiErrorOverview(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const { from, to } = req.query;
  const data = await slaService.getSLAKpiErrorOverview({
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
  });
  res.json({ success: true, data });
}

/**
 * Get pending requests with SLA info
 * GET /api/sla/pending
 */
export async function getPendingRequestsWithSLA(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const { start, end } = req.query;
  const startDate = typeof start === "string" ? new Date(start) : null;
  const endDate = typeof end === "string" ? new Date(end) : null;
  if (startDate && Number.isNaN(startDate.getTime())) {
    throw new ValidationError("Invalid start date");
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new ValidationError("Invalid end date");
  }
  const requests = await slaService.getPendingRequestsWithSLA({
    startDate,
    endDate,
  });
  res.json({ success: true, data: requests });
}

/**
 * Manually trigger SLA reminders (for testing/admin)
 * POST /api/sla/send-reminders
 */
export async function sendReminders(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const result = await slaService.sendSLAReminders();
  res.json({
    success: true,
    data: result,
    message: `Sent ${result.approaching} approaching and ${result.overdue} overdue reminders`,
  });
}

/**
 * Calculate business days between two dates
 * GET /api/sla/calculate-days?start=&end=
 */
export async function calculateBusinessDays(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const { start, end } = req.query;

  if (!start || !end) {
    throw new ValidationError("start and end dates are required");
  }

  const startDate = new Date(start as string);
  const endDate = new Date(end as string);

  const businessDays = await slaService.calculateBusinessDays(
    startDate,
    endDate,
  );
  const appTimezone = process.env.APP_TIMEZONE || "Asia/Bangkok";

  res.json({
    success: true,
    data: {
      startDate: formatDateOnly(startDate, {
        timezone: appTimezone,
        fallbackTimezoneOffset: process.env.DB_TIMEZONE || "+07:00",
      }),
      endDate: formatDateOnly(endDate, {
        timezone: appTimezone,
        fallbackTimezoneOffset: process.env.DB_TIMEZONE || "+07:00",
      }),
      businessDays,
    },
  });
}

export const getSLAConfigsHandler = asyncHandler(getSLAConfigs);
export const updateSLAConfigHandler = asyncHandler(updateSLAConfig);
export const getSLAReportHandler = asyncHandler(getSLAReport);
export const getSLAKpiOverviewHandler = asyncHandler(getSLAKpiOverview);
export const getSLAKpiByStepHandler = asyncHandler(getSLAKpiByStep);
export const getSLAKpiBacklogAgingHandler = asyncHandler(getSLAKpiBacklogAging);
export const getSLAKpiDataQualityHandler = asyncHandler(getSLAKpiDataQuality);
export const getSLAKpiErrorOverviewHandler = asyncHandler(getSLAKpiErrorOverview);
export const getPendingRequestsWithSLAHandler = asyncHandler(getPendingRequestsWithSLA);
export const sendRemindersHandler = asyncHandler(sendReminders);
export const calculateBusinessDaysHandler = asyncHandler(calculateBusinessDays);
