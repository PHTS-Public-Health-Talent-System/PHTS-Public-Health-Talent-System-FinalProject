import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import * as syncController from "@/modules/sync/sync.controller.js";
import {
  createTransformRuleSchema,
  dataIssuesQuerySchema,
  refreshAccessReviewSchema,
  syncBatchesQuerySchema,
  syncUserSchema,
  transformLogsQuerySchema,
  updateTransformRuleSchema,
} from "@/modules/sync/sync.schema.js";

const router = Router();
const adminAuth = restrictTo(UserRole.ADMIN);

router.use(protect);

router.post("/sync", adminAuth, syncController.triggerSync);
router.post(
  "/sync/access-review/refresh",
  adminAuth,
  validate(refreshAccessReviewSchema),
  syncController.refreshAccessReview,
);
router.get(
  "/sync/batches",
  adminAuth,
  validate(syncBatchesQuerySchema),
  syncController.getSyncBatches,
);
router.post(
  "/users/:userId/sync",
  adminAuth,
  validate(syncUserSchema),
  syncController.triggerUserSync,
);
router.get("/sync/rules", adminAuth, syncController.getTransformRules);
router.get(
  "/sync/logs",
  adminAuth,
  validate(transformLogsQuerySchema),
  syncController.getTransformLogs,
);
router.get(
  "/sync/issues",
  adminAuth,
  validate(dataIssuesQuerySchema),
  syncController.getDataIssues,
);
router.post(
  "/sync/rules",
  adminAuth,
  validate(createTransformRuleSchema),
  syncController.createTransformRule,
);
router.patch(
  "/sync/rules/:ruleId",
  adminAuth,
  validate(updateTransformRuleSchema),
  syncController.updateTransformRule,
);

export default router;
