import { Router } from "express";
import { protect } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import * as notifCtrl from '@/modules/notification/notification.controller.js';
import { markReadSchema, notificationSettingsSchema } from '@/modules/notification/notification.schema.js';

const router = Router();

router.use(protect);

router.get("/", notifCtrl.getMyNotifications);
router.put("/:id/read", validate(markReadSchema), notifCtrl.markRead);
router.get("/settings", notifCtrl.getNotificationSettings);
router.put(
  "/settings",
  validate(notificationSettingsSchema),
  notifCtrl.updateNotificationSettings,
);

export default router;
