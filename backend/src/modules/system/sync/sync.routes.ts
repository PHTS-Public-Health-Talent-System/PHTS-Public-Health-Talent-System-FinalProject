import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import * as syncController from "@/modules/system/sync/sync.controller.js";
import { syncUserSchema } from "@/modules/system/system.schema.js";

const router = Router();
const adminAuth = restrictTo(UserRole.ADMIN);

router.use(protect);

router.post("/sync", adminAuth, syncController.triggerSync);
router.post(
  "/users/:userId/sync",
  adminAuth,
  validate(syncUserSchema),
  syncController.triggerUserSync,
);

export default router;
