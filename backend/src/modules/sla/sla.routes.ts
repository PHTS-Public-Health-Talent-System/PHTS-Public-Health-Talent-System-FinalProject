/**
 * PHTS System - SLA Routes
 *
 * API routes for SLA operations.
 */

import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
import * as slaController from '@/modules/sla/sla.controller.js';
import {
  updateSLAConfigSchema,
  calculateBusinessDaysSchema,
} from '@/modules/sla/sla.schema.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

// Get SLA configurations (PTS_OFFICER, ADMIN)
router.get(
  "/config",
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN, UserRole.HEAD_HR, UserRole.DIRECTOR),
  slaController.getSLAConfigs,
);

// Update SLA configuration (ADMIN only)
router.put(
  "/config/:stepNo",
  restrictTo(UserRole.ADMIN),
  validate(updateSLAConfigSchema),
  slaController.updateSLAConfig,
);

// Get SLA report (PTS_OFFICER, HEAD_HR, DIRECTOR, ADMIN)
router.get(
  "/report",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAReport,
);

router.get(
  "/kpi/overview",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiOverview,
);

router.get(
  "/kpi/by-step",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiByStep,
);

router.get(
  "/kpi/backlog-aging",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiBacklogAging,
);

router.get(
  "/kpi/data-quality",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiDataQuality,
);

router.get(
  "/kpi/error",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiErrorOverview,
);

// Get pending requests with SLA info (PTS_OFFICER, ADMIN)
router.get(
  "/pending",
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN, UserRole.HEAD_HR, UserRole.DIRECTOR),
  slaController.getPendingRequestsWithSLA,
);

// Manual trigger for reminders (ADMIN only)
router.post(
  "/send-reminders",
  restrictTo(UserRole.ADMIN),
  slaController.sendReminders,
);

// Calculate business days utility
router.get(
  "/calculate-days",
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  validate(calculateBusinessDaysSchema),
  slaController.calculateBusinessDays,
);

export default router;
