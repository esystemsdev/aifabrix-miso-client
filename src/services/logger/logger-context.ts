/**
 * Logger context extraction utilities
 * Provides functions for extracting JWT context, environment metadata, and building LogEntry objects
 */

import { Request } from "express";
import jwt from "jsonwebtoken";
import { LogEntry } from "../../types/config.types";
import { DataMasker } from "../../utils/data-masker";
import { extractRequestContext } from "../../utils/request-context";
import { ApplicationContextService } from "../application-context.service";

/**
 * Extract JWT token information
 * @param token - JWT token string
 * @returns Extracted context with userId, applicationId, sessionId, roles, permissions
 */
export function extractJwtContext(token?: string): {
  userId?: string;
  applicationId?: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
} {
  if (!token) return {};

  try {
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) return {};

    return {
      userId: (decoded.sub || decoded.userId || decoded.user_id) as
        | string
        | undefined,
      applicationId: (decoded.applicationId || decoded.app_id) as
        | string
        | undefined,
      sessionId: (decoded.sessionId || decoded.sid) as string | undefined,
      roles: (decoded.roles ||
        (decoded.realm_access as { roles?: string[] } | undefined)?.roles ||
        []) as string[],
      permissions: (decoded.permissions ||
        (decoded.scope as string | undefined)?.split(" ") ||
        []) as string[],
    };
  } catch (error) {
    // JWT parsing failed, return empty context
    return {};
  }
}

/**
 * Extract metadata from environment (browser or Node.js)
 * @returns Partial LogEntry with environment metadata
 */
export function extractEnvironmentMetadata(): Partial<LogEntry> {
  const metadata: Record<string, unknown> = {};

  // Try to extract browser metadata
  if (typeof globalThis !== "undefined" && "window" in globalThis) {
    const win = globalThis as Record<string, unknown>;
    const navigator = (win.window as Record<string, unknown>)?.navigator as
      | Record<string, unknown>
      | undefined;
    const location = (win.window as Record<string, unknown>)?.location as
      | Record<string, unknown>
      | undefined;

    metadata.userAgent = navigator?.userAgent as string | undefined;
    metadata.hostname = location?.hostname as string | undefined;
  }

  // Try to extract Node.js metadata
  if (typeof process !== "undefined" && process.env) {
    metadata.hostname = process.env["HOSTNAME"] || "unknown";
  }

  return metadata as Partial<LogEntry>;
}

export interface GetLogWithRequestOptions {
  applicationContextService: ApplicationContextService;
  generateCorrelationId: () => string;
  maskSensitiveData: boolean;
  clientId?: string;
}

/**
 * Get LogEntry object with request context extracted
 * Extracts IP, method, path, userAgent, correlationId, userId from Express Request
 * Returns structured LogEntry object ready for external logger tables
 *
 * @param req - Express Request object
 * @param message - Log message
 * @param level - Optional log level (defaults to 'info')
 * @param context - Optional additional context
 * @param options - Options with applicationContextService, generateCorrelationId, maskSensitiveData, clientId
 * @returns Complete LogEntry object with all request context extracted
 */
export function getLogWithRequest(
  req: Request,
  message: string,
  level: LogEntry["level"] = "info",
  context: Record<string, unknown> | undefined,
  options: GetLogWithRequestOptions,
): LogEntry {
  const {
    applicationContextService,
    generateCorrelationId,
    maskSensitiveData,
    clientId,
  } = options;
  const requestContext = extractRequestContext(req);
  const jwtContext = extractJwtContext(
    req.headers.authorization?.replace("Bearer ", ""),
  );
  const metadata = extractEnvironmentMetadata();
  const appContext = applicationContextService.getApplicationContext();

  const correlationId =
    requestContext.correlationId || generateCorrelationId();

  // Mask sensitive data in context if enabled
  const maskedContext =
    maskSensitiveData && context
      ? (DataMasker.maskSensitiveData(context) as Record<string, unknown>)
      : context;

  // Extract applicationId: try user JWT first, then client token
  let applicationId = jwtContext.applicationId || "";
  if (!applicationId && appContext.applicationId) {
    applicationId = appContext.applicationId;
  }

  return {
    timestamp: new Date().toISOString(),
    level,
    environment: appContext.environment || "unknown",
    application: appContext.application || clientId || "",
    applicationId,
    message,
    context: maskedContext,
    correlationId,
    userId: requestContext.userId || jwtContext.userId,
    sessionId: requestContext.sessionId || jwtContext.sessionId,
    requestId: requestContext.requestId,
    ipAddress: requestContext.ipAddress || metadata.ipAddress,
    userAgent: requestContext.userAgent || metadata.userAgent,
    referer: requestContext.referer,
    requestSize: requestContext.requestSize,
    ...metadata,
  };
}

export interface GetWithContextOptions {
  applicationContextService: ApplicationContextService;
  generateCorrelationId: () => string;
  maskSensitiveData: boolean;
  clientId?: string;
}

/**
 * Get LogEntry object with provided context
 * Generates correlation ID automatically and extracts metadata from environment
 *
 * @param context - Context object to include in logs
 * @param message - Log message
 * @param level - Optional log level (defaults to 'info')
 * @param options - Options with applicationContextService, generateCorrelationId, maskSensitiveData, clientId
 * @returns Complete LogEntry object
 *
 * @example
 * ```typescript
 * const logEntry = getWithContext({ operation: 'sync' }, 'Sync started', 'info', { applicationContextService, generateCorrelationId, maskSensitiveData: true, clientId: config.clientId });
 * await myCustomLogger.save(logEntry);
 * ```
 */
export function getWithContext(
  context: Record<string, unknown>,
  message: string,
  level: LogEntry["level"] = "info",
  options: GetWithContextOptions,
): LogEntry {
  const { applicationContextService, generateCorrelationId, maskSensitiveData, clientId } = options;
  const metadata = extractEnvironmentMetadata();
  const correlationId = generateCorrelationId();
  const appContext = applicationContextService.getApplicationContext();

  // Mask sensitive data in context if enabled
  const maskedContext = maskSensitiveData
    ? (DataMasker.maskSensitiveData(context) as Record<string, unknown>)
    : context;

  return {
    timestamp: new Date().toISOString(),
    level,
    environment: appContext.environment || "unknown",
    application: appContext.application || clientId || "",
    applicationId: appContext.applicationId || "",
    message,
    context: maskedContext,
    correlationId,
    ...metadata,
  };
}

