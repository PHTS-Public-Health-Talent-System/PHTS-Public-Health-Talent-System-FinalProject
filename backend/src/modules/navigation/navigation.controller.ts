import { Request, Response } from 'express';
import { catchAsync } from '@shared/utils/errors.js';
import type { ApiResponse } from '@/types/auth.js';
import { getNavigationPayload } from '@/modules/navigation/navigation.service.js';

export const getNavigation = catchAsync(
  async (req: Request, res: Response<ApiResponse>) => {
    if (!req.user?.userId || !req.user?.citizenId || !req.user?.role) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const data = await getNavigationPayload({
      userId: req.user.userId,
      citizenId: req.user.citizenId,
      role: req.user.role,
    });

    return res.json({ success: true, data });
  },
);
