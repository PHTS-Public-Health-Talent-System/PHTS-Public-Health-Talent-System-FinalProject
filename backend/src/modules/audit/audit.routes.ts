/**
 * PHTS System - Audit Trail Routes
 *
 * API routes for audit trail operations.
 * Per Access_Control_Matrix.txt Line 146: ADMIN เท่านั้น
 */

import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { UserRole } from '@types/auth.js';
import * as auditController from '@/modules/audit/audit.controller.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Audit trail access is restricted to ADMIN only
 * Per Access_Control_Matrix.txt: "ADMIN: ดาวน์โหลดรายงาน Audit Trail เพื่อการตรวจสอบ"
 */

// Get available event types for filtering
router.get(
  "/event-types",
  restrictTo(UserRole.ADMIN),
  auditController.getEventTypes,
);

// Get audit summary
router.get("/summary", restrictTo(UserRole.ADMIN), auditController.getSummary);

// Search audit events
router.get("/events", restrictTo(UserRole.ADMIN), auditController.searchEvents);

// Export audit events
router.get("/export", restrictTo(UserRole.ADMIN), auditController.exportEvents);

// Get audit trail for a specific entity
router.get(
  "/entity/:entityType/:entityId",
  restrictTo(UserRole.ADMIN),
  auditController.getEntityAuditTrail,
);

export default router;
