/**
 * DataClient request execution utilities
 * Handles HTTP request execution, retry logic, fetch handling, and response parsing
 */

import {
  ApiRequestOptions,
  DataClientConfig,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  ApiError,
  InterceptorConfig,
  CacheEntry,
} from "../types/data-client.types";
import {
  isRetryableError,
  calculateBackoffDelay,
  calculateSize,
} from "./data-client-utils";
import { setCacheEntry } from "./data-client-cache";
import { logDataClientAudit, HasAnyTokenFn, GetTokenFn } from "./data-client-audit";
import { MisoClient } from "../index";

/**
 * Extract headers from Headers object or Record
 */
export function extractHeaders(
  headers?: Headers | Record<string, string> | string[][] | Record<string, string | readonly string[]>,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    const result: Record<string, string> = {};
    headers.forEach(([key, value]) => {
      result[key] = String(value);
    });
    return result;
  }
  // Convert Record<string, string | readonly string[]> to Record<string, string>
  const result: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    result[key] = Array.isArray(value) ? value.join(", ") : String(value);
  });
  return result;
}

/**
 * Parse response based on content type
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  if (contentType.includes("text/")) {
    return (await response.text()) as T;
  }
  return (await response.blob()) as unknown as T;
}

/**
 * Merge AbortSignals
 */
export function mergeSignals(
  signal1: AbortSignal,
  signal2: AbortSignal,
): AbortSignal {
  const controller = new AbortController();
  
  const abort = () => {
    controller.abort();
    signal1.removeEventListener("abort", abort);
    signal2.removeEventListener("abort", abort);
  };

  if (signal1.aborted || signal2.aborted) {
    controller.abort();
    return controller.signal;
  }

  signal1.addEventListener("abort", abort);
  signal2.addEventListener("abort", abort);

  return controller.signal;
}

/**
 * Make fetch request with timeout and authentication
 */
