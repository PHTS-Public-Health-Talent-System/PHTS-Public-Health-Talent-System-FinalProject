/**
 * PHTS System - Finance Controller
 *
 * Handles HTTP requests for finance operations.
 */

import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import {
  AuthenticationError,
  AuthorizationError,
  BusinessError,
  NotFoundError,
} from "@shared/utils/errors.js";
import { ApiResponse } from '@/types/auth.js';
import {
  getFinanceDashboard,
  getFinanceSummary,
  getYearlySummary as getYearlySummaryData,
} from '@/modules/finance/services/summary.service.js';
import {
  getPayoutsByPeriod as getPayoutsByPeriodData,
  markPayoutAsPaid,
  batchMarkAsPaid as batchMarkAsPaidData,
  cancelPayout as cancelPayoutData,
} from '@/modules/finance/services/payment.service.js';
import type {
  GetSummaryQuery,
  GetYearlySummaryQuery,
  GetPayoutsByPeriodParams,
  GetPayoutsByPeriodQuery,
  MarkAsPaidParams,
  MarkAsPaidBody,
  BatchMarkAsPaidBody,
  CancelPayoutParams,
  CancelPayoutBody,
} from '@/modules/finance/finance.schema.js';

const mapFinanceServiceError = (error: unknown): Error => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("not found")) {
    if (message.includes("Period")) {
      return new NotFoundError("period");
    }
    if (message.includes("Payout")) {
      return new NotFoundError("payout");
    }
    return new NotFoundError("resource");
  }

  if (message === "งวดนี้ยังไม่ผ่านการอนุมัติปิดรอบจากผู้บริหาร") {
    return new AuthorizationError(message);
  }

  if (
    message.includes("already marked as paid") ||
    message.includes("is cancelled") ||
    message.includes("Cannot cancel PAID payout")
  ) {
    return new BusinessError(message);
  }

  return error instanceof Error ? error : new Error(message);
};

/**
 * Get finance dashboard overview
 * GET /api/finance/dashboard
 */
export const getDashboard = asyncHandler(async (
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const dashboard = await getFinanceDashboard();
  res.json({ success: true, data: dashboard });
});

/**
 * Get finance summary with optional filters
 * GET /api/finance/summary?year=&month=
 */
export const getSummary = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const { year, month } = req.query as GetSummaryQuery;
  const yearNum = year ? Number.parseInt(year, 10) : undefined;
  const monthNum = month ? Number.parseInt(month, 10) : undefined;

  const summary = await getFinanceSummary(yearNum, monthNum);
  res.json({ success: true, data: summary });
});

/**
 * Get yearly summary
 * GET /api/finance/yearly?year=
 */
export const getYearlySummary = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const { year } = req.query as GetYearlySummaryQuery;
  const yearNum = year ? Number.parseInt(year, 10) : undefined;

  const summary = await getYearlySummaryData(yearNum);
  res.json({ success: true, data: summary });
});

/**
 * Get payouts for a specific period
 * GET /api/finance/periods/:periodId/payouts?status=&search=
 */
export const getPayoutsByPeriod = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const { periodId } = req.params as unknown as GetPayoutsByPeriodParams;
  const query = req.query as Record<string, unknown>;
  const status = (typeof query.status === "string" ? query.status : undefined) as GetPayoutsByPeriodQuery["status"];
  const search = typeof query.search === "string" ? query.search : undefined;
  const professionCode = typeof query.professionCode === "string" ? query.professionCode : undefined;
  const groupNo = typeof query.groupNo === "string" ? query.groupNo : undefined;

  try {
    const payouts = await getPayoutsByPeriodData(
      Number.parseInt(periodId, 10),
      status,
      search?.trim(),
      professionCode,
      groupNo ? Number.parseInt(groupNo, 10) : undefined,
    );
    res.json({ success: true, data: payouts });
  } catch (error) {
    throw mapFinanceServiceError(error);
  }
});

/**
 * Mark a single payout as paid
 * POST /api/finance/payouts/:payoutId/mark-paid
 */
export const markAsPaid = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const { payoutId } = req.params as unknown as MarkAsPaidParams;
  const { comment } = req.body as MarkAsPaidBody;
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const userId = user.userId;

  try {
    await markPayoutAsPaid(
      Number.parseInt(payoutId, 10),
      userId,
      comment,
    );
    res.json({ success: true, message: "Payout marked as paid" });
  } catch (error) {
    throw mapFinanceServiceError(error);
  }
});

/**
 * Batch mark payouts as paid
 * POST /api/finance/payouts/batch-mark-paid
 */
export const batchMarkAsPaid = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const { payoutIds } = req.body as BatchMarkAsPaidBody;
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const userId = user.userId;

  const result = await batchMarkAsPaidData(payoutIds, userId);
  res.json({ success: true, data: result });
});

/**
 * Cancel a payout
 * POST /api/finance/payouts/:payoutId/cancel
 */
export const cancelPayout = asyncHandler(async (
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> => {
  const { payoutId } = req.params as unknown as CancelPayoutParams;
  const { reason } = req.body as CancelPayoutBody;
  const user = req.user;
  if (!user) {
    throw new AuthenticationError("Unauthorized access");
  }
  const userId = user.userId;

  try {
    await cancelPayoutData(
      Number.parseInt(payoutId, 10),
      userId,
      reason,
    );
    res.json({ success: true, message: "Payout cancelled" });
  } catch (error) {
    throw mapFinanceServiceError(error);
  }
});
