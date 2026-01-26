/**
 * Custom error class for MisoClient SDK
 * Supports structured error responses and backward compatibility
 */

import { ErrorResponse } from "../types/config.types";
import {
  ErrorResponse as ErrorResponseFromErrors,
  ErrorEnvelope,
} from "../types/errors.types";

/**
 * Custom error class that extends Error
 * Supports structured ErrorResponse and backward compatibility with error_body dict
 */
export class MisoClientError extends Error {
  public readonly errorResponse?: ErrorResponse;
  public readonly errorBody?: Record<string, unknown>;
  public readonly statusCode?: number;

  constructor(
    message: string,
    errorResponse?: ErrorResponse,
    errorBody?: Record<string, unknown>,
    statusCode?: number,
  ) {
    // Generate message prioritizing structured errors when available
    let finalMessage = message;
    if (errorResponse) {
      // Use title if available, otherwise use first error from errors array
      if (errorResponse.title) {
        finalMessage = errorResponse.title;
      } else if (errorResponse.errors && errorResponse.errors.length > 0) {
        finalMessage = errorResponse.errors[0];
      }
    }

    super(finalMessage);
    this.name = "MisoClientError";

    // Set properties
    this.errorResponse = errorResponse;
    this.errorBody = errorBody;
    this.statusCode = statusCode ?? errorResponse?.statusCode;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MisoClientError);
    }
  }
}

/** Transform error envelope format to ErrorResponse */
function transformErrorEnvelope(
  envelope: ErrorEnvelope,
  axiosError: { response?: { status?: number }; config?: { url?: string }; message?: string },
): ErrorResponseFromErrors {
  const errorData = envelope.error;
  return {
    errors: errorData.errors ?? ["Unknown error"],
    type: errorData.type ?? "about:blank",
    title: errorData.title ?? axiosError.message ?? "Unknown error",
    statusCode: errorData.statusCode ?? axiosError.response?.status ?? 500,
    instance: errorData.instance ?? axiosError.config?.url,
    correlationId: errorData.correlationId,
  };
}

/** Transform direct error format to ErrorResponse */
function transformDirectError(
  errorData: Record<string, unknown>,
  axiosError: { response?: { status?: number }; config?: { url?: string }; message?: string },
): ErrorResponseFromErrors {
  const statusCode = typeof errorData.statusCode === "number" ? errorData.statusCode
    : typeof axiosError.response?.status === "number" ? axiosError.response.status : 500;
  return {
    errors: Array.isArray(errorData.errors) ? (errorData.errors as string[]) : ["Unknown error"],
    type: (errorData.type as string | undefined) ?? "about:blank",
    title: (errorData.title as string | undefined) ?? axiosError.message ?? "Unknown error",
    statusCode,
    instance: (errorData.instance as string | undefined) ?? axiosError.config?.url,
    correlationId: errorData.correlationId as string | undefined,
  };
}

/**
 * Transform arbitrary error into standardized camelCase ErrorResponse.
 * @param err - Error object (AxiosError, network error, etc.)
 * @returns Standardized camelCase ErrorResponse
 */
export function transformError(err: unknown): ErrorResponseFromErrors {
  // Handle Axios errors
  if (err && typeof err === "object" && "response" in err) {
    const axiosError = err as { response?: { data?: unknown; status?: number }; config?: { url?: string }; message?: string };
    const data = axiosError.response?.data;

    if (data && typeof data === "object") {
      // Error envelope format
      if ("error" in data) return transformErrorEnvelope(data as ErrorEnvelope, axiosError);
      // Direct error format
      return transformDirectError(data as Record<string, unknown>, axiosError);
    }

    // Response without data
    return { errors: [axiosError.message ?? "Network error"], type: "about:blank", title: "Network error", statusCode: axiosError.response?.status ?? 0 };
  }

  // Non-Axios errors
  if (err instanceof Error) return { errors: [err.message ?? "Unknown error"], type: "about:blank", title: "Error", statusCode: 0 };

  // Last resort
  return { errors: ["Unknown error"], type: "about:blank", title: "Unknown error", statusCode: 0 };
}

/**
 * Exception class for camelCase error responses.
 * Used with camelCase ErrorResponse format.
 */
export class ApiErrorException extends Error {
  statusCode: number;
  correlationId?: string;
  type?: string;
  instance?: string;
  errors: string[];

  constructor(error: ErrorResponseFromErrors) {
    super(error.title || "API Error");
    this.name = "ApiErrorException";
    this.statusCode = error.statusCode;
    this.correlationId = error.correlationId;
    this.type = error.type;
    this.instance = error.instance;
    this.errors = error.errors;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiErrorException);
    }
  }
}

/**
 * Handle API error and throw camelCase ApiErrorException.
 * @param err - Error object (AxiosError, network error, etc.)
 * @throws ApiErrorException with camelCase error format
 */
export function handleApiError(err: unknown): never {
  const error = transformError(err);
  throw new ApiErrorException(error);
}
