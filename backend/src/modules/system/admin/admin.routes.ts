/**
 * system module - route map
 *
 */
import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import * as systemController from "@/modules/system/admin/admin.controller.js";
import syncRoutes from "@/modules/system/sync/sync.routes.js";
import backupRoutes from "@/modules/system/backup/backup.routes.js";
import {
  searchUsersSchema,
  getUserByIdSchema,
  updateUserRoleSchema,
  toggleMaintenanceModeSchema,
} from "@/modules/system/admin/admin.schema.js";

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

router.post(
  "/maintenance",
  adminAuth,
  validate(toggleMaintenanceModeSchema),
  systemController.toggleMaintenanceMode,
);
router.get("/maintenance", adminAuth, systemController.getMaintenanceMode);
router.get("/jobs", adminAuth, systemController.getJobStatus);
router.get("/version", adminAuth, systemController.getVersionInfo);
router.use(syncRoutes);
router.use(backupRoutes);

export default router;
