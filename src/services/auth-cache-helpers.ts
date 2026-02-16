import crypto from "crypto";
import jwt from "jsonwebtoken";
import { CacheService } from "./cache.service";
import { extractErrorInfo } from "../utils/error-extractor";
import { logErrorWithContext } from "../utils/console-logger";

/**
 * Extract userId from JWT token without verification.
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) return null;
    return (decoded.sub ||
      decoded.userId ||
      decoded.user_id ||
      decoded.id) as string | null;
  } catch {
    return null;
  }
}

/**
 * Generate cache key using SHA-256 hash of token.
 */
export function getTokenCacheKey(token: string): string {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return `token_validation:${hash}`;
}

/**
 * Calculate smart TTL based on token expiration.
 */
export function getCacheTtlFromToken(
  token: string,
  tokenValidationTTL: number,
  minValidationTTL: number,
): number {
  const BUFFER_SECONDS = 30;
  try {
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded || typeof decoded.exp !== "number") {
      return tokenValidationTTL;
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenTtl = decoded.exp - now - BUFFER_SECONDS;

    return Math.max(
      minValidationTTL,
      Math.min(tokenTtl, tokenValidationTTL),
    );
  } catch {
    return tokenValidationTTL;
  }
}

/**
 * Clear cached token validation result.
 */
export function clearTokenCache(cache: CacheService, token: string): void {
  try {
    const cacheKey = getTokenCacheKey(token);
    void cache.delete(cacheKey);
  } catch (error) {
    logErrorWithContext(
      extractErrorInfo(error, { endpoint: "clearTokenCache" }),
      "[AuthCacheHelpers]",
    );
  }
}

/**
 * Clear cached user info for a token.
 */
export function clearUserCache(cache: CacheService, token: string): void {
  try {
    const userId = extractUserIdFromToken(token);
    if (userId) {
      void cache.delete(`user:${userId}`);
    }
  } catch (error) {
    logErrorWithContext(
      extractErrorInfo(error, { endpoint: "clearUserCache" }),
      "[AuthCacheHelpers]",
    );
  }
}
