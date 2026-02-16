/**
 * PHTS System - Authentication Routes
 *
 * Defines API endpoints for authentication operations
 *
 * Date: 2025-12-30
 */

import { Router } from "express";
import * as authController from '@/modules/auth/auth.controller.js';
import { protect } from '@middlewares/authMiddleware.js';
import { authRateLimiter } from '@middlewares/rateLimiter.js';
import { validate } from '@shared/validate.middleware.js';
import { loginSchema, updateProfileSchema } from '@/modules/auth/auth.schema.js';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 * @body    { citizen_id: string, password: string }
 * @returns { success: boolean, token: string, user: UserProfile }
 */
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user's profile
 * @access  Protected
 * @returns { success: boolean, data: UserProfile }
 */
router.get("/me", protect, authController.getCurrentUser);

/**
 * @route   PATCH /api/auth/me
 * @desc    Update current authenticated user's profile fields
 * @access  Protected
 */
router.patch("/me", protect, validate(updateProfileSchema), authController.updateCurrentUser);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Protected
 * @returns { success: boolean, message: string }
 */
router.post("/logout", protect, authController.logout);

export default router;
