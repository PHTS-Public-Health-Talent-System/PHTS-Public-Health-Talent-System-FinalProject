import { Router } from "express";
import {
  downloadDetailReport,
  downloadSummaryReport,
} from '@/modules/report/report.controller.js';
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { UserRole } from '@/types/auth.js';
import { validate } from '@shared/validate.middleware.js';
import {
  downloadDetailReportSchema,
  downloadSummaryReportSchema,
} from '@/modules/report/report.schema.js';

const router = Router();

router.get(
  "/detail",
  protect,
  restrictTo(
    UserRole.DIRECTOR,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.FINANCE_OFFICER,
    UserRole.PTS_OFFICER,
  ),
  validate(downloadDetailReportSchema),
  downloadDetailReport,
);

router.get(
  "/summary",
  protect,
  restrictTo(
    UserRole.DIRECTOR,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.FINANCE_OFFICER,
    UserRole.PTS_OFFICER,
  ),
  validate(downloadSummaryReportSchema),
  downloadSummaryReport,
);

export default router;
