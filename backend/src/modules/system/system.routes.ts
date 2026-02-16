import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
import * as systemController from '@/modules/system/system.controller.js';
import {
  searchUsersSchema,
  getUserByIdSchema,
  updateUserRoleSchema,
  toggleMaintenanceModeSchema,
  syncUserSchema,
  backupHistorySchema,
} from '@/modules/system/system.schema.js';

const router = Router();

// All routes require authentication
router.use(protect);

// Admin only
const adminAuth = restrictTo(UserRole.ADMIN);

router.get(
  "/users",
  adminAuth,
  validate(searchUsersSchema),
  systemController.searchUsers,
);
router.get(
  "/users/:userId",
  adminAuth,
  validate(getUserByIdSchema),
  systemController.getUserById,
);
router.put(
  "/users/:userId/role",
  adminAuth,
  validate(updateUserRoleSchema),
  systemController.updateUserRole,
);

router.post("/sync", adminAuth, systemController.triggerSync);
router.post(
  "/users/:userId/sync",
  adminAuth,
  validate(syncUserSchema),
  systemController.triggerUserSync,
);
router.post(
  "/maintenance",
  adminAuth,
  validate(toggleMaintenanceModeSchema),
  systemController.toggleMaintenanceMode,
);
router.get("/maintenance", adminAuth, systemController.getMaintenanceMode);
router.post("/backup", adminAuth, systemController.triggerBackup);
router.get(
  "/backup/history",
  adminAuth,
  validate(backupHistorySchema),
  systemController.getBackupHistory,
);
router.get("/jobs", adminAuth, systemController.getJobStatus);
router.get("/version", adminAuth, systemController.getVersionInfo);

export default router;
