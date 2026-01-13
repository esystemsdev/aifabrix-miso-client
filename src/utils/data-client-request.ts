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
import { isRetryableError, calculateBackoffDelay } from "./data-client-utils";
import { MisoClient } from "../index";
import { HasAnyTokenFn, GetTokenFn } from "./data-client-audit";
import {
  processSuccessfulResponse,
  handleNonRetryableError,
  handleAuthErrorCleanup,
  waitForRetry,
} from "./data-client-response";

/**
 * Token refresh callback function type
 */
export type RefreshUserTokenFn = () => Promise<{ token: string; expiresIn: number } | null>;

/**
 * Extract headers from Headers object or Record
 */
export function extractHeaders(
  headers?: Headers | Record<string, string> | string[][] | Record<string, string | readonly string[]>,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => { result[key] = value; });
    return result;
  }
  if (Array.isArray(headers)) {
    const result: Record<string, string> = {};
    headers.forEach(([key, value]) => { result[key] = String(value); });
    return result;
  }
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
export function mergeSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
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

  if (!options?.skipAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const timeout = options?.timeout || config.timeout || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const signal = options?.signal
    ? mergeSignals(controller.signal, options.signal)
    : controller.signal;

  const { cache: _c, skipAuth: _s, retries: _r, skipAudit: _a, timeout: _t, ...fetchOptions } = options || {};

  try {
    const response = await fetch(url, { method, headers, body: fetchOptions.body, signal, ...fetchOptions });
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
  refreshUserToken: RefreshUserTokenFn,
  interceptors: InterceptorConfig,
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] },
  options?: ApiRequestOptions,
): Promise<T> {
  const maxRetries = options?.retries !== undefined ? options.retries : config.retry?.maxRetries || 3;
  const retryEnabled = config.retry?.enabled !== false;
  const baseDelay = config.retry?.baseDelay || 1000;
  const maxDelay = config.retry?.maxDelay || 10000;
  let authErrorDetected = false;
  let tokenRefreshAttempted = false;

  async function attemptRequest(attempt: number): Promise<T> {
    if (authErrorDetected) {
      throw new AuthenticationError("Authentication error detected - should not retry");
    }

    let responseStatus: number | undefined;
    let response: Response | undefined;

    try {
      response = await makeFetchRequest(method, fullUrl, config, getToken, options);
      responseStatus = response.status;

      // Handle 401/403 errors
      if (responseStatus === 401 || responseStatus === 403) {
        if (responseStatus === 401 && config.onTokenRefresh && refreshUserToken && attempt === 0 && !tokenRefreshAttempted) {
          tokenRefreshAttempted = true;
          try {
            const refreshResult = await refreshUserToken();
            if (refreshResult?.token) {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return attemptRequest(attempt + 1);
            }
          } catch (refreshError) {
            console.warn("Token refresh failed, redirecting to login:", refreshError);
          }
        }

        authErrorDetected = true;
        const authError = responseStatus === 401
          ? new AuthenticationError("Authentication required", response)
          : new ApiError("Forbidden", 403, response);

        handleAuthErrorCleanup(
          authError, responseStatus, method, endpoint, startTime, config,
          misoClient, hasAnyToken, getToken, handleAuthError, metrics, options,
        );
        throw authError;
      }

      const data = await parseResponse<T>(response);
      return await processSuccessfulResponse<T>(
        response, data, method, endpoint, startTime, config, cache, cacheKey, cacheEnabled,
        misoClient, hasAnyToken, getToken, interceptors, metrics, options,
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        authErrorDetected = true;
        throw error;
      }

      if (responseStatus === 401 || responseStatus === 403) {
        authErrorDetected = true;
        throw error;
      }

      const errorObj = error as ApiError;
      if (errorObj.name === "AuthenticationError" || errorObj.statusCode === 401 || errorObj.statusCode === 403) {
        authErrorDetected = true;
        throw error;
      }

      const errorResponseStatus = (errorObj.response as Response | undefined)?.status;
      const statusCode: number | undefined = error instanceof AuthenticationError
        ? 401
        : (errorObj.statusCode ?? errorResponseStatus ?? responseStatus ?? undefined);

      const is500Error = statusCode && statusCode >= 500 && statusCode < 600;
      const effectiveMaxRetries = is500Error ? 0 : maxRetries;
      const isRetryable = retryEnabled && !is500Error && attempt < effectiveMaxRetries && isRetryableError(statusCode, error as Error);

      if (!isRetryable) {
        const isAuthError = error instanceof AuthenticationError ||
          (error as ApiError).name === "AuthenticationError" ||
          statusCode === 401 || statusCode === 403 ||
          responseStatus === 401 || responseStatus === 403;

        if (isAuthError) {
          authErrorDetected = true;
          throw error;
        }

        metrics.totalFailures++;
        await handleNonRetryableError(
          error as Error, method, endpoint, startTime, statusCode, responseStatus,
          config, misoClient, hasAnyToken, getToken, metrics, options,
        );
      }

      if (authErrorDetected) {
        throw error;
      }

      await waitForRetry(attempt, baseDelay, maxDelay, calculateBackoffDelay);
      return attemptRequest(attempt + 1);
    }
  }

  try {
    return await attemptRequest(0);
  } catch (error) {
    const isAuthError = error instanceof AuthenticationError ||
      (error as ApiError).name === "AuthenticationError" ||
      (error as ApiError).statusCode === 401 ||
      (error as ApiError).statusCode === 403;

    metrics.totalFailures++;

    if (interceptors.onError && !isAuthError) {
      throw await interceptors.onError(error as Error);
    }
    throw error;
  }
}
