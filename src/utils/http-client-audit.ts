/**
 * HTTP client audit logging utilities
 * Handles audit and debug logging for HTTP requests
 */

import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { MisoClientConfig } from "../types/config.types";
import { LoggerService } from "../services/logger.service";
import { ExtractedMetadata } from "./http-client-metadata";
import { applyMaskingStrategy } from "./http-client-masking";

/**
 * Log HTTP request audit event
 * Masks all sensitive data before logging (ISO 27001 compliance)
 * Optimized with size limits, fast paths, and configurable audit levels
 */
export async function logHttpRequestAudit(
  metadata: ExtractedMetadata | null,
  error: AxiosError | null,
  config: MisoClientConfig,
  logger: LoggerService,
): Promise<void> {
  try {
    if (!metadata) {
      return;
    }

    const auditConfig = config.audit || {};
    const auditLevel = auditConfig.level || "detailed";

    if (auditLevel === "minimal") {
      await handleMinimalAudit(metadata, error, logger);
      return;
    }

    await handleStandardOrDetailedAudit(
      metadata,
      auditLevel,
      auditConfig,
      error,
      config,
      logger,
    );
  } catch {
    // Silently swallow all logging errors - never break HTTP requests
  }
}

/**
 * Handle minimal audit level (metadata only, no masking)
 */
async function handleMinimalAudit(
  metadata: {
    method: string;
    url: string;
    fullUrl: string;
    duration: number;
    statusCode: number;
    userId: string | null;
    authHeader?: string;
  },
  error: AxiosError | null,
  logger: LoggerService,
): Promise<void> {
  await logger.audit(
    `http.request.${metadata.method}`,
    metadata.url,
    {
      method: metadata.method,
      url: metadata.fullUrl,
      statusCode: metadata.statusCode,
      duration: metadata.duration,
      userId: metadata.userId || undefined,
      error: error?.message || undefined,
    },
    {
      token: metadata.userId
        ? undefined
        : metadata.authHeader?.replace("Bearer ", ""),
    },
  );
}

/**
 * Handle standard or detailed audit levels
 */
async function handleStandardOrDetailedAudit(
  metadata: {
    method: string;
    url: string;
    fullUrl: string;
    baseURL: string;
    duration: number;
    statusCode: number;
    userId: string | null;
    authHeader?: string;
    requestHeaders: Record<string, unknown>;
    requestBody: unknown;
    responseBody: unknown;
    responseHeaders: Record<string, unknown>;
    config: InternalAxiosRequestConfig;
  },
  auditLevel: string,
  auditConfig: { maxResponseSize?: number; maxMaskingSize?: number },
  error: AxiosError | null,
  config: MisoClientConfig,
  logger: LoggerService,
): Promise<void> {
  const masked = await applyMaskingStrategy(
    {
      requestHeaders: metadata.requestHeaders,
      requestBody: metadata.requestBody,
      responseBody: metadata.responseBody,
      responseHeaders: metadata.responseHeaders,
    },
    auditLevel as "standard" | "detailed" | "full",
    auditConfig.maxResponseSize ?? 10000,
    auditConfig.maxMaskingSize ?? 50000,
  );

  const sizes =
    auditLevel === "detailed" || auditLevel === "full"
      ? calculateRequestSizes(metadata.requestBody, metadata.responseBody)
      : { requestSize: undefined, responseSize: undefined };

  const auditContext = buildAuditContext(
    {
      method: metadata.method,
      fullUrl: metadata.fullUrl,
      duration: metadata.duration,
      statusCode: metadata.statusCode,
      userId: metadata.userId,
    },
    sizes,
    masked,
    auditLevel,
    error,
  );

  await logger.audit(
    `http.request.${metadata.method}`,
    metadata.url,
    auditContext,
    {
      token: metadata.userId
        ? undefined
        : metadata.authHeader?.replace("Bearer ", ""),
    },
  );

  // Log debug event if debug mode enabled
  if (config.logLevel === "debug") {
    try {
      await logDebugEvent(metadata, masked, sizes, error, logger);
    } catch (debugError) {
      // Silently swallow debug logging errors to not break audit logging
    }
  }
}

/**
 * Calculate request and response sizes
 */
export function calculateRequestSizes(
  requestBody: unknown,
  responseBody: unknown,
): { requestSize: number | undefined; responseSize: number | undefined } {
  let requestSize: number | undefined;
  let responseSize: number | undefined;

  if (requestBody) {
    const requestStr = JSON.stringify(requestBody);
    const calculatedSize = Buffer.byteLength(requestStr);
    requestSize = calculatedSize <= 2 ? undefined : calculatedSize;
  }

  if (responseBody) {
    const responseStr = JSON.stringify(responseBody);
    const calculatedSize = Buffer.byteLength(responseStr);
    responseSize = calculatedSize <= 2 ? undefined : calculatedSize;
  }

  return { requestSize, responseSize };
}

