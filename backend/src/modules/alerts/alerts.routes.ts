import { Router } from "express";
import { protect, restrictTo } from "../../middlewares/authMiddleware.js";
import { validate } from "../../shared/validate.middleware.js";
import { UserRole } from "../../types/auth.js";
import {
  getRetirements,
  postRetirement,
  putRetirement,
  removeRetirement,
} from "./alerts.controller.js";
import {
  getLicenseList,
  getLicenseSummary,
} from "./license-alerts.controller.js";
import { retirementSchema } from "./alerts.schema.js";

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
  validate(retirementSchema),
  postRetirement,
);

router.put(
  "/retirements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
  validate(retirementSchema),
  putRetirement,
);

router.delete(
  "/retirements/:id",
  protect,
  restrictTo(UserRole.PTS_OFFICER),
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
