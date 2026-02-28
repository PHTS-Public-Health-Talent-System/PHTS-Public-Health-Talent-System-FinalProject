/**
 * PHTS System - Access Review Routes
 *
 * API routes for access review operations.
 * Access restricted to ADMIN only (per FR-08-01)
 */

import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
import * as accessReviewController from '@/modules/access-review/access-review.controller.js';
import {
  autoReviewCycleSchema,
  getCyclesSchema,
  getCycleSchema,
  getItemsSchema,
  getQueueEventsSchema,
  getQueueSchema,
  resolveQueueItemSchema,
  updateItemSchema,
  completeCycleSchema,
} from '@/modules/access-review/access-review.schema.js';

const router = Router();

/**
 * All routes require authentication and ADMIN role
 */
router.use(protect);
router.use(restrictTo(UserRole.ADMIN));

// Get all review cycles
router.get(
  "/cycles",
  validate(getCyclesSchema),
  accessReviewController.getCycles,
);

// Create new review cycle
router.post("/cycles", accessReviewController.createCycle);

// Get a specific review cycle
router.get(
  "/cycles/:id",
  validate(getCycleSchema),
  accessReviewController.getCycle,
);

// Get review items for a cycle
router.get(
  "/cycles/:id/items",
  validate(getItemsSchema),
  accessReviewController.getItems,
);

// Get global review queue
router.get(
  "/queue",
  validate(getQueueSchema),
  accessReviewController.getQueue,
);

// Get queue events by queue id
router.get(
  "/queue/:id/events",
  validate(getQueueEventsSchema),
  accessReviewController.getQueueEvents,
);

// Resolve/dismiss queue item
router.post(
  "/queue/:id/resolve",
  validate(resolveQueueItemSchema),
  accessReviewController.resolveQueueItem,
);

// Complete a review cycle
router.post(
  "/cycles/:id/complete",
  validate(completeCycleSchema),
  accessReviewController.completeCycle,
);

router.post(
  "/cycles/:id/auto-review",
  validate(autoReviewCycleSchema),
  accessReviewController.autoReviewCycle,
);

// Update review result for a user
router.put(
  "/items/:id",
  validate(updateItemSchema),
  accessReviewController.updateItem,
);

export default router;
