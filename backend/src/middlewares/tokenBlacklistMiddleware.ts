/**
 * Token Blacklist Middleware
 *
 * Checks if a JWT token is blacklisted before allowing it to be used
 * Runs before Passport JWT verification to reject blacklisted tokens early
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tokenBlacklist } from '@shared/services/tokenBlacklist.js';
import Logger from '@shared/utils/logger.js';
import { AppError } from '@shared/utils/errors.js';
import { getJwtSecret } from '@config/jwt.js';
import { extractAuthToken } from '@shared/utils/authToken.js';

const log = Logger.create("TokenBlacklistMiddleware");

/**
 * Token Blacklist Middleware
 * Checks if token is blacklisted before Passport processes it
 */
export const tokenBlacklistMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    // Extract token from request
    const token = extractAuthToken(req);

    // If no token, let Passport handle it (will return 401)
    if (!token) {
      return next();
    }

    // Check if token is individually blacklisted
    const isBlacklisted = await tokenBlacklist.isTokenBlacklisted(token);
    if (isBlacklisted) {
      log.warn("Attempt to use blacklisted token", {
        requestId: (req as any).requestId,
      });
      return next(
        new AppError("Token has been revoked", 401, "TOKEN_REVOKED"),
      );
    }

    // Extract user ID from token to check user-level blacklist
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
      }) as any;

      const userId = decoded.userId;
      if (userId) {
        const allUserTokensBlacklisted =
          await tokenBlacklist.areAllUserTokensBlacklisted(userId);
        if (allUserTokensBlacklisted) {
          log.warn(
            `Attempt to use token for blacklisted user ${userId}`,
            { requestId: (req as any).requestId },
          );
          return next(
            new AppError(
              "User account has been deactivated. Please contact administrator.",
              401,
              "ACCOUNT_DEACTIVATED",
            ),
          );
        }
      }
    } catch (tokenError) {
      // If token is malformed or expired, let Passport handle it
      // This middleware is only for blacklist checks
      if (
        tokenError instanceof jwt.TokenExpiredError ||
        tokenError instanceof jwt.JsonWebTokenError
      ) {
        return next();
      }
      throw tokenError;
    }

    // Token is valid and not blacklisted
    next();
  } catch (error) {
    // On error, let request continue - Passport will handle auth
    log.error(
      "Error in token blacklist middleware",
      error as Error,
      {
        requestId: (req as any).requestId,
      },
    );
    next();
  }
};
