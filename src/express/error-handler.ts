/**
 * Generic Error Handler Utility
 * Provides standardized error handling for all route handlers
 */

import { Request, Response } from "express";
import { AppError } from "./error-types";
import {
  createErrorResponse,
  sendErrorResponse,
  ErrorResponse,
} from "./error-response";
import { extractErrorInfo } from "../utils/error-extractor";
import { logErrorWithContext } from "../utils/console-logger";

/**
 * Error logger interface for dependency injection
 * Allows applications to provide their own logger implementation
 */
export interface ErrorLogger {
  logError(message: string, options: unknown): Promise<void> | void;
}

// Allow dependency injection for custom logger
let customErrorLogger: ErrorLogger | null = null;

/**
 * Set custom error logger for the application
 * @param logger - Custom logger implementing ErrorLogger interface, or null to use stderr
 */
export function setErrorLogger(logger: ErrorLogger | null): void {
  customErrorLogger = logger;
}

/**
 * Map error to appropriate HTTP status code
 */
function mapErrorToStatusCode(error: unknown): number {
  // AppError uses its statusCode
  if (error instanceof AppError) {
    return error.statusCode;
  }

  // Prisma errors (duck typing - no import needed)
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    // Support Prisma error codes without importing Prisma
    if (code === "P2002") {
      // Unique constraint violation
      return 409;
    }
    if (code === "P2025") {
      // Record not found
      return 404;
    }
    if (code === "P2003") {
      // Foreign key constraint violation
      return 400;
    }
  }

  // Error message patterns
  const errorMessage =
    error instanceof Error ? error.message : String(error || "Unknown error");

  if (errorMessage.toLowerCase().includes("not found")) {
    return 404;
  }
  if (
    errorMessage.toLowerCase().includes("already exists") ||
    errorMessage.toLowerCase().includes("duplicate")
  ) {
    return 409;
  }
  if (
    errorMessage.toLowerCase().includes("validation") ||
    errorMessage.toLowerCase().includes("invalid")
  ) {
    return 400;
  }
  if (
    errorMessage.toLowerCase().includes("unauthorized") ||
    errorMessage.toLowerCase().includes("authentication")
  ) {
    return 401;
  }
  if (
    errorMessage.toLowerCase().includes("forbidden") ||
    errorMessage.toLowerCase().includes("permission")
  ) {
    return 403;
  }

  // Default to 500
  return 500;
}

/**
 * Extract error message from error
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Create error response from error
 */
function createErrorResponseFromError(
  error: unknown,
  statusCode: number,
  request?: Request,
  correlationId?: string,
): ErrorResponse {
  let validationErrors;
  if (error instanceof AppError && error.validationErrors) {
    validationErrors = error.validationErrors;
  }

  return createErrorResponse(
    error,
    statusCode,
    request,
    correlationId,
    validationErrors,
  );
}

/**
 * Generic route error handler
 * Logs error and sends RFC 7807 compliant error response
 */
export async function handleRouteError(
  error: unknown,
  req: Request,
  res: Response,
  operation?: string,
): Promise<void> {
  // Get correlation ID from request property (set by requestLogger) or header
  const correlationId =
    (req as Request & { correlationId?: string }).correlationId ||
    (req.headers["x-correlation-id"] as string) ||
    undefined;
  const statusCode = mapErrorToStatusCode(error);
  const errorMessage = extractErrorMessage(error);

  // Extract structured error info with endpoint and method context
  const errorInfo = extractErrorInfo(error, {
    endpoint: req.originalUrl || req.path,
    method: req.method,
    correlationId,
  });

  // Log error using custom logger or stderr
  const operationName = operation || "unknown operation";
  const logMessage = `${operationName} failed: ${errorMessage}`;

  // Enhance console logging with structured format
  logErrorWithContext(errorInfo, "[Express]");

  if (customErrorLogger) {
    try {
      await customErrorLogger.logError(logMessage, {
        req, // Include request object so logger can use withRequest()
        correlationId: errorInfo.correlationId || correlationId,
        operation: operationName,
        statusCode: errorInfo.statusCode || statusCode,
        url: req.originalUrl,
        method: req.method,
        errorMessage: errorInfo.message,
        errorName: errorInfo.errorName,
        errorType: errorInfo.errorType,
        stack: errorInfo.stackTrace,
      });
    } catch (logError) {
      // If logging itself fails, fall back to stderr
      const logErr =
        logError instanceof Error ? logError : new Error(String(logError));
      process.stderr.write(`[ERROR] Failed to log error: ${logErr.message}\n`);
      process.stderr.write(`[ERROR] Original error: ${errorMessage}\n`);
    }
  } else {
    // Fallback to stderr if no logger configured
    process.stderr.write(`[ERROR] ${logMessage}\n`);
    if (error instanceof Error && error.stack) {
      process.stderr.write(`[ERROR] Stack: ${error.stack}\n`);
    }
  }

  // Create and send error response
  const errorResponse = createErrorResponseFromError(
    error,
    statusCode,
    req,
    correlationId,
  );

  // If error is AppError with correlationId, use it
  if (error instanceof AppError && error.correlationId) {
    errorResponse.correlationId = error.correlationId;
  }

  sendErrorResponse(res, errorResponse);
}
