/**
 * Logger Context Middleware
 * Express middleware to set logger context from request
 * Extracts context from Request object and sets it in AsyncLocalStorage
 *
 * ⚠️ SECURITY NOTE: This is SERVER-SIDE ONLY middleware (runs on Node.js server, not in browser)
 *
 * ISO 27001 Compliance:
 * - Server-trustworthy fields: IP address (from connection), method, path (from server request object)
 * - Server-validated fields: userId, sessionId, applicationId (from validated JWT token)
 * - Client-provided fields: correlationId, userAgent, referer, requestSize (for logging/tracing only, not used for security decisions)
 * - Correlation IDs: If client doesn't provide one, server generates a secure server-side correlation ID
 */

import { Request, Response, NextFunction } from "express";
import { setLoggerContext } from "../services/logger/unified-logger.factory";
import { extractRequestContext } from "../utils/request-context";
import { extractJwtContext } from "../services/logger/logger-context";

/** Generate server-side correlation ID (ISO 27001 compliant) */
function generateServerCorrelationId(): string {
  return `server-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** Build logger context from request and JWT data */
function buildLoggerContext(req: Request): Parameters<typeof setLoggerContext>[0] {
  const requestContext = extractRequestContext(req);
  const token = req.headers.authorization?.replace("Bearer ", "");
  const jwtContext = token ? extractJwtContext(token) : {};
  const correlationId = requestContext.correlationId || generateServerCorrelationId();

  return {
    ipAddress: requestContext.ipAddress, method: requestContext.method, path: requestContext.path,
    userId: requestContext.userId || jwtContext.userId, sessionId: requestContext.sessionId || jwtContext.sessionId,
    applicationId: jwtContext.applicationId, userAgent: requestContext.userAgent,
    referer: requestContext.referer, requestSize: requestContext.requestSize,
    correlationId, requestId: requestContext.requestId, token,
  };
}

/**
 * Express middleware to set logger context from request.
 * Extracts context from Request object and sets it in AsyncLocalStorage.
 * 
 * ⚠️ SECURITY: SERVER-SIDE ONLY middleware. ISO 27001 compliant:
 * - Trustworthy: IP, method, path (from server request)
 * - Validated: userId, sessionId, applicationId (from server-validated JWT)
 * - Client-provided (logging only): correlationId, userAgent, referer, requestSize
 * 
 * @example
 * app.use(loggerContextMiddleware);
 * app.get('/api/users', async (req, res) => {
 *   const logger = getLogger();
 *   await logger.info('Users list accessed'); // Auto-extracts context
 * });
 *
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 */
export function loggerContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  try { setLoggerContext(buildLoggerContext(req)); next(); }
  catch { next(); } // Continue without context if extraction fails
}
