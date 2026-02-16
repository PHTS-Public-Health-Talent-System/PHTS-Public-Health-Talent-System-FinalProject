/**
 * PHTS System - Finance Routes
 *
 * API routes for finance operations (payment status, dashboard).
 */

import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
import * as financeController from '@/modules/finance/finance.controller.js';
import {
  getSummarySchema,
  getYearlySummarySchema,
  getPayoutsByPeriodSchema,
  markAsPaidSchema,
  batchMarkAsPaidSchema,
  cancelPayoutSchema,
} from '@/modules/finance/finance.schema.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Dashboard & Summary Routes
 */

// Finance dashboard overview (no input validation needed)
router.get(
  "/dashboard",
  restrictTo(UserRole.FINANCE_OFFICER),
  financeController.getDashboard,
);

// Finance summary with filters
router.get(
  "/summary",
  restrictTo(UserRole.FINANCE_OFFICER),
  validate(getSummarySchema),
  financeController.getSummary,
);

// Yearly summary
router.get(
  "/yearly",
  restrictTo(UserRole.FINANCE_OFFICER),
  validate(getYearlySummarySchema),
  financeController.getYearlySummary,
);

// Get payouts for a specific period
router.get(
  "/periods/:periodId/payouts",
  restrictTo(UserRole.FINANCE_OFFICER),
  validate(getPayoutsByPeriodSchema),
  financeController.getPayoutsByPeriod,
);

/**
 * Payment Status Routes
 */

// Mark single payout as paid
router.post(
  "/payouts/:payoutId/mark-paid",
  restrictTo(UserRole.FINANCE_OFFICER),
  validate(markAsPaidSchema),
  financeController.markAsPaid,
);

// Batch mark as paid
router.post(
  "/payouts/batch-mark-paid",
  restrictTo(UserRole.FINANCE_OFFICER),
  validate(batchMarkAsPaidSchema),
  financeController.batchMarkAsPaid,
);

// Cancel a payout
router.post(
  "/payouts/:payoutId/cancel",
  restrictTo(UserRole.FINANCE_OFFICER, UserRole.HEAD_FINANCE),
  validate(cancelPayoutSchema),
  financeController.cancelPayout,
);

export default router;
