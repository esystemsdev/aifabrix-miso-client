/**
 * DataClient response processing utilities
 * Handles success/error response processing, caching, and audit logging
 */

import {
  ApiRequestOptions,
  DataClientConfig,
  ApiError,
  InterceptorConfig,
  CacheEntry,
} from "../types/data-client.types";
import { calculateSize } from "./data-client-utils";
import { setCacheEntry } from "./data-client-cache";
import { logDataClientAudit, HasAnyTokenFn, GetTokenFn } from "./data-client-audit";
import { MisoClient } from "../index";
import { extractErrorInfo } from "./error-extractor";
import { logErrorWithContext } from "./console-logger";
import { extractHeaders } from "./data-client-request";
import { LoggerContextStorage } from "../services/logger/logger-context-storage";

/**
 * Generate correlation ID helper
 */
export function generateCorrelationId(misoClient: MisoClient | null): string {
  if (misoClient?.log && typeof misoClient.log.generateCorrelationId === "function") {
    return misoClient.log.generateCorrelationId();
  }
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Process successful response (cache, interceptors, audit)
 */
export async function processSuccessfulResponse<T>(
  response: Response,
  data: T,
  method: string,
  endpoint: string,
  startTime: number,
  config: DataClientConfig,
  cache: Map<string, CacheEntry>,
  cacheKey: string,
  cacheEnabled: boolean,
  misoClient: MisoClient | null,
  hasAnyToken: HasAnyTokenFn,
  getToken: GetTokenFn,
  interceptors: InterceptorConfig,
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] },
  options?: ApiRequestOptions,
): Promise<T> {
  const duration = Date.now() - startTime;
  recordRequestMetrics(metrics, duration);

  cacheSuccessfulResponse(
    cacheEnabled,
    response,
    data,
    options,
    config,
    cache,
    cacheKey,
  );

  // Apply response interceptor
  if (interceptors.onResponse) {
    return await interceptors.onResponse<T>(response, data);
  }

  await auditSuccessResponse(
    response,
    data,
    method,
    endpoint,
    duration,
    config,
    misoClient,
    hasAnyToken,
    getToken,
    options,
  );

  // Handle error responses
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status, response);
  }

  return data;
}

/**
 * Handle non-retryable error (audit log and throw)
 */
export async function handleNonRetryableError(
  error: Error,
  method: string,
  endpoint: string,
  startTime: number,
  statusCode: number | undefined,
  responseStatus: number | undefined,
  config: DataClientConfig,
  misoClient: MisoClient | null,
  hasAnyToken: HasAnyTokenFn,
  getToken: GetTokenFn,
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] },
  options?: ApiRequestOptions,
): Promise<never> {
  const duration = Date.now() - startTime;
  recordFailure(metrics);

  const errorInfo = buildErrorInfo(error, endpoint, method, misoClient);
  logErrorWithContext(errorInfo, "[DataClient]");

  await auditFailureResponse(
    error,
    statusCode || responseStatus || 401,
    duration,
    method,
    endpoint,
    config,
    misoClient,
    hasAnyToken,
    getToken,
    options,
    errorInfo,
    responseStatus,
  );

  throw error;
}

/**
 * Handle authentication error cleanup (synchronous only - no await)
 */
export function handleAuthErrorCleanup(
  error: Error,
  responseStatus: number,
  method: string,
  endpoint: string,
  startTime: number,
  config: DataClientConfig,
  misoClient: MisoClient | null,
  hasAnyToken: HasAnyTokenFn,
  getToken: GetTokenFn,
  handleAuthError: () => void,
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] },
  options?: ApiRequestOptions,
): void {
  handleAuthError();
  recordFailure(metrics);

  const errorInfo = buildErrorInfo(error, endpoint, method, misoClient);
  logErrorWithContext(errorInfo, "[DataClient] [AUTH]");

  if (!options?.skipAudit) {
    const duration = Date.now() - startTime;
    logDataClientAudit(
      method, endpoint, responseStatus, duration, misoClient, config.audit,
      hasAnyToken, getToken,
      options?.body ? calculateSize(options.body) : undefined, undefined, error,
      extractHeaders(options?.headers), undefined, options?.body, undefined,
    ).catch(() => {
      // Ignore audit logging errors
    });
  }

  logAuthFailureToClient(misoClient, errorInfo);
}

function recordRequestMetrics(
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] },
  duration: number,
): void {
  metrics.totalRequests++;
  metrics.responseTimes.push(duration);
}

function recordFailure(
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] },
): void {
  metrics.totalFailures++;
}

