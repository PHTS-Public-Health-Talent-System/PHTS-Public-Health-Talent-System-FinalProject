import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@types/auth.js';
import {
  getRetirements,
  postRetirement,
  putRetirement,
  removeRetirement,
} from '@/modules/alerts/alerts.controller.js';
import {
  getLicenseList,
  getLicenseSummary,
} from '@/modules/alerts/license-alerts.controller.js';
import {
  retirementCreateSchema,
  retirementIdSchema,
  retirementUpdateSchema,
} from '@/modules/alerts/alerts.schema.js';

const router = Router();

router.get(
  "/retirements",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  getRetirements,
);

router.post(
  "/retirements",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(retirementCreateSchema),
  postRetirement,
);

router.put(
  "/retirements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(retirementUpdateSchema),
  putRetirement,
);

router.delete(
  "/retirements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(retirementIdSchema),
  removeRetirement,
);

router.get(
  "/license/summary",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  getLicenseSummary,
);

router.get(
  "/license/list",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  getLicenseList,
);

export default router;
