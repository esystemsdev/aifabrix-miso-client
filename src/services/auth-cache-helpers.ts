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
    return (decoded.sub || decoded.userId || decoded.user_id || decoded.id) as
      string | null;
  } catch {
    return null;
  }
}

/**
 * Sanitize cache-key segments to avoid unsafe delimiters and excessive length.
 */
function sanitizeCacheKeySegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return normalized.slice(0, 64) || "unknown";
}

/**
 * Build a stable non-sensitive token fingerprint for cache keys.
 */
function buildTokenFingerprint(token: string): string {
  const fallbackSignature = sanitizeCacheKeySegment(token.slice(-24) || "no-token");
  const tokenSegments = token.split(".");
  const signatureHint =
    tokenSegments.length === 3
      ? sanitizeCacheKeySegment(tokenSegments[2].slice(-24) || "no-signature")
      : fallbackSignature;

  try {
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) {
      return `anonymous:no-exp:${signatureHint}`;
    }

    const rawUserId = (
      decoded.sub ||
      decoded.userId ||
      decoded.user_id ||
      decoded.id ||
      "anonymous"
    ).toString();
    const userId = sanitizeCacheKeySegment(rawUserId);
    const exp =
      typeof decoded.exp === "number" ? decoded.exp.toString() : "no-exp";

    return `${userId}:${exp}:${signatureHint}`;
  } catch {
    return `anonymous:no-exp:${signatureHint}`;
  }
}

/**
 * Generate cache key using a bounded token fingerprint.
 */
export function getTokenCacheKey(token: string): string {
  const fingerprint = buildTokenFingerprint(token);
  return `token_validation:${fingerprint}`;
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

    return Math.max(minValidationTTL, Math.min(tokenTtl, tokenValidationTTL));
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
    void cache.delete(cacheKey).catch((error: unknown) => {
      logErrorWithContext(
        extractErrorInfo(error, {
          endpoint: "clearTokenCache",
          method: "delete",
        }),
        "[AuthCacheHelpers]",
      );
    });
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
      void cache.delete(`user:${userId}`).catch((error: unknown) => {
        logErrorWithContext(
          extractErrorInfo(error, {
            endpoint: "clearUserCache",
            method: "delete",
          }),
          "[AuthCacheHelpers]",
        );
      });
    }
  } catch (error) {
    logErrorWithContext(
      extractErrorInfo(error, { endpoint: "clearUserCache" }),
      "[AuthCacheHelpers]",
    );
  }
}