function cacheSuccessfulResponse<T>(
  cacheEnabled: boolean,
  response: Response,
  data: T,
  options: ApiRequestOptions | undefined,
  config: DataClientConfig,
  cache: Map<string, CacheEntry>,
  cacheKey: string,
): void {
  if (!cacheEnabled || !response.ok) {
    return;
  }
  const ttl = options?.cache?.ttl || config.cache?.defaultTTL || 300;
  setCacheEntry(cache, cacheKey, data, ttl, config.cache?.maxSize || 100);
}

async function auditSuccessResponse<T>(
  response: Response,
  data: T,
  method: string,
  endpoint: string,
  duration: number,
  config: DataClientConfig,
  misoClient: MisoClient | null,
  hasAnyToken: HasAnyTokenFn,
  getToken: GetTokenFn,
  options?: ApiRequestOptions,
): Promise<void> {
  if (options?.skipAudit) {
    return;
  }
  const requestSize = options?.body ? calculateSize(options.body) : undefined;
  const responseSize = calculateSize(data);
  await logDataClientAudit(
    method, endpoint, response.status, duration, misoClient, config.audit,
    hasAnyToken, getToken, requestSize, responseSize, undefined,
    extractHeaders(options?.headers), extractHeaders(response.headers),
    options?.body, data,
  );
}

function buildErrorInfo(
  error: Error,
  endpoint: string,
  method: string,
  misoClient: MisoClient | null,
): ReturnType<typeof extractErrorInfo> {
  return extractErrorInfo(error, {
    endpoint,
    method,
    correlationId: generateCorrelationId(misoClient),
  });
}

function getHttpStatusCategory(statusCode?: number): string {
  if (!statusCode) return "unknown";
  if (statusCode >= 500) return "server-error";
  if (statusCode >= 400) return "client-error";
  return "success";
}

async function auditFailureResponse(
  error: Error,
  statusCode: number,
  duration: number,
  method: string,
  endpoint: string,
  config: DataClientConfig,
  misoClient: MisoClient | null,
  hasAnyToken: HasAnyTokenFn,
  getToken: GetTokenFn,
  options: ApiRequestOptions | undefined,
  errorInfo: ReturnType<typeof extractErrorInfo>,
  responseStatus: number | undefined,
): Promise<void> {
  if (options?.skipAudit || !misoClient?.log) {
    return;
  }
  await logDataClientAudit(
    method, endpoint, statusCode || responseStatus || 401, duration,
    misoClient, config.audit, hasAnyToken, getToken,
    options?.body ? calculateSize(options.body) : undefined, undefined, error,
    extractHeaders(options?.headers), undefined, options?.body, undefined,
  );

  const httpStatusCategory = getHttpStatusCategory(statusCode || responseStatus);
  await logFailureToClient(misoClient, errorInfo, httpStatusCategory);
}

async function logFailureToClient(
  misoClient: MisoClient,
  errorInfo: ReturnType<typeof extractErrorInfo>,
  httpStatusCategory: string,
): Promise<void> {
  try {
    const contextStorage = LoggerContextStorage.getInstance();
    await contextStorage.runWithContextAsync(
      { correlationId: errorInfo.correlationId },
      async () => {
        await misoClient.log.error(
          `Request failed: ${errorInfo.message}`,
          {
            errorType: errorInfo.errorType,
            errorName: errorInfo.errorName,
            statusCode: errorInfo.statusCode,
            endpoint: errorInfo.endpoint,
            method: errorInfo.method,
            responseBody: errorInfo.responseBody,
          },
          errorInfo.stackTrace,
          {
            errorCategory: errorInfo.errorType.toLowerCase().replace("error", ""),
            httpStatusCategory,
          },
        );
      },
    );
  } catch {
    // Ignore logging errors
  }
}

function logAuthFailureToClient(
  misoClient: MisoClient | null,
  errorInfo: ReturnType<typeof extractErrorInfo>,
): void {
  if (!misoClient?.log) {
    return;
  }
  const contextStorage = LoggerContextStorage.getInstance();
  contextStorage
    .runWithContextAsync({ correlationId: errorInfo.correlationId }, async () => {
      await misoClient.log.error(
        `Authentication error: ${errorInfo.message}`,
        {
          authFlow: "token_validation_failed",
          errorType: errorInfo.errorType,
          errorName: errorInfo.errorName,
          statusCode: errorInfo.statusCode,
          endpoint: errorInfo.endpoint,
          method: errorInfo.method,
          responseBody: errorInfo.responseBody,
        },
        errorInfo.stackTrace,
        {
          errorCategory: "authentication",
          httpStatusCategory: "client-error",
        },
      );
    })
    .catch(() => {
      // Ignore logging errors
    });
}

/**
 * Wait for retry delay with exponential backoff
 */
export async function waitForRetry(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  calculateBackoffDelay: (attempt: number, baseDelay: number, maxDelay: number) => number,
): Promise<void> {
  const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
