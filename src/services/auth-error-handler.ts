/**
 * Auth service error handling utilities
 * Centralizes error handling for authentication operations
 */

import { MisoClientError } from "../utils/errors";
import { AxiosError } from "axios";
import { extractErrorInfo } from "../utils/error-extractor";
import { logErrorWithContext } from "../utils/console-logger";

/**
 * Format error details for logging/throwing
 */
export function formatAuthError(
  error: unknown,
  operation: string,
  correlationId: string,
  clientId: string,
): string {
  if (error instanceof MisoClientError) {
    const details = {
      statusCode: error.statusCode,
      message: error.message,
      errorResponse: error.errorResponse,
      errorBody: error.errorBody,
    };
    return `${operation} failed: ${error.message}. Full response: ${JSON.stringify(details)} [correlationId: ${correlationId}, clientId: ${clientId}]`;
  }

  if (isAxiosError(error)) {
    const details = error.response
      ? `status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`
      : `message: ${error.message}`;
    return `${operation} failed: ${error.message}. ${details} [correlationId: ${correlationId}, clientId: ${clientId}]`;
  }

  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return `${operation} failed: ${errorMessage} [correlationId: ${correlationId}, clientId: ${clientId}]`;
}

/**
 * Check if error is an AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    error !== null &&
    typeof error === "object" &&
    "isAxiosError" in error &&
    (error as AxiosError).isAxiosError === true
  );
}

/**
 * Handle auth operation error - throws formatted error
 */
export function handleAuthError(
  error: unknown,
  operation: string,
  correlationId: string,
  clientId: string,
): never {
  throw new Error(formatAuthError(error, operation, correlationId, clientId));
}

/**
 * Handle auth operation error - logs and returns null (for operations that shouldn't throw)
 */
export function handleAuthErrorSilent(
  error: unknown,
  operation: string,
  correlationId: string,
  clientId: string,
): null {
  const errorInfo = extractErrorInfo(error, {
    endpoint: operation,
    method: "AUTH",
    correlationId,
  });
  errorInfo.message = formatAuthError(error, operation, correlationId, clientId);
  logErrorWithContext(errorInfo, "[Auth]");
  return null;
}

/**
 * Check if error is a specific HTTP status (e.g., 400 Bad Request)
 */
export function isHttpStatus(error: unknown, status: number): boolean {
  if (error instanceof MisoClientError) {
    return error.statusCode === status;
  }
  if (isAxiosError(error) && error.response) {
    return error.response.status === status;
  }
  return false;
}
