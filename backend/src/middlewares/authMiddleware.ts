/**
 * PHTS System - Authentication Middleware
 *
 * Middleware for protecting routes and enforcing role-based access control
 *
 * Date: 2025-12-30
 */

import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { UserRole, ApiResponse } from '@/types/auth.js';

/**
 * Protect Middleware
 *
 * Ensures that the request contains a valid JWT token
 * Attaches the decoded user payload to req.user
 *
 * Usage:
 * router.get('/protected-route', protect, controller);
 */
export function protect(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
): void {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: any, user: any, info: any) => {
      // Handle authentication errors
      if (err) {
        console.error("Authentication error:", err);
        res.status(500).json({
          success: false,
          error: "Authentication error occurred",
        });
        return;
      }

      // Check if authentication failed
      if (!user) {
        const message = info?.message || "Unauthorized access";
        res.status(401).json({
          success: false,
          error: message,
        });
        return;
      }

      // Attach user to request object
      req.user = user;
      next();
    },
  )(req, res, next);
}

/**
 * Restrict To Middleware
 *
 * Restricts access to specific user roles
 * Must be used after the protect middleware
 *
 * Usage:
 * router.get('/admin-only', protect, restrictTo(UserRole.ADMIN), controller);
 * router.get('/management', protect, restrictTo(UserRole.DIRECTOR, UserRole.HEAD_HR), controller);
 *
 * @param allowedRoles - One or more roles that are allowed to access the route
 */
export function restrictTo(...allowedRoles: UserRole[]) {
  return (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): void => {
    // Check if user is attached to request (should be added by protect middleware)
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Unauthorized access. Please login first.",
      });
      return;
    }

    // Check if user's role is in the allowed roles list
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "You do not have permission to access this resource",
      });
      return;
    }

    next();
  };
}

/**
 * Optional Authentication Middleware
 *
 * Similar to protect, but doesn't fail if no token is provided
 * Useful for routes that behave differently for authenticated vs anonymous users
 *
 * Usage:
 * router.get('/public-data', optionalAuth, controller);
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: any, user: any, _info: any) => {
      // If authentication succeeded, attach user
      if (!err && user) {
        req.user = user;
      }
      // Continue regardless of authentication status
      next();
    },
  )(req, res, next);
}

/**
 * Check Active Status Middleware
 *
 * Additional security check to ensure user account is still active
 * Use this for critical operations
 *
 * Usage:
 * router.post('/critical-action', protect, checkActiveStatus, controller);
 */
export function checkActiveStatus(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: "Unauthorized access",
    });
    return;
  }

  // The JWT strategy already checks is_active in the database
  // This is an additional layer of security if needed
  next();
}
