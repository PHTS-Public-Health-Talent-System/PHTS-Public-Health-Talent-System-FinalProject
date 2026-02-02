/**
 * PHTS System - Request Routes
 *
 * API routes for PTS request management and workflow
 *
 * Date: 2025-12-30
 */

import { Router } from "express";
import { protect, restrictTo } from "../../middlewares/authMiddleware.js";
import { requestUpload } from "../../config/upload.js";
import { requestController } from "./controllers/request.controller.js"; // Import instance
import { validate } from "../../shared/validate.middleware.js";
import { actionSchema, verificationSchema } from "./dto/update-status.dto.js"; // Use correct DTO file
import { verificationSnapshotSchema } from "./dto/verification-snapshot.dto.js";
import { UserRole } from "../../types/auth.js";
// Note: createRequestSchema is used inside controller manually for file upload handling, or added here if middleware used.
// Current controller implementation handles validation manually after file upload.

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Batch Approval Route
 * DIRECTOR only - must be before /:id routes to avoid conflicts
 */
router.post(
  "/batch-approve",
  restrictTo(UserRole.DIRECTOR),
  requestController.approveBatch,
);

/**
 * User Routes
 * Available to all authenticated users
 */

// Master rates and recommended rate
router.get("/master-rates", requestController.getMasterRates);
router.get("/prefill", requestController.getPrefill);
router.post("/:id/attachments/confirm", requestController.confirmAttachments);
router.get(
  "/:id/recommended-classification",
  requestController.getRecommendedClassification,
);
router.post("/:id/classification", requestController.updateClassification);

// Create new request with file uploads and signature
router.post(
  "/",
  requestUpload.fields([
    { name: "files", maxCount: 10 },
    { name: "license_file", maxCount: 1 },
    { name: "applicant_signature", maxCount: 1 },
  ]),
  requestController.createRequest,
);

// Get current user's requests
router.get("/", requestController.getMyRequests);

// Get user's available scopes (for multi-scope dropdown)
router.get(
  "/my-scopes",
  restrictTo(UserRole.HEAD_WARD, UserRole.HEAD_DEPT),
  requestController.getMyScopes,
);

// Get pending requests for approval (based on user's role)
// Optional query param: ?scope=<scope_name> to filter to a specific scope
router.get(
  "/pending",
  restrictTo(
    UserRole.HEAD_WARD,
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE,
  ),
  requestController.getPendingApprovals,
);

// OCR for attachments (PTS_OFFICER only)
router.get(
  "/attachments/:attachmentId/ocr",
  requestController.getAttachmentOcr,
);
router.post(
  "/attachments/:attachmentId/ocr",
  requestController.requestAttachmentOcr,
);

// Get approval history for current approver
router.get(
  "/history",
  restrictTo(
    UserRole.HEAD_WARD,
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  requestController.getHistory,
);

// Get list of available PTS_OFFICER users for reassignment
router.get(
  "/pts-officers",
  restrictTo(UserRole.PTS_OFFICER),
  requestController.getAvailableOfficers,
);

// Get request details by ID
router.get("/:id", requestController.getRequestById);

// Update a request (Owner only, DRAFT or RETURNED status)
router.put(
  "/:id",
  requestUpload.fields([
    { name: "files", maxCount: 10 },
    { name: "license_file", maxCount: 1 },
    { name: "applicant_signature", maxCount: 1 },
  ]),
  requestController.updateRequest,
);

// Update verification checks (qualification/evidence)
router.put(
  "/:id/verification",
  restrictTo(UserRole.PTS_OFFICER, UserRole.HEAD_HR),
  validate(verificationSchema),
  requestController.updateVerificationChecks,
);
router.post(
  "/:id/verification-snapshot",
  restrictTo(UserRole.PTS_OFFICER, UserRole.HEAD_HR),
  validate(verificationSnapshotSchema),
  requestController.createVerificationSnapshot,
);

// Cancel a request (Owner only, before APPROVED)
router.post("/:id/cancel", requestController.cancelRequest);

// Unified action endpoint (APPROVE / REJECT / RETURN)
router.post(
  "/:id/action",
  restrictTo(
    UserRole.HEAD_WARD,
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE,
  ),
  validate(actionSchema),
  requestController.processAction,
);

// Submit a draft request
router.post("/:id/submit", requestController.submitRequest);

/**
 * Approver Routes
 * Restricted to users with approval roles
 */

// Approve a request
router.post(
  "/:id/approve",
  restrictTo(
    UserRole.HEAD_WARD,
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE,
  ),
  requestController.approveRequest,
);

// Reject a request
router.post(
  "/:id/reject",
  restrictTo(
    UserRole.HEAD_WARD,
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE,
  ),
  requestController.rejectRequest,
);

// Return a request to previous step
router.post(
  "/:id/return",
  restrictTo(
    UserRole.HEAD_WARD,
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE,
  ),
  requestController.returnRequest,
);

/**
 * Reassign Routes
 * PTS_OFFICER only - transfer pending requests to another officer
 */

// Reassign a request to another PTS_OFFICER
router.post(
  "/:id/reassign",
  restrictTo(UserRole.PTS_OFFICER),
  requestController.reassignRequest,
);

// Get reassignment history for a request
router.get("/:id/reassign-history", requestController.getReassignHistory);
// Adjust leave details (PTS_OFFICER only)
router.put(
  "/:id/adjust-leave",
  restrictTo(UserRole.PTS_OFFICER),
  requestController.adjustLeaveRequest,
);

export default router;
