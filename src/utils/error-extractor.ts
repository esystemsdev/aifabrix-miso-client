/**
 * Error extraction utility for structured error information
 * Extracts error details from all error types for enhanced logging
 */

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

  // Handle MisoClientError
  if (error instanceof MisoClientError) {
    errorInfo.errorType = "MisoClientError";
    errorInfo.errorName = error.name;
    errorInfo.message = error.message;
    errorInfo.statusCode = error.statusCode;
    errorInfo.stackTrace = error.stack;

    // Extract correlation ID from error response if available
    // Note: correlationId may be in errorResponse or errorBody
    if (error.errorResponse && 'correlationId' in error.errorResponse) {
      errorInfo.correlationId =
        errorInfo.correlationId || (error.errorResponse as { correlationId?: string }).correlationId;
    }

    // Extract response body if available
    if (error.errorResponse) {
      errorInfo.responseBody = {
        errors: error.errorResponse.errors,
        type: error.errorResponse.type,
        title: error.errorResponse.title,
        statusCode: error.errorResponse.statusCode,
        instance: error.errorResponse.instance,
        correlationId: (error.errorResponse as { correlationId?: string }).correlationId,
      };
    } else if (error.errorBody) {
      errorInfo.responseBody = error.errorBody;
    }
  }
  // Handle ApiError and subclasses
  else if (error instanceof ApiError) {
    errorInfo.errorType = error.name;
    errorInfo.errorName = error.name;
    errorInfo.message = error.message;
    errorInfo.statusCode = error.statusCode;
    errorInfo.stackTrace = error.stack;
    errorInfo.originalError = error.originalError;

    // Extract response body if available
    if (error.response) {
      try {
        // Note: Response body extraction would need to clone response
        // For now, we'll extract what we can from the error
        errorInfo.responseBody = {
          status: error.statusCode,
          message: error.message,
        };
      } catch (e) {
        // Ignore extraction errors
      }
    }
  }
  // Handle AuthenticationError
  else if (error instanceof AuthenticationError) {
    errorInfo.errorType = "AuthenticationError";
    errorInfo.errorName = error.name;
    errorInfo.message = error.message;
    errorInfo.statusCode = 401;
    errorInfo.stackTrace = error.stack;
  }
  // Handle NetworkError
  else if (error instanceof NetworkError) {
    errorInfo.errorType = "NetworkError";
    errorInfo.errorName = error.name;
    errorInfo.message = error.message;
    errorInfo.statusCode = 0;
    errorInfo.stackTrace = error.stack;
  }
  // Handle TimeoutError
  else if (error instanceof TimeoutError) {
    errorInfo.errorType = "TimeoutError";
    errorInfo.errorName = error.name;
    errorInfo.message = error.message;
    errorInfo.statusCode = 408;
    errorInfo.stackTrace = error.stack;
  }
  // Handle generic Error
  else if (error instanceof Error) {
    errorInfo.errorType = "Error";
    errorInfo.errorName = error.name;
    errorInfo.message = error.message;
    errorInfo.stackTrace = error.stack;
  }
  // Handle unknown error types
  else {
    errorInfo.errorType = "Unknown";
    errorInfo.errorName = "UnknownError";
    errorInfo.message =
      typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unknown error occurred";
  }

  return errorInfo;
}
