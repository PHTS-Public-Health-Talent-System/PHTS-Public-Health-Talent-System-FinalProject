/**
 * PHTS System - Finance Controller
 *
 * Handles HTTP requests for finance operations.
 */

import { Request, Response } from "express";
import { ApiResponse } from '@/types/auth.js';
import * as financeService from '@/modules/finance/services/finance.service.js';
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

/**
 * Get finance dashboard overview
 * GET /api/finance/dashboard
 */
export async function getDashboard(
  _req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const dashboard = await financeService.getFinanceDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get finance summary with optional filters
 * GET /api/finance/summary?year=&month=
 */
export async function getSummary(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { year, month } = req.query as GetSummaryQuery;
    const yearNum = year ? Number.parseInt(year, 10) : undefined;
    const monthNum = month ? Number.parseInt(month, 10) : undefined;

    const summary = await financeService.getFinanceSummary(yearNum, monthNum);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get yearly summary
 * GET /api/finance/yearly?year=
 */
export async function getYearlySummary(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { year } = req.query as GetYearlySummaryQuery;
    const yearNum = year ? Number.parseInt(year, 10) : undefined;

    const summary = await financeService.getYearlySummary(yearNum);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get payouts for a specific period
 * GET /api/finance/periods/:periodId/payouts?status=&search=
 */
export async function getPayoutsByPeriod(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { periodId } = req.params as unknown as GetPayoutsByPeriodParams;
    const { status, search } = req.query as GetPayoutsByPeriodQuery;

    const payouts = await financeService.getPayoutsByPeriod(
      Number.parseInt(periodId, 10),
      status,
      search?.trim(),
    );
    res.json({ success: true, data: payouts });
  } catch (error: any) {
    const message = error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
    if (message.includes('not found')) {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (message === 'งวดนี้ยังไม่ผ่านการอนุมัติปิดรอบจากผู้บริหาร') {
      res.status(403).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * Mark a single payout as paid
 * POST /api/finance/payouts/:payoutId/mark-paid
 */
export async function markAsPaid(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { payoutId } = req.params as unknown as MarkAsPaidParams;
    const { comment } = req.body as MarkAsPaidBody;
    const userId = req.user!.userId;

    await financeService.markPayoutAsPaid(
      Number.parseInt(payoutId, 10),
      userId,
      comment,
    );
    res.json({ success: true, message: "Payout marked as paid" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * Batch mark payouts as paid
 * POST /api/finance/payouts/batch-mark-paid
 */
export async function batchMarkAsPaid(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { payoutIds } = req.body as BatchMarkAsPaidBody;
    const userId = req.user!.userId;

    const result = await financeService.batchMarkAsPaid(payoutIds, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Cancel a payout
 * POST /api/finance/payouts/:payoutId/cancel
 */
export async function cancelPayout(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    const { payoutId } = req.params as unknown as CancelPayoutParams;
    const { reason } = req.body as CancelPayoutBody;
    const userId = req.user!.userId;

    await financeService.cancelPayout(
      Number.parseInt(payoutId, 10),
      userId,
      reason,
    );
    res.json({ success: true, message: "Payout cancelled" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}
