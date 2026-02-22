import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import * as backupController from "@/modules/backup/backup.controller.js";
import { backupHistorySchema } from "@/modules/system/admin/admin.schema.js";

const router = Router();
const adminAuth = restrictTo(UserRole.ADMIN);

router.use(protect);

router.post("/backup", adminAuth, backupController.triggerBackup);
router.get(
  "/backup/history",
  adminAuth,
  validate(backupHistorySchema),
  backupController.getBackupHistory,
);

export default router;
