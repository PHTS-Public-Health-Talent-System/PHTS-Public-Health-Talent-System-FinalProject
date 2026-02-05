import { Router } from "express";
import {
  downloadDetailReport,
  downloadSummaryReport,
} from '@/modules/report/report.controller.js';
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { UserRole } from '@types/auth.js';

const router = Router();

router.get(
  "/detail",
  protect,
  restrictTo(
    UserRole.ADMIN,
    UserRole.DIRECTOR,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.FINANCE_OFFICER,
    UserRole.PTS_OFFICER,
  ),
  downloadDetailReport,
);

router.get(
  "/summary",
  protect,
  restrictTo(
    UserRole.ADMIN,
    UserRole.DIRECTOR,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.FINANCE_OFFICER,
    UserRole.PTS_OFFICER,
  ),
  downloadSummaryReport,
);

export default router;
