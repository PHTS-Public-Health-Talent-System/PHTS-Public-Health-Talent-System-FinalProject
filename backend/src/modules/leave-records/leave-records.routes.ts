import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { upload } from '@config/upload.js';
import { UserRole } from '@/types/auth.js';
import {
  listLeaveRecordsSchema,
  listLeavePersonnelSchema,
  createLeaveRecordSchema,
  upsertLeaveRecordExtensionSchema,
  leaveRecordIdParamSchema,
  leaveDocumentIdParamSchema,
} from './leave-records.schema.js';
import {
  listLeaveRecords,
  listLeavePersonnel,
  createLeaveRecord,
  getLeaveRecordStats,
  upsertLeaveRecordExtension,
  listLeaveRecordDocuments,
  addLeaveRecordDocuments,
  deleteLeaveRecordDocument,
  deleteLeaveRecordExtension,
} from './controllers/leave-records.controller.js';

const router = Router();

router.use(protect);
router.use(restrictTo(UserRole.PTS_OFFICER));

router.get(
  '/',
  validate(listLeaveRecordsSchema),
  listLeaveRecords,
);

router.get(
  '/personnel',
  validate(listLeavePersonnelSchema),
  listLeavePersonnel,
);

router.post(
  '/',
  validate(createLeaveRecordSchema),
  createLeaveRecord,
);

router.get(
  '/stats',
  getLeaveRecordStats,
);

router.put(
  '/extensions',
  validate(upsertLeaveRecordExtensionSchema),
  upsertLeaveRecordExtension,
);

router.delete(
  '/extensions/:leaveRecordId',
  validate(leaveRecordIdParamSchema),
  deleteLeaveRecordExtension,
);

router.get(
  '/:leaveRecordId/documents',
  validate(leaveRecordIdParamSchema),
  listLeaveRecordDocuments,
);

router.post(
  '/:leaveRecordId/documents',
  validate(leaveRecordIdParamSchema),
  upload.array('files', 10),
  addLeaveRecordDocuments,
);

router.delete(
  '/documents/:documentId',
  validate(leaveDocumentIdParamSchema),
  deleteLeaveRecordDocument,
);

export default router;
