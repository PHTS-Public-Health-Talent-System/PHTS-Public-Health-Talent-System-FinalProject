/**
 * dashboard module - request orchestration
 *
 */
import { Request, Response } from "express";
import { catchAsync } from "@shared/utils/errors.js";
import type { ApiResponse } from "@/types/auth.js";
import { getUserDashboard } from "@/modules/dashboard/services/user-dashboard.service.js";
import { getApproverDashboard } from "@/modules/dashboard/services/approver-dashboard.service.js";
import { UserRole } from "@/types/auth.js";

export const getUserDashboardSummary = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const data = await getUserDashboard(req.user.userId, req.user.role);
    return res.json({ success: true, data });
  },
);

export const getApproverDashboardSummary = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const role = req.user.role as UserRole;

    const data = await getApproverDashboard(req.user.userId, role);
    return res.json({ success: true, data });
  },
);

// Backward-compatible export name during route migration.
export const getHeadHrDashboardSummary = getApproverDashboardSummary;
