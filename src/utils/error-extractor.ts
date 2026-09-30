/**
 * Error extraction utility for structured error information
 * Extracts error details from all error types for enhanced logging
 */

import { sanitizeErrorDiagnostic } from "./diagnostic-sanitizer";
import { MisoClientError } from "./errors";
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  TimeoutError,
} from "../types/data-client.types";

/**
 * Structured error information extracted from any error type
 */
export interface StructuredErrorInfo {
  errorType: string;
  errorName: string;
  message: string;
  statusCode?: number;
  correlationId?: string;
  endpoint?: string;
  method?: string;
  responseBody?: Record<string, unknown>;
  responseHeaders?: Record<string, string>;
  stackTrace?: string;
  originalError?: Error;
}

/**
 * Options for error extraction
 */
export interface ErrorExtractionOptions {
  endpoint?: string;
  method?: string;
  correlationId?: string;
}

function applyBase(
  info: StructuredErrorInfo,
  errorType: string,
  errorName: string,
  message: string,
  statusCode?: number,
  stack?: string,
): void {
  info.errorType = errorType;
  info.errorName = errorName;
  info.message = message;
  info.statusCode = statusCode;
  info.stackTrace = stack;
}

function extractMisoClientError(
  error: MisoClientError,
  info: StructuredErrorInfo,
): void {
  applyBase(
    info,
    "MisoClientError",
    error.name,
    error.message,
    error.statusCode,
    error.stack,
  );
  info.correlationId =
    info.correlationId ||
    error.errorResponse?.correlationId ||
    (typeof error.errorBody?.correlationId === "string"
      ? error.errorBody.correlationId
      : undefined);
  if (error.errorResponse || error.errorBody) {
    info.responseBody = { ...error.errorBody, ...error.errorResponse };
  }
  Object.assign(info, sanitizeErrorDiagnostic(error, info));
}

function extractApiError(error: ApiError, info: StructuredErrorInfo): void {
  applyBase(
    info,
    error.name,
    error.name,
    error.message,
    error.statusCode,
    error.stack,
  );
  info.originalError = error.originalError;
  if (error.response) {
    try {
      info.responseBody = { status: error.statusCode, message: error.message };
    } catch {
      // Ignore extraction errors
    }
  }
}

function extractUnknownError(error: unknown, info: StructuredErrorInfo): void {
  info.errorType = "Unknown";
  info.errorName = "UnknownError";
  info.message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Unknown error occurred";
}

/**
 * Extract structured error information from any error type
 * Supports: MisoClientError, ApiError, AuthenticationError, NetworkError, TimeoutError, and generic Error
 *
 * @param error - Error object of any type
 * @param options - Optional extraction options (endpoint, method, correlationId)
 * @returns Structured error information
 *
 * @example
 * ```typescript
 * try {
 *   await apiCall();
 * } catch (error) {
 *   const errorInfo = extractErrorInfo(error, {
 *     endpoint: '/api/users',
 *     method: 'POST',
 *     correlationId: 'req-123'
 *   });
 *   logErrorWithContext(errorInfo, '[ApiClass]');
 * }
 * ```
 */
export function extractErrorInfo(
  error: unknown,
  options?: ErrorExtractionOptions,
): StructuredErrorInfo {
  const errorInfo: StructuredErrorInfo = {
    errorType: "Unknown",
    errorName: "Error",
    message: "Unknown error",
    endpoint: options?.endpoint,
    method: options?.method,
    correlationId: options?.correlationId,
  };

  if (error instanceof MisoClientError) {
    extractMisoClientError(error, errorInfo);
  } else if (error instanceof ApiError) {
    extractApiError(error, errorInfo);
  } else if (error instanceof AuthenticationError) {
    applyBase(
      errorInfo,
      "AuthenticationError",
      error.name,
      error.message,
      401,
      error.stack,
    );
  } else if (error instanceof NetworkError) {
    applyBase(
      errorInfo,
      "NetworkError",
      error.name,
      error.message,
      0,
      error.stack,
    );
  } else if (error instanceof TimeoutError) {
    applyBase(
      errorInfo,
      "TimeoutError",
      error.name,
      error.message,
      408,
      error.stack,
    );
  } else if (error instanceof Error) {
    applyBase(
      errorInfo,
      "Error",
      error.name,
      error.message,
      undefined,
      error.stack,
    );
  } else {
    extractUnknownError(error, errorInfo);
  }
  return errorInfo;
}
