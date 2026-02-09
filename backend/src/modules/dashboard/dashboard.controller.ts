import { Request, Response } from 'express';
import { catchAsync } from '@shared/utils/errors.js';
import type { ApiResponse } from '@/types/auth.js';
import { getUserDashboard } from '@/modules/dashboard/user-dashboard.service.js';
import { getHeadHrDashboard } from '@/modules/dashboard/head-hr-dashboard.service.js';

export const getUserDashboardSummary = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.userId || !req.user?.role) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const data = await getUserDashboard(req.user.userId, req.user.role);
    return res.json({ success: true, data });
  },
);

export const getHeadHrDashboardSummary = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const data = await getHeadHrDashboard(req.user.userId);
    return res.json({ success: true, data });
  },
);