/**
 * Build audit context object
 */
function buildAuditContext(
  metadata: {
    method: string;
    fullUrl: string;
    duration: number;
    statusCode: number;
    userId: string | null;
    [key: string]: unknown;
  },
  sizes: { requestSize: number | undefined; responseSize: number | undefined },
  masked: { requestTruncated: boolean; responseTruncated: boolean },
  auditLevel: string,
  error?: AxiosError | null,
): Record<string, unknown> {
  const auditContext: Record<string, unknown> = {
    method: metadata.method,
    url: metadata.fullUrl,
    statusCode: metadata.statusCode,
    duration: metadata.duration,
    userId: metadata.userId || undefined,
    error: error?.message || undefined,
  };

  if (auditLevel === "detailed" || auditLevel === "full") {
    auditContext.requestSize =
      sizes.requestSize !== undefined && sizes.requestSize > 0
        ? sizes.requestSize
        : undefined;
    auditContext.responseSize =
      sizes.responseSize !== undefined && sizes.responseSize > 0
        ? sizes.responseSize
        : undefined;

    if (masked.requestTruncated) {
      auditContext.requestTruncated = true;
    }
    if (masked.responseTruncated) {
      auditContext.responseTruncated = true;
    }
  }

  return auditContext;
}

/**
 * Log debug event with full details
 */
async function logDebugEvent(
  metadata: {
    method: string;
    url: string;
    fullUrl: string;
    baseURL: string;
    duration: number;
    statusCode: number;
    userId: string | null;
    authHeader?: string;
    requestHeaders: Record<string, unknown>;
    responseHeaders: Record<string, unknown>;
    config: InternalAxiosRequestConfig;
  },
  masked: {
    headers: Record<string, unknown>;
    requestBody: unknown;
    responseBody: unknown;
    responseHeaders: Record<string, unknown>;
  },
  sizes: { requestSize: number | undefined; responseSize: number | undefined },
  error: AxiosError | null | undefined,
  logger: LoggerService,
): Promise<void> {
  const responseBodySnippet = prepareDebugResponseBody(masked.responseBody);
  const debugContext = buildDebugContext(
    metadata,
    masked,
    sizes,
    responseBodySnippet,
    error,
  );

  await logger.debug(`HTTP ${metadata.method} ${metadata.url}`, debugContext, {
    token: metadata.userId
      ? undefined
      : metadata.authHeader?.replace("Bearer ", ""),
  });
}

/**
 * Prepare response body snippet for debug logging (truncate if needed)
 */
function prepareDebugResponseBody(responseBody: unknown): unknown {
  if (!responseBody || typeof responseBody !== "object") {
    return responseBody;
  }

  const responseStr = JSON.stringify(responseBody);
  if (responseStr.length <= 1000) {
    return responseBody;
  }

  try {
    return JSON.parse(responseStr.substring(0, 1000) + "...");
  } catch {
    return { _message: "Response body truncated" };
  }
}

/**
 * Build debug context object
 */
function buildDebugContext(
  metadata: {
    method: string;
    fullUrl: string;
    baseURL: string;
    duration: number;
    statusCode: number;
    userId: string | null;
    config: InternalAxiosRequestConfig;
    requestHeaders: Record<string, unknown>;
    responseHeaders: Record<string, unknown>;
  },
  masked: {
    headers: Record<string, unknown>;
    requestBody: unknown;
    responseHeaders: Record<string, unknown>;
  },
  sizes: { requestSize: number | undefined; responseSize: number | undefined },
  responseBodySnippet: unknown,
  error?: AxiosError | null,
): Record<string, unknown> {
  return {
    method: metadata.method,
    url: metadata.fullUrl,
    baseURL: metadata.baseURL,
    statusCode: metadata.statusCode,
    duration: metadata.duration,
    userId: metadata.userId || undefined,
    timeout: metadata.config.timeout || 30000,
    requestHeaders: masked.headers,
    responseHeaders: masked.responseHeaders,
    requestBody: masked.requestBody,
    responseBody: responseBodySnippet,
    requestSize:
      sizes.requestSize !== undefined && sizes.requestSize > 0
        ? sizes.requestSize
        : undefined,
    responseSize:
      sizes.responseSize !== undefined && sizes.responseSize > 0
        ? sizes.responseSize
        : undefined,
    error: error?.message || undefined,
  };
}