export async function makeFetchRequest(
  method: string,
  url: string,
  config: DataClientConfig,
  getToken: GetTokenFn,
  options?: ApiRequestOptions,
): Promise<Response> {
  // Build headers
  const headers = new Headers(config.defaultHeaders);
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => headers.set(key, value));
    } else {
      Object.entries(options.headers).forEach(([key, value]) => {
        headers.set(key, String(value));
      });
    }
  }

  // Add authentication
  if (!options?.skipAuth) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    // Note: MisoClient client-token is handled server-side, not in browser
  }

  // Create abort controller for timeout
  const timeout = options?.timeout || config.timeout || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Merge signals
  const signal = options?.signal
    ? mergeSignals(controller.signal, options.signal)
    : controller.signal;

  // Extract custom properties that shouldn't be passed to fetch
  // These are DataClient-specific options, not native RequestInit properties
  const {
    cache: _customCache,
    skipAuth: _skipAuth,
    retries: _retries,
    skipAudit: _skipAudit,
    timeout: _timeout,
    ...fetchOptions
  } = options || {};

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: fetchOptions.body,
      signal,
      ...fetchOptions,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(`Request timeout after ${timeout}ms`, timeout);
    }
    throw new NetworkError(
      `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Process successful response (cache, interceptors, audit)
 */
async function processSuccessfulResponse<T>(
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
  metrics.totalRequests++;
  metrics.responseTimes.push(duration);

  // Cache successful GET responses
  if (cacheEnabled && response.ok) {
    const ttl = options?.cache?.ttl || config.cache?.defaultTTL || 300;
    setCacheEntry(
      cache,
      cacheKey,
      data,
      ttl,
      config.cache?.maxSize || 100,
    );
  }

  // Apply response interceptor
  if (interceptors.onResponse) {
    return await interceptors.onResponse<T>(response, data);
  }

  // Audit logging
  if (!options?.skipAudit) {
    const requestSize = options?.body ? calculateSize(options.body) : undefined;
    const responseSize = calculateSize(data);
    await logDataClientAudit(
      method,
      endpoint,
      response.status,
      duration,
      misoClient,
      config.audit,
      hasAnyToken,
      getToken,
      requestSize,
      responseSize,
      undefined,
      extractHeaders(options?.headers),
      extractHeaders(response.headers),
      options?.body,
      data,
    );
  }

  // Handle error responses
  if (!response.ok) {
    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      response,
    );
  }

  return data;
}

/**
 * Handle non-retryable error (audit log and throw)
 */
async function handleNonRetryableError(
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
  interceptors: InterceptorConfig,
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] },
  options?: ApiRequestOptions,
): Promise<never> {
  const duration = Date.now() - startTime;
  metrics.totalFailures++;

  // Audit log error
  if (!options?.skipAudit) {
    await logDataClientAudit(
      method,
      endpoint,
      statusCode || responseStatus || 401,
      duration,
      misoClient,
      config.audit,
      hasAnyToken,
      getToken,
      options?.body ? calculateSize(options.body) : undefined,
      undefined,
      error,
      extractHeaders(options?.headers),
      undefined,
      options?.body,
      undefined,
    );
  }

  throw error;
}

/**
 * Handle authentication error and throw immediately - does NOT retry
 */
/**
 * Handle authentication error cleanup (synchronous only - no await)
 */
function handleAuthErrorCleanup(
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
  // Call handleAuthError callback
  handleAuthError();
  
  // Update metrics
  metrics.totalFailures++;
  
  // Handle audit logging (fire and forget - don't await)
  if (!options?.skipAudit) {
    const duration = Date.now() - startTime;
    logDataClientAudit(
      method,
      endpoint,
      responseStatus,
      duration,
      misoClient,
      config.audit,
      hasAnyToken,
      getToken,
      options?.body ? calculateSize(options.body) : undefined,
      undefined,
      error,
      extractHeaders(options?.headers),
      undefined,
      options?.body,
      undefined,
    ).catch(() => {
      // Ignore audit logging errors
    });
  }
}

/**
 * Wait for retry delay
 */
async function waitForRetry(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): Promise<void> {
  const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Execute HTTP request with retry logic
 */
export async function executeHttpRequest<T>(
  method: string,
  fullUrl: string,
  endpoint: string,
  config: DataClientConfig,
  cache: Map<string, CacheEntry>,
  cacheKey: string,
  cacheEnabled: boolean,
  startTime: number,
  misoClient: MisoClient | null,
  hasAnyToken: HasAnyTokenFn,
  getToken: GetTokenFn,
  handleAuthError: () => void,
  interceptors: InterceptorConfig,
  metrics: {
    totalRequests: number;
    totalFailures: number;
    responseTimes: number[];
  },
  options?: ApiRequestOptions,
): Promise<T> {
  const maxRetries =
    options?.retries !== undefined
      ? options.retries
      : config.retry?.maxRetries || 3;
  const retryEnabled = config.retry?.enabled !== false;
  const baseDelay = config.retry?.baseDelay || 1000;
  const maxDelay = config.retry?.maxDelay || 10000;
  
  // Flag to prevent retries when auth error is detected
  let authErrorDetected = false;

  // Internal recursive function to handle retries
  async function attemptRequest(attempt: number): Promise<T> {
    // If auth error was detected, don't make any more requests
    if (authErrorDetected) {
      throw new AuthenticationError("Authentication error detected - should not retry");
    }
    
    let responseStatus: number | undefined;
    let response: Response | undefined;
    
    try {
      response = await makeFetchRequest(method, fullUrl, config, getToken, options);
      responseStatus = response.status;
      
      // CRITICAL: Check for 401/403 errors IMMEDIATELY - do NOT retry
      // Throw immediately without any retry logic
      if (responseStatus === 401 || responseStatus === 403) {
        authErrorDetected = true; // Set flag to prevent any retries
        const authError = responseStatus === 401
          ? new AuthenticationError("Authentication required", response)
          : new ApiError("Forbidden", 403, response);
        
        // Handle cleanup (synchronous only)
        handleAuthErrorCleanup(
          authError,
          responseStatus,
          method,
          endpoint,
          startTime,
          config,
          misoClient,
          hasAnyToken,
          getToken,
          handleAuthError,
          metrics,
          options,
        );
        
        // Throw immediately - this MUST exit the entire function, no retry, no recursion
        throw authError;
      }
      
      // Parse response
      const data = await parseResponse<T>(response);

      // Process successful response (cache, interceptors, audit)
      return await processSuccessfulResponse<T>(
        response,
        data,
        method,
        endpoint,
        startTime,
        config,
        cache,
        cacheKey,
        cacheEnabled,
        misoClient,
        hasAnyToken,
        getToken,
        interceptors,
        metrics,
        options,
      );
    } catch (error) {
      // CRITICAL: Check error type FIRST - we throw AuthenticationError from try block
      // This is the most reliable check - if it's AuthenticationError, throw immediately
      if (error instanceof AuthenticationError) {
        authErrorDetected = true; // Set flag to prevent any retries
        throw error; // This exits the function completely, no retry
      }
      
      // Check responseStatus - it's set before throw in try block
      if (responseStatus === 401 || responseStatus === 403) {
        authErrorDetected = true; // Set flag to prevent any retries
        throw error; // This exits the function completely, no retry
      }
      
      // Check error name and statusCode as fallback
      const errorObj = error as ApiError;
      if (errorObj.name === "AuthenticationError" || 
          errorObj.statusCode === 401 || 
          errorObj.statusCode === 403) {
        authErrorDetected = true; // Set flag to prevent any retries
        throw error; // This exits the function completely, no retry
      }

      // Determine if error is retryable
      const errorResponseStatus = (errorObj.response as Response | undefined)?.status;
      const statusCode: number | undefined = error instanceof AuthenticationError
        ? 401
        : (errorObj.statusCode ?? errorResponseStatus ?? responseStatus ?? undefined);
      
      const isRetryable =
        retryEnabled &&
        attempt < maxRetries &&
        isRetryableError(statusCode, error as Error);

      // If not retryable, handle and throw
      // But skip handleNonRetryableError for auth errors - they're already handled
      if (!isRetryable) {
        // Double-check this is not an auth error before calling handleNonRetryableError
        const isAuthError = error instanceof AuthenticationError || 
                           (error as ApiError).name === "AuthenticationError" ||
                           statusCode === 401 ||
                           statusCode === 403 ||
                           responseStatus === 401 ||
                           responseStatus === 403;
        
        if (isAuthError) {
          // Auth error - throw immediately without calling handleNonRetryableError
          authErrorDetected = true; // Set flag to prevent any retries
          throw error;
        }
        
        metrics.totalFailures++;
        await handleNonRetryableError(
          error as Error,
          method,
          endpoint,
          startTime,
          statusCode,
          responseStatus,
          config,
          misoClient,
          hasAnyToken,
          getToken,
          interceptors,
          metrics,
          options,
        );
      }

      // If auth error was detected, don't retry
      if (authErrorDetected) {
        authErrorDetected = true; // Set flag to prevent any retries
        throw error;
      }
      
      // Wait before retry, then recursively call with attempt+1
      await waitForRetry(attempt, baseDelay, maxDelay);
      return attemptRequest(attempt + 1);
    }
  }

  // Start with attempt 0
  try {
    return await attemptRequest(0);
  } catch (error) {
    // Check if this is an auth error - skip interceptor to prevent second call
    const isAuthError = error instanceof AuthenticationError || 
                       (error as ApiError).name === "AuthenticationError" ||
                       (error as ApiError).statusCode === 401 ||
                       (error as ApiError).statusCode === 403;
    
    // All retries exhausted or non-retryable error
    metrics.totalFailures++;
    
    // Skip interceptor for auth errors - they're already handled
    if (interceptors.onError && !isAuthError) {
      throw await interceptors.onError(error as Error);
    }
    throw error;
  }
}

