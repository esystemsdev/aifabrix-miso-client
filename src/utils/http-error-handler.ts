/**
 * HTTP error handling utilities for InternalHttpClient
 * Handles error parsing and MisoClientError creation
 */

import { AxiosError } from "axios";
import { ErrorResponse, isErrorResponse, AuthMethod } from "../types/config.types";
import { MisoClientError } from "./errors";

/**
 * Detect auth method from request headers (fallback when controller doesn't return authMethod).
 * This provides client-side detection when the controller doesn't include authMethod in the error response.
 * @param headers - Request headers object
 * @returns The detected auth method or null if no auth headers found
 */
export function detectAuthMethodFromHeaders(headers?: Record<string, unknown>): AuthMethod | null {
  if (!headers) return null;
  if (headers["Authorization"]) return "bearer";
  if (headers["x-client-token"]) return "client-token";
  if (headers["x-client-id"]) return "client-credentials";
  return null;
}

/**
 * Parse error response from AxiosError
 * Attempts to parse structured ErrorResponse, falls back to null if parsing fails
 */
export function parseErrorResponse(
  error: AxiosError,
  requestUrl?: string,
): ErrorResponse | null {
  try {
    if (!error.response?.data) return null;

    const data = error.response.data;

    // If data is already an object, check if it matches ErrorResponse structure
    if (typeof data === "object" && data !== null && isErrorResponse(data)) {
      // Cast to unknown first, then to Record for authMethod extraction
      const dataRecord = data as unknown as Record<string, unknown>;
      return {
        errors: (data as ErrorResponse).errors,
        type: (data as ErrorResponse).type,
        title: (data as ErrorResponse).title,
        statusCode: (data as ErrorResponse).statusCode,
        instance: (data as ErrorResponse).instance || requestUrl,
        authMethod: dataRecord.authMethod as AuthMethod | undefined,
      };
    }

    // If data is a string, try to parse as JSON
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (isErrorResponse(parsed)) {
          // Cast to unknown first, then to Record for authMethod extraction
          const parsedRecord = parsed as unknown as Record<string, unknown>;
          return {
            errors: parsed.errors,
            type: parsed.type,
            title: parsed.title,
            statusCode: parsed.statusCode,
            instance: parsed.instance || requestUrl,
            authMethod: parsedRecord.authMethod as AuthMethod | undefined,
          };
        }
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create MisoClientError from AxiosError
 * Parses structured error response if available, falls back to errorBody
 * For 401 errors, detects auth method from response or request headers
 */
export function createMisoClientError(
  error: AxiosError,
  requestUrl?: string,
): MisoClientError {
  const statusCode = error.response?.status;
  const errorResponse = parseErrorResponse(error, requestUrl);

  // For 401 errors, detect auth method if not in response
  let authMethod: AuthMethod | null = null;
  if (statusCode === 401) {
    authMethod = errorResponse?.authMethod ??
                 detectAuthMethodFromHeaders(error.config?.headers as Record<string, unknown>);
  }

  let errorBody: Record<string, unknown> | undefined;
  if (error.response?.data && typeof error.response.data === "object") {
    errorBody = error.response.data as Record<string, unknown>;
  }

  let message = error.message || "Request failed";
  if (error.response) {
    message = error.response.statusText || `Request failed with status code ${statusCode}`;
  }

  return new MisoClientError(message, errorResponse || undefined, errorBody, statusCode, authMethod);
}

/**
 * Check if error is an AxiosError
 */
export function isAxiosError(error: unknown): error is AxiosError {
  if (error instanceof AxiosError) return true;
  if (typeof error === "object" && error !== null && "isAxiosError" in error) {
    return (error as AxiosError).isAxiosError === true;
  }
  return false;
}
