/**
 * Origin validation utility
 * Validates request origins against allowed origins list
 * Supports wildcard ports (e.g., http://localhost:*)
 */

import { Request } from "express";

/**
 * Result of origin validation
 */
export interface OriginValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Normalize origin by removing trailing slashes and converting to lowercase
 */
function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/$/, "");
}

/**
 * Match origin with wildcard port support
 * Supports patterns like:
 * - http://localhost:* (matches any port)
 * - https://example.com (exact match)
 * - http://localhost:3000 (exact match)
 */
function matchOrigin(requestOrigin: string, allowedOrigin: string): boolean {
  const normalizedRequest = normalizeOrigin(requestOrigin);
  const normalizedAllowed = normalizeOrigin(allowedOrigin);

  // Exact match
  if (normalizedRequest === normalizedAllowed) {
    return true;
  }

  // Check for wildcard port pattern (e.g., http://localhost:*)
  if (allowedOrigin.includes(":*")) {
    try {
      const requestUrl = new URL(normalizedRequest);
      const allowedUrl = new URL(normalizedAllowed.replace(":*", ""));

      // Compare protocol and hostname
      if (
        requestUrl.protocol === allowedUrl.protocol &&
        requestUrl.hostname === allowedUrl.hostname
      ) {
        // Port matches (any port is allowed)
        return true;
      }
    } catch {
      // Invalid URL format, fall through to false
    }
  }

  return false;
}

/**
 * Validate request origin against allowed origins list
 * Checks origin header first, then falls back to referer header
 *
 * @param req - Express Request object
 * @param allowedOrigins - Array of allowed origins (supports wildcard ports like http://localhost:*)
 * @returns Validation result with valid flag and optional error message
 */
export function validateOrigin(
  req: Request,
  allowedOrigins?: string[],
): OriginValidationResult {
  // If no allowed origins configured, validation passes (backward compatibility)
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return { valid: true };
  }

  // Get origin from request headers (prefer origin, fallback to referer)
  let origin = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin;

  // If no origin header, try referer
  if (!origin || typeof origin !== "string") {
    const referer = Array.isArray(req.headers.referer)
      ? req.headers.referer[0]
      : req.headers.referer;

    if (referer && typeof referer === "string") {
      // Extract origin from referer URL
      try {
        const refererUrl = new URL(referer);
        origin = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch {
        // Invalid referer URL, validation fails
        return {
          valid: false,
          error: "Missing origin header",
        };
      }
    } else {
      // No origin or referer
      return {
        valid: false,
        error: "Missing origin header",
      };
    }
  }

  // Normalize origin
  const normalizedOrigin = origin;

  // Check against allowed origins
  for (const allowedOrigin of allowedOrigins) {
    if (matchOrigin(normalizedOrigin, allowedOrigin)) {
      return { valid: true };
    }
  }

  // No match found
  return {
    valid: false,
    error: `Origin '${normalizedOrigin}' is not allowed`,
  };
}
