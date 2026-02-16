/**
 * PHTS System - Authentication Controller
 *
 * Handles HTTP requests for authentication operations
 *
 * Date: 2025-12-30
 */

import { Request, Response } from "express";
import {
  LoginResponse,
  ApiResponse,
  UserProfile,
} from '@/types/auth.js';
import { extractRequestInfo } from '@/modules/audit/services/audit.service.js';
import { LoginSchema } from '@/modules/auth/auth.schema.js';
import type { UpdateProfileSchema } from '@/modules/auth/auth.schema.js';
import {
  AuthService,
  AuthenticationError,
  AccountDisabledError,
  InvalidCitizenIdError,
} from '@/modules/auth/services/auth.service.js';

/**
 * Login Handler
 *
 * Authenticates user with citizen_id and password
 * Returns JWT token on successful authentication
 *
 * @route POST /api/auth/login
 * @access Public
 */
export async function login(
  req: Request<object, object, LoginSchema>,
  res: Response<LoginResponse | ApiResponse>,
): Promise<void> {
  try {
    const { citizen_id, password } = req.body;
    const requestInfo = extractRequestInfo(req);

    const result = await AuthService.login(citizen_id, password, requestInfo);

    res.status(200).json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof InvalidCitizenIdError) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error instanceof AuthenticationError) {
      res.status(200).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error instanceof AccountDisabledError) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }

    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred during login. Please try again.",
    });
  }
}

/**
 * Get Current User Profile
 *
 * Returns the profile of the currently authenticated user
 *
 * @route GET /api/auth/me
 * @access Protected
 */
export async function getCurrentUser(
  req: Request,
  res: Response<ApiResponse<UserProfile>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
      return;
    }

    const { userId } = req.user;
    const userProfile = await AuthService.getUserProfile(userId);

    res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error: any) {
    console.error("Get current user error:", error);

    if (error.message === "User not found") {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "An error occurred while fetching user profile",
    });
  }
}

export async function updateCurrentUser(
  req: Request<object, object, UpdateProfileSchema>,
  res: Response<ApiResponse<UserProfile>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
      return;
    }

    const requestInfo = extractRequestInfo(req);
    const userProfile = await AuthService.updateUserProfile(
      req.user.userId,
      req.body,
      requestInfo,
    );

    res.status(200).json({
      success: true,
      data: userProfile,
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    console.error("Update current user error:", error);

    if (error.message === "User not found") {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

    if (error.message === "Employee profile not found") {
      res.status(404).json({
        success: false,
        error: "Employee profile not found",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "An error occurred while updating user profile",
    });
  }
}

/**
 * Logout Handler
 *
 * Since JWT is stateless, logout is handled on the client side by removing the token
 * This endpoint can be used for logging purposes
 *
 * @route POST /api/auth/logout
 * @access Protected
 */
export async function logout(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    if (req.user) {
      const requestInfo = extractRequestInfo(req);
      await AuthService.logout(req.user.userId, req.user.role, requestInfo);
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred during logout",
    });
  }
}
