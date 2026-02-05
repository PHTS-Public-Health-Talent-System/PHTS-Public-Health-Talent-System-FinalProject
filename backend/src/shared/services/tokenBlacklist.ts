/**
 * Token Blacklist Service
 *
 * Manages blacklisted JWT tokens to prevent their use after:
 * - User logout (explicit revocation)
 * - User deactivation (automatic revocation of all tokens)
 * - Account lockdown (security incident response)
 *
 * Tokens are stored in Redis with TTL matching their original expiration time
 */

import redis from "@config/redis.js";
import Logger from '@shared/utils/logger.js';

const TOKEN_BLACKLIST_PREFIX = "blacklist:token:";
const USER_TOKENS_PREFIX = "user:tokens:";

interface TokenBlacklistEntry {
  citizenId: string;
  revokedAt: string;
  reason: string;
}

class TokenBlacklistService {
  private log = Logger.create("TokenBlacklist");

  /**
   * Add token to blacklist
   * @param token - JWT token to blacklist
   * @param expiresIn - Token expiry time in seconds
   * @param reason - Reason for blacklisting (logout, deactivation, etc.)
   */
  async blacklistToken(
    token: string,
    expiresIn: number,
    reason: string = "logout",
  ): Promise<void> {
    try {
      const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
      const entry: TokenBlacklistEntry = {
        citizenId: "", // Will be populated if we extract from token
        revokedAt: new Date().toISOString(),
        reason,
      };

      // Store in Redis with TTL matching token expiration
      // This ensures automatic cleanup when token would have expired anyway
      await redis.set(key, JSON.stringify(entry), "EX", expiresIn);

      this.log.debug(`Token blacklisted: ${reason}`, {
        ttl: expiresIn,
        reason,
      });
    } catch (error) {
      this.log.error("Failed to blacklist token", error as Error, {
        reason,
      });
      // Don't throw - this shouldn't block user logout
    }
  }

  /**
   * Check if token is blacklisted
   * @param token - JWT token to check
   * @returns true if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
      const entry = await redis.get(key);
      return entry !== null;
    } catch (error) {
      this.log.error("Failed to check token blacklist", error as Error);
      // On Redis error, allow token (fail open) to prevent service disruption
      return false;
    }
  }

  /**
   * Blacklist all tokens for a user (used when account is deactivated)
   * @param userId - User ID
   * @param reason - Reason for blacklisting all tokens
   */
  async blacklistAllUserTokens(userId: number, reason: string): Promise<void> {
    try {
      const userTokensKey = `${USER_TOKENS_PREFIX}${userId}`;

      // Mark all user tokens as revoked
      // Set a marker that invalidates all tokens for this user
      // TTL is 24 hours to handle old token expiries
      await redis.set(userTokensKey, JSON.stringify({ reason }), "EX", 86400);

      this.log.info(
        `All tokens blacklisted for user ${userId}: ${reason}`,
      );
    } catch (error) {
      this.log.error(
        "Failed to blacklist all user tokens",
        error as Error,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Check if all user's tokens are blacklisted
   * @param userId - User ID
   * @returns true if user's tokens are globally blacklisted
   */
  async areAllUserTokensBlacklisted(userId: number): Promise<boolean> {
    try {
      const userTokensKey = `${USER_TOKENS_PREFIX}${userId}`;
      const marker = await redis.get(userTokensKey);
      return marker !== null;
    } catch (error) {
      this.log.error(
        "Failed to check user token blacklist",
        error as Error,
        { userId },
      );
      // On Redis error, allow token (fail open)
      return false;
    }
  }

  /**
   * Remove user token blacklist marker (when user is reactivated)
   * @param userId - User ID
   */
  async removeUserTokenBlacklist(userId: number): Promise<void> {
    try {
      const userTokensKey = `${USER_TOKENS_PREFIX}${userId}`;
      await redis.del(userTokensKey);
      this.log.debug(`Token blacklist removed for user ${userId}`);
    } catch (error) {
      this.log.error(
        "Failed to remove user token blacklist",
        error as Error,
        { userId },
      );
      throw error;
    }
  }

  /**
   * Clear all blacklisted tokens (admin operation, rarely needed)
   * Use with caution - only for testing or emergency situations
   */
  async clearAllBlacklist(): Promise<void> {
    try {
      // Delete all keys with blacklist prefix
      const keys = await redis.keys(`${TOKEN_BLACKLIST_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      const userKeys = await redis.keys(`${USER_TOKENS_PREFIX}*`);
      if (userKeys.length > 0) {
        await redis.del(...userKeys);
      }

      this.log.warn(`Cleared all token blacklist entries`);
    } catch (error) {
      this.log.error(
        "Failed to clear token blacklist",
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get blacklist statistics (for monitoring)
   */
  async getBlacklistStats(): Promise<{
    blacklistedTokens: number;
    blacklistedUsers: number;
  }> {
    try {
      const tokenKeys = await redis.keys(`${TOKEN_BLACKLIST_PREFIX}*`);
      const userKeys = await redis.keys(`${USER_TOKENS_PREFIX}*`);

      return {
        blacklistedTokens: tokenKeys.length,
        blacklistedUsers: userKeys.length,
      };
    } catch (error) {
      this.log.error("Failed to get blacklist stats", error as Error);
      return { blacklistedTokens: 0, blacklistedUsers: 0 };
    }
  }
}

// Export singleton instance
export const tokenBlacklist = new TokenBlacklistService();

// Export class for testing
export default TokenBlacklistService;
