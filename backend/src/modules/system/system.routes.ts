import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@types/auth.js';
import * as systemController from '@/modules/system/system.controller.js';
import {
  searchUsersSchema,
  updateUserRoleSchema,
  toggleMaintenanceModeSchema,
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
router.put(
  "/users/:userId/role",
  adminAuth,
  validate(updateUserRoleSchema),
  systemController.updateUserRole,
);

router.post("/sync", adminAuth, systemController.triggerSync);
router.post(
  "/maintenance",
  adminAuth,
  validate(toggleMaintenanceModeSchema),
  systemController.toggleMaintenanceMode,
);
router.post("/backup", adminAuth, systemController.triggerBackup);

export default router;
