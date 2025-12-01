/**
 * Error Response Utilities
 * RFC 7807 Problem Details for HTTP APIs compliance
 */

import { Request, Response } from "express";
import { ValidationError } from "./error-types";

/**
 * RBAC-specific extensions for RFC 7807 error responses
 */
export interface RBACErrorExtensions {
  required?: {
    permissions?: string[];
    roles?: string[];
    requireAll?: boolean;
  };
  missing?: {
    permissions?: string[];
    roles?: string[];
  };
  userPermissions?: string[];
  userRoles?: string[];
}

/**
 * RFC 7807 compliant error response interface
 */
export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  correlationId?: string;
  errors?: ValidationError[];
  // RBAC extensions (RFC 7807 allows extensions)
  required?: RBACErrorExtensions["required"];
  missing?: RBACErrorExtensions["missing"];
  userPermissions?: string[];
  userRoles?: string[];
}

/**
 * Error type URI mapping based on HTTP status codes
 */
const ERROR_TYPE_URI_MAP: Record<number, string> = {
  400: "/Errors/BadRequest",
  401: "/Errors/Unauthorized",
  403: "/Errors/Forbidden",
  404: "/Errors/NotFound",
  405: "/Errors/MethodNotAllowed",
  409: "/Errors/Conflict",
  422: "/Errors/UnprocessableEntity",
  429: "/Errors/TooManyRequests",
  500: "/Errors/InternalServerError",
  503: "/Errors/ServiceUnavailable",
};

/**
 * Get error type URI for a given status code
 */
export function getErrorTypeUri(statusCode: number): string {
  return ERROR_TYPE_URI_MAP[statusCode] || "/Errors/InternalServerError";
}

/**
 * Get error title for a given status code
 */
export function getErrorTitle(statusCode: number): string {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    503: "Service Unavailable",
  };
  return titles[statusCode] || "Internal Server Error";
}

/**
 * Create RFC 7807 compliant error response
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number,
  request?: Request,
  correlationId?: string,
  validationErrors?: ValidationError[],
): ErrorResponse {
  let errorMessage: string;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error === null || error === undefined) {
    errorMessage = "An error occurred";
  } else {
    errorMessage = String(error) || "An error occurred";
  }

  // Build correlation ID - prefer parameter, fallback to request property or header
  // requestLogger middleware sets req.correlationId
  const finalCorrelationId =
    correlationId ||
    (request as Request & { correlationId?: string })?.correlationId ||
    (request?.headers["x-correlation-id"] as string);

  const errorResponse: ErrorResponse = {
    type: getErrorTypeUri(statusCode),
    title: getErrorTitle(statusCode),
    status: statusCode,
    detail: errorMessage,
    instance: request?.originalUrl,
  };

  // Only include correlationId if it exists (avoid undefined in JSON)
  if (finalCorrelationId) {
    errorResponse.correlationId = finalCorrelationId;
  }

  if (validationErrors && validationErrors.length > 0) {
    errorResponse.errors = validationErrors;
  }

  return errorResponse;
}

/**
 * Send RFC 7807 compliant error response
 */
export function sendErrorResponse(
  res: Response,
  errorResponse: ErrorResponse,
): void {
  res.setHeader("Content-Type", "application/problem+json");
  res.status(errorResponse.status).json(errorResponse);
}
