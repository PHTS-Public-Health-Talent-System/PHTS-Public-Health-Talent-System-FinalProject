import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import * as syncController from "@/modules/sync/sync.controller.js";
import {
  dataIssuesQuerySchema,
  refreshAccessReviewSchema,
  syncScheduleSchema,
  syncRecordsQuerySchema,
  syncBatchesQuerySchema,
  syncUserSchema,
  userSyncAuditsQuerySchema,
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
router.get(
  "/sync/issues",
  adminAuth,
  validate(dataIssuesQuerySchema),
  syncController.getDataIssues,
);
router.get(
  "/sync/records",
  adminAuth,
  validate(syncRecordsQuerySchema),
  syncController.getSyncRecords,
);
router.get(
  "/sync/user-audits",
  adminAuth,
  validate(userSyncAuditsQuerySchema),
  syncController.getUserSyncAudits,
);
router.get(
  "/sync/reconciliation",
  adminAuth,
  syncController.getSyncReconciliation,
);
router.get(
  "/sync/role-mapping-diagnostics",
  adminAuth,
  syncController.getRoleMappingDiagnostics,
);
router.get("/sync/schedule", adminAuth, syncController.getSyncSchedule);
router.put(
  "/sync/schedule",
  adminAuth,
  validate(syncScheduleSchema),
  syncController.updateSyncSchedule,
);

export default router;
