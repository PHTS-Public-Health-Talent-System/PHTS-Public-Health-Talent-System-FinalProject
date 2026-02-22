/**
 * dashboard module - route map
 *
 */
import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { UserRole } from "@/types/auth.js";
import {
  getUserDashboardSummary,
  getApproverDashboardSummary,
} from "@/modules/dashboard/controllers/dashboard.controller.js";

const router = Router();

router.use(protect);

router.get("/user", getUserDashboardSummary);
router.get(
  "/approver",
  restrictTo(UserRole.HEAD_HR, UserRole.HEAD_FINANCE),
  getApproverDashboardSummary,
);

// Backward-compatible alias. Prefer using /dashboard/approver.
router.get(
  "/head-hr",
  restrictTo(UserRole.HEAD_HR, UserRole.HEAD_FINANCE),
  getApproverDashboardSummary,
);

export default router;
