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
  if (typeof timeoutId.unref === "function") {
    timeoutId.unref();
  }

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
interface RetryConfig {
  maxRetries: number;
  retryEnabled: boolean;
  baseDelay: number;
  maxDelay: number;
}

interface RequestRetryState {
  authErrorDetected: boolean;
  tokenRefreshAttempted: boolean;
}

interface AttemptRequestParams {
  attempt: number;
  method: string;
  fullUrl: string;
  endpoint: string;
  config: DataClientConfig;
  cache: Map<string, CacheEntry>;
  cacheKey: string;
  cacheEnabled: boolean;
  startTime: number;
  misoClient: MisoClient | null;
  hasAnyToken: HasAnyTokenFn;
  getToken: GetTokenFn;
  handleAuthError: () => void;
  refreshUserToken: RefreshUserTokenFn;
  interceptors: InterceptorConfig;
  metrics: { totalRequests: number; totalFailures: number; responseTimes: number[] };
  options?: ApiRequestOptions;
  retryConfig: RetryConfig;
  state: RequestRetryState;
}

function resolveRetryConfig(
  config: DataClientConfig,
  options?: ApiRequestOptions,
): RetryConfig {
  return {
    maxRetries:
      options?.retries !== undefined
        ? options.retries
        : config.retry?.maxRetries || 3,
    retryEnabled: config.retry?.enabled !== false,
    baseDelay: config.retry?.baseDelay || 1000,
    maxDelay: config.retry?.maxDelay || 10000,
  };
}

function isAuthStatus(status?: number): boolean {
  return status === 401 || status === 403;
}

function isAuthErrorInstance(error: unknown): boolean {
  const errorObj = error as ApiError;
  return (
    error instanceof AuthenticationError ||
    errorObj.name === "AuthenticationError" ||
    errorObj.statusCode === 401 ||
    errorObj.statusCode === 403
  );
}

function resolveStatusCode(
  error: ApiError,
  responseStatus?: number,
): number | undefined {
  const errorResponseStatus = (error.response as Response | undefined)?.status;
  return error.statusCode ?? errorResponseStatus ?? responseStatus ?? undefined;
}

function shouldRetryError(
  statusCode: number | undefined,
  retryConfig: RetryConfig,
  attempt: number,
  error: Error,
): boolean {
  const is500Error = statusCode !== undefined && statusCode >= 500 && statusCode < 600;
  const effectiveMaxRetries = is500Error ? 0 : retryConfig.maxRetries;
  return (
    retryConfig.retryEnabled &&
    !is500Error &&
    attempt < effectiveMaxRetries &&
    isRetryableError(statusCode, error)
  );
}

async function handleAuthResponse<T>(
  params: AttemptRequestParams & { response: Response; responseStatus: number },
): Promise<T | null> {
  const { responseStatus, config, refreshUserToken, attempt, state } = params;
  if (!isAuthStatus(responseStatus)) {
    return null;
  }

  if (
    responseStatus === 401 &&
    config.onTokenRefresh &&
    refreshUserToken &&
    attempt === 0 &&
    !state.tokenRefreshAttempted
  ) {
    state.tokenRefreshAttempted = true;
    try {
      const refreshResult = await refreshUserToken();
      if (refreshResult?.token) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return attemptRequest<T>({ ...params, attempt: attempt + 1 });
      }
    } catch (refreshError) {
      console.warn("Token refresh failed, redirecting to login:", refreshError);
      state.authErrorDetected = true;
    }
  }

  state.authErrorDetected = true;
  const authError =
    responseStatus === 401
      ? new AuthenticationError("Authentication required", params.response)
      : new ApiError("Forbidden", 403, params.response);

  handleAuthErrorCleanup(
    authError,
    responseStatus,
    params.method,
    params.endpoint,
    params.startTime,
    params.config,
    params.misoClient,
    params.hasAnyToken,
    params.getToken,
    params.handleAuthError,
    params.metrics,
    params.options,
  );
  throw authError;
}

async function handleAttemptError<T>(
  params: AttemptRequestParams & {
    error: unknown;
    responseStatus?: number;
  },
): Promise<T> {
  const { error, responseStatus, state, attempt, retryConfig } = params;

  if (state.tokenRefreshAttempted && isAuthStatus(responseStatus)) {
    state.authErrorDetected = true;
    throw error;
  }

  if (error instanceof AuthenticationError || isAuthStatus(responseStatus) || isAuthErrorInstance(error)) {
    state.authErrorDetected = true;
    throw error;
  }

  const errorObj = error as ApiError;
  const statusCode = resolveStatusCode(errorObj, responseStatus);
  const isRetryable = shouldRetryError(statusCode, retryConfig, attempt, error as Error);

  if (!isRetryable) {
    if (isAuthStatus(statusCode)) {
      state.authErrorDetected = true;
      throw error;
    }

    params.metrics.totalFailures++;
    await handleNonRetryableError(
      error as Error,
      params.method,
      params.endpoint,
      params.startTime,
      statusCode,
      responseStatus,
      params.config,
      params.misoClient,
      params.hasAnyToken,
      params.getToken,
      params.metrics,
      params.options,
    );
  }

  if (state.authErrorDetected) {
    throw error;
  }

  await waitForRetry(attempt, retryConfig.baseDelay, retryConfig.maxDelay, calculateBackoffDelay);
  return attemptRequest<T>({ ...params, attempt: attempt + 1 });
}

async function attemptRequest<T>(params: AttemptRequestParams): Promise<T> {
  if (params.state.authErrorDetected) {
    throw new AuthenticationError("Authentication error detected - should not retry");
  }

  let responseStatus: number | undefined;
  let response: Response | undefined;

  try {
    response = await makeFetchRequest(params.method, params.fullUrl, params.config, params.getToken, params.options);
    responseStatus = response.status;

    const authResult = await handleAuthResponse<T>({
      ...params,
      response,
      responseStatus,
    });
    if (authResult) {
      return authResult;
    }

    const data = await parseResponse<T>(response);
    return await processSuccessfulResponse<T>(
      response,
      data,
      params.method,
      params.endpoint,
      params.startTime,
      params.config,
      params.cache,
      params.cacheKey,
      params.cacheEnabled,
      params.misoClient,
      params.hasAnyToken,
      params.getToken,
      params.interceptors,
      params.metrics,
      params.options,
    );
  } catch (error) {
    return handleAttemptError<T>({
      ...params,
      error,
      responseStatus,
    });
  }
}

async function handleFinalError(
  error: unknown,
  interceptors: InterceptorConfig,
  metrics: { totalFailures: number },
): Promise<never> {
  const isAuthError = isAuthErrorInstance(error);
  metrics.totalFailures++;

  if (interceptors.onError && !isAuthError) {
    throw await interceptors.onError(error as Error);
  }
  throw error;
}

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
  const retryConfig = resolveRetryConfig(config, options);
  const state: RequestRetryState = { authErrorDetected: false, tokenRefreshAttempted: false };

  try {
    return await attemptRequest<T>({
      attempt: 0,
      method,
      fullUrl,
      endpoint,
      config,
      cache,
      cacheKey,
      cacheEnabled,
      startTime,
      misoClient,
      hasAnyToken,
      getToken,
      handleAuthError,
      refreshUserToken,
      interceptors,
      metrics,
      options,
      retryConfig,
      state,
    });
  } catch (error) {
    return handleFinalError(error, interceptors, metrics);
  }
}
