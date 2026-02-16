import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
import {
  getActiveAnnouncements,
  getAllAnnouncements,
  postAnnouncement,
  putAnnouncement,
  activateAnnouncement,
  deactivateAnnouncement,
} from '@/modules/announcement/announcement.controller.js';
import {
  announcementIdSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '@/modules/announcement/announcement.schema.js';

const router = Router();

router.get("/active", protect, getActiveAnnouncements);

router.get(
  "/",
  protect,
  restrictTo(UserRole.ADMIN),
  getAllAnnouncements,
);

router.post(
  "/",
  protect,
  restrictTo(UserRole.ADMIN),
  validate(createAnnouncementSchema),
  postAnnouncement,
);

router.put(
  "/:id",
  protect,
  restrictTo(UserRole.ADMIN),
  validate(updateAnnouncementSchema),
  putAnnouncement,
);

router.put(
  "/:id/activate",
  protect,
  restrictTo(UserRole.ADMIN),
  validate(announcementIdSchema),
  activateAnnouncement,
);

router.put(
  "/:id/deactivate",
  protect,
  restrictTo(UserRole.ADMIN),
  validate(announcementIdSchema),
  deactivateAnnouncement,
);

export default router;
