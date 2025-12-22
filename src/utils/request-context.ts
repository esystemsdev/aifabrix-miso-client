/**
 * Request context extraction utility for Express Request objects
 * Automatically extracts logging context (IP, method, path, user-agent, correlation ID, user from JWT)
 */

import { Request } from "express";
import jwt from "jsonwebtoken";

export interface RequestContext {
  ipAddress?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  correlationId?: string;
  referer?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  requestSize?: number;
}

/**
 * Extract user information from Authorization header JWT token
 * @param req - Express Request object
 * @returns Object with userId and sessionId if available
 */
function extractUserFromAuthHeader(req: Request): {
  userId?: string;
  sessionId?: string;
} {
  const headers = req.headers || {};
  const authHeader = headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return {};
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) {
      return {};
    }

    return {
      userId: (decoded.sub ||
        decoded.userId ||
        decoded.user_id ||
        decoded.id) as string | undefined,
      sessionId: (decoded.sessionId || decoded.sid) as string | undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Extract logging context from Express Request object
 * Automatically extracts: IP, method, path, user-agent, correlation ID, user from JWT
 *
 * @param req - Express Request object
 * @returns RequestContext with extracted fields
 *
 * @example
 * ```typescript
 * const ctx = extractRequestContext(req);
 * // ctx contains: ipAddress, method, path, userAgent, correlationId, userId, etc.
 * ```
 */
export function extractRequestContext(req: Request): RequestContext {
  const headers = req.headers || {};

  // Extract IP (handle proxies)
  const ipAddress =
    req.ip ||
    (headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress;

  // Extract correlation ID from common headers
  const correlationId =
    (headers["x-correlation-id"] as string) ||
    (headers["x-request-id"] as string) ||
    (headers["request-id"] as string);

  // Extract user from JWT if available
  const { userId, sessionId } = extractUserFromAuthHeader(req);

  return {
    ipAddress,
    method: req.method,
    path: req.originalUrl || req.path,
    userAgent: headers["user-agent"] as string,
    correlationId,
    referer: headers["referer"] as string,
    userId,
    sessionId,
    requestId: headers["x-request-id"] as string,
    requestSize: headers["content-length"]
      ? parseInt(headers["content-length"] as string, 10)
      : undefined,
  };
}

