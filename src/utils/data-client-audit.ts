/**
 * DataClient audit logging utilities
 * Handles ISO 27001 compliant audit logging for HTTP requests
 */

import { MisoClient } from "../index";
import { AuditConfig } from "../types/data-client.types";
import { LoggerContextStorage } from "../services/logger/logger-context-storage";
import { DataMasker } from "./data-masker";
import { truncatePayload, extractUserIdFromToken } from "./data-client-utils";

/**
 * Check if endpoint should skip audit logging
 */
export function shouldSkipAudit(
  endpoint: string,
  auditConfig: AuditConfig | undefined,
): boolean {
  if (!auditConfig?.enabled) return true;
  const skipEndpoints = auditConfig.skipEndpoints || [];
  return skipEndpoints.some((skip) => endpoint.includes(skip));
}

/**
 * Check if any authentication token is available
 */
export type HasAnyTokenFn = () => boolean;

/**
 * Get user token
 */
export type GetTokenFn = () => string | null;

/**
 * Log audit event (ISO 27001 compliance)
 * Skips audit logging if no authentication token is available (user token OR client token)
 */
export async function logDataClientAudit(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  misoClient: MisoClient | null,
  auditConfig: AuditConfig | undefined,
  hasAnyToken: HasAnyTokenFn,
  getToken: GetTokenFn,
  requestSize?: number,
  responseSize?: number,
  error?: Error,
  requestHeaders?: Record<string, string>,
  responseHeaders?: Record<string, string>,
  requestBody?: unknown,
  responseBody?: unknown,
): Promise<void> {
  if (shouldSkipAudit(url, auditConfig) || !misoClient) return;

  // Skip audit logging if no authentication token is available
  // This prevents 401 errors when attempting to audit log unauthenticated requests
  if (!hasAnyToken()) {
    // Silently skip audit logging for unauthenticated requests
    // This is expected behavior and prevents 401 errors
    return;
  }

  try {
    const token = getToken();
    const userId = token ? extractUserIdFromToken(token) : undefined;
    const auditLevel = auditConfig?.level || "standard";

    // Build audit context based on level
    const auditContext: Record<string, unknown> = {
      method,
      url,
      statusCode,
      duration,
    };

    if (userId) {
      auditContext.userId = userId;
    }

    // Minimal level: only basic info
    if (auditLevel === "minimal") {
      await runWithTokenContext(token, async () => {
        await misoClient.log.audit(
          `http.request.${method.toLowerCase()}`,
          url,
          auditContext,
        );
      });
      return;
    }

    // Standard/Detailed/Full levels: include headers and bodies (masked)
    const maxResponseSize = auditConfig?.maxResponseSize || 10000;
    const maxMaskingSize = auditConfig?.maxMaskingSize || 50000;

    // Truncate and mask request body
    let maskedRequestBody: unknown = undefined;
    if (requestBody !== undefined) {
      const truncated = truncatePayload(requestBody, maxMaskingSize);
      if (!truncated.truncated) {
        maskedRequestBody = DataMasker.maskSensitiveData(truncated.data);
      } else {
        maskedRequestBody = truncated.data;
      }
    }

    // Truncate and mask response body (for standard, detailed, full levels)
    let maskedResponseBody: unknown = undefined;
    if (responseBody !== undefined) {
      const truncated = truncatePayload(responseBody, maxResponseSize);
      if (!truncated.truncated) {
        maskedResponseBody = DataMasker.maskSensitiveData(truncated.data);
      } else {
        maskedResponseBody = truncated.data;
      }
    }

    // Mask headers
    const maskedRequestHeaders = requestHeaders
      ? (DataMasker.maskSensitiveData(requestHeaders) as Record<
          string,
          string
        >)
      : undefined;
    const maskedResponseHeaders = responseHeaders
      ? (DataMasker.maskSensitiveData(responseHeaders) as Record<
          string,
          string
        >)
      : undefined;

    // Add to context based on level (standard, detailed, full all include headers/bodies)
    if (maskedRequestHeaders) auditContext.requestHeaders = maskedRequestHeaders;
    if (maskedResponseHeaders) auditContext.responseHeaders = maskedResponseHeaders;
    if (maskedRequestBody !== undefined) auditContext.requestBody = maskedRequestBody;
    if (maskedResponseBody !== undefined) auditContext.responseBody = maskedResponseBody;

    // Add sizes for detailed/full levels
    if (auditLevel === "detailed" || auditLevel === "full") {
      if (requestSize !== undefined) auditContext.requestSize = requestSize;
      if (responseSize !== undefined) auditContext.responseSize = responseSize;
    }

    if (error) {
      const maskedError = DataMasker.maskSensitiveData({
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      auditContext.error = maskedError;
    }

    await runWithTokenContext(token, async () => {
      await misoClient.log.audit(
        `http.request.${method.toLowerCase()}`,
        url,
        auditContext,
      );
    });
  } catch (auditError) {
    // Handle audit logging errors gracefully
    // Don't fail main request if audit logging fails
    const error = auditError as Error & { 
      statusCode?: number; 
      response?: { status?: number };
      code?: string;
      message?: string;
    };
    const statusCode = error.statusCode || error.response?.status;
    const errorMessage = error.message || String(auditError);
    const errorCode = error.code;
    
    // Silently skip for expected error conditions:
    // - 401: User not authenticated (expected for unauthenticated requests)
    // - Network errors: Connection refused, ECONNREFUSED, ERR_CONNECTION_REFUSED
    // - These are expected when server is unavailable or misconfigured
    const isNetworkError = 
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ENOTFOUND' ||
      errorMessage.includes('ERR_CONNECTION_REFUSED') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('network error');
    
    if (statusCode === 401 || isNetworkError) {
      // Silently skip to avoid noise - these are expected conditions
      // 401: User not authenticated (we already check hasAnyToken() before attempting)
      // Network errors: Server unavailable or misconfigured (expected in demo/dev environments)
      return;
    }
    
    // Other unexpected errors - log warning but don't fail request
    console.warn("Failed to log audit event:", auditError);
  }
}

async function runWithTokenContext(
  token: string | null,
  handler: () => Promise<void>,
): Promise<void> {
  if (!token) {
    await handler();
    return;
  }
  const contextStorage = LoggerContextStorage.getInstance();
  await contextStorage.runWithContextAsync({ token }, handler);
}

