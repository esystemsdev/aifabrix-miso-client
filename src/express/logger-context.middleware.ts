/**
 * Logger Context Middleware
 * Express middleware to set logger context from request
 * Extracts context from Request object and sets it in AsyncLocalStorage
 *
 * ⚠️ SECURITY NOTE: This is SERVER-SIDE ONLY middleware (runs on Node.js server, not in browser)
 *
 * ISO 27001 Compliance:
 * - Server-trustworthy fields: IP address (from connection), method, path (from server request object)
 * - Server-validated fields: userId, sessionId (from validated JWT token)
 * - Client-provided fields: correlationId, userAgent (for logging/tracing only, not used for security decisions)
 * - Correlation IDs: If client doesn't provide one, server generates a secure server-side correlation ID
 */

import { Request, Response, NextFunction } from "express";
import { setLoggerContext } from "../services/logger/unified-logger.factory";
import { extractRequestContext } from "../utils/request-context";
import { extractJwtContext } from "../services/logger/logger-context";

/**
 * Generate server-side correlation ID
 * Used when client doesn't provide correlation ID in headers
 * ISO 27001 compliant: Server-generated, not client-provided
 */
function generateServerCorrelationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `server-${timestamp}-${random}`;
}

/**
 * Express middleware to set logger context from request
 * Extracts context from Request object and sets it in AsyncLocalStorage
 * Context is automatically available to all code in the same async context
 *
 * ⚠️ SECURITY: This middleware runs SERVER-SIDE ONLY (Node.js Express server)
 * It extracts data from server-side Express Request objects, not from client-side code.
 *
 * ISO 27001 Compliance:
 * - Trustworthy fields (server-side): IP address, HTTP method, request path
 * - Validated fields: userId, sessionId (extracted from server-validated JWT tokens)
 * - Client-provided fields (for logging only): correlationId, userAgent
 *   - Correlation IDs from headers are client-provided but standard for distributed tracing
 *   - If no correlation ID provided, server generates a secure server-side ID
 *   - These fields are used for logging/tracing only, NOT for security decisions
 *
 * Call this early in middleware chain (after auth middleware if you need JWT context)
 *
 * @example
 * ```typescript
 * import { loggerContextMiddleware } from '@aifabrix/miso-client';
 *
 * app.use(loggerContextMiddleware);
 *
 * app.get('/api/users', async (req, res) => {
 *   const logger = getLogger();
 *   await logger.info('Users list accessed'); // Auto-extracts context from request
 * });
 * ```
 */
export function loggerContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    // Extract request context (IP, method, path, userAgent, correlationId, etc.)
    // NOTE: IP address, method, and path come from server-side Express Request object (trustworthy)
    const requestContext = extractRequestContext(req);

    // Extract JWT context if token is available
    // NOTE: JWT tokens are validated by server before extraction (trustworthy)
    const token = req.headers.authorization?.replace("Bearer ", "");
    const jwtContext = token ? extractJwtContext(token) : {};

    // ISO 27001: Generate server-side correlation ID if client doesn't provide one
    // Client-provided correlation IDs are acceptable for distributed tracing but not for security
    // Server-generated IDs ensure traceability without relying on client input
    const correlationId =
      requestContext.correlationId || generateServerCorrelationId();

    // Set context in AsyncLocalStorage
    // This context will be available to all code in the same async context
    setLoggerContext({
      // Server-trustworthy fields (from server-side Express Request)
      ipAddress: requestContext.ipAddress, // From req.ip or req.socket.remoteAddress (server-side)
      method: requestContext.method, // From req.method (server-side)
      path: requestContext.path, // From req.originalUrl or req.path (server-side)

      // Server-validated fields (from validated JWT tokens)
      userId: requestContext.userId || jwtContext.userId, // From validated JWT token
      sessionId: requestContext.sessionId || jwtContext.sessionId, // From validated JWT token
      applicationId: jwtContext.applicationId, // From validated JWT token

      // Client-provided fields (for logging/tracing only, not for security decisions)
      userAgent: requestContext.userAgent, // From User-Agent header (client-provided, standard for logging)
      correlationId: correlationId, // Server-generated if not provided (ISO 27001 compliant)
      requestId: requestContext.requestId, // From x-request-id header (client-provided, for tracing)

      // Store token for later extraction if needed (already validated by server)
      token: token,
    });

    next();
  } catch (error) {
    // If context extraction fails, continue without context
    // Don't break the request flow
    next();
  }
}
