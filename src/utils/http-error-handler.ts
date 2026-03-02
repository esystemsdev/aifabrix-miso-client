/**
 * HTTP error handling utilities for InternalHttpClient
 * Handles error parsing and MisoClientError creation
 */

import { AxiosError } from "axios";
import { ErrorResponse, isErrorResponse, AuthMethod } from "../types/config.types";
import { MisoClientError } from "./errors";

interface Rfc7807LikeError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  authMethod?: AuthMethod | null;
}

function isRfc7807LikeError(data: unknown): data is Rfc7807LikeError {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.type === "string" &&
    typeof obj.title === "string" &&
    typeof obj.status === "number"
  );
}

function toConfigErrorResponse(
  data: ErrorResponse,
  requestUrl?: string,
): ErrorResponse {
  const dataRecord = data as unknown as Record<string, unknown>;
  return {
    errors: data.errors,
    type: data.type,
    title: data.title,
    statusCode: data.statusCode,
    instance: data.instance || requestUrl,
    authMethod: dataRecord.authMethod as AuthMethod | undefined,
  };
}

function toRfc7807ErrorResponse(
  data: Rfc7807LikeError,
  requestUrl?: string,
): ErrorResponse {
  return {
    errors: data.detail ? [data.detail] : [data.title],
    type: data.type,
    title: data.title,
    statusCode: data.status,
    instance: data.instance || requestUrl,
    authMethod: data.authMethod ?? undefined,
  };
}

function parseErrorLikeData(data: unknown, requestUrl?: string): ErrorResponse | null {
  if (isErrorResponse(data)) return toConfigErrorResponse(data, requestUrl);
  if (isRfc7807LikeError(data)) return toRfc7807ErrorResponse(data, requestUrl);
  return null;
}

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
    if (typeof data === "object" && data !== null) {
      return parseErrorLikeData(data, requestUrl);
    }
    if (typeof data !== "string") return null;

    try {
      const parsed = JSON.parse(data);
      return parseErrorLikeData(parsed, requestUrl);
    } catch {
      return null;
    }
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
