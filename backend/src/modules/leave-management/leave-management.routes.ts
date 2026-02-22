/**
 * leave-management module - route map
 *
 */
import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { upload } from "@config/upload.js";
import { UserRole } from "@/types/auth.js";
import {
  listLeaveManagementSchema,
  listLeavePersonnelSchema,
  createLeaveManagementSchema,
  upsertLeaveManagementExtensionSchema,
  listLeaveReturnEventsSchema,
  replaceLeaveReturnEventsSchema,
  leaveManagementIdParamSchema,
  leaveDocumentIdParamSchema,
} from "./leave-management.schema.js";
import {
  listLeaveManagement,
  listLeavePersonnel,
  createLeaveManagement,
  getLeaveManagementStats,
  upsertLeaveManagementExtension,
  listLeaveReturnReportEvents,
  replaceLeaveReturnReportEvents,
  listLeaveManagementDocuments,
  addLeaveManagementDocuments,
  deleteLeaveManagementDocument,
  deleteLeaveManagementExtension,
} from "./controllers/leave-management.controller.js";

const router = Router();

router.use(protect);
router.use(restrictTo(UserRole.PTS_OFFICER));

router.get("/", validate(listLeaveManagementSchema), listLeaveManagement);

router.get(
  "/personnel",
  validate(listLeavePersonnelSchema),
  listLeavePersonnel,
);

router.post("/", validate(createLeaveManagementSchema), createLeaveManagement);

router.get("/stats", getLeaveManagementStats);

router.put(
  "/extensions",
  validate(upsertLeaveManagementExtensionSchema),
  upsertLeaveManagementExtension,
);

router.get(
  "/:leaveManagementId/return-report-events",
  validate(listLeaveReturnEventsSchema),
  listLeaveReturnReportEvents,
);

router.put(
  "/:leaveManagementId/return-report-events",
  validate(replaceLeaveReturnEventsSchema),
  replaceLeaveReturnReportEvents,
);

router.delete(
  "/extensions/:leaveManagementId",
  validate(leaveManagementIdParamSchema),
  deleteLeaveManagementExtension,
);

router.get(
  "/:leaveManagementId/documents",
  validate(leaveManagementIdParamSchema),
  listLeaveManagementDocuments,
);

router.post(
  "/:leaveManagementId/documents",
  validate(leaveManagementIdParamSchema),
  upload.array("files", 10),
  addLeaveManagementDocuments,
);

router.delete(
  "/documents/:documentId",
  validate(leaveDocumentIdParamSchema),
  deleteLeaveManagementDocument,
);

export default router;
