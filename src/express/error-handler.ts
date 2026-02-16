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
import { extractRequestContext } from "../utils/request-context";

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

/** Prisma error code to HTTP status mapping */
const PRISMA_ERROR_MAP: Record<string, number> = { P2002: 409, P2025: 404, P2003: 400 };

/** Error message patterns to HTTP status mapping */
const MESSAGE_PATTERN_MAP: Array<{ pattern: RegExp; status: number }> = [
  { pattern: /not found/i, status: 404 },
  { pattern: /already exists|duplicate/i, status: 409 },
  { pattern: /validation|invalid/i, status: 400 },
  { pattern: /unauthorized|authentication/i, status: 401 },
  { pattern: /forbidden|permission/i, status: 403 },
];

/** Map error to appropriate HTTP status code */
function mapErrorToStatusCode(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;

  // Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const status = PRISMA_ERROR_MAP[(error as { code: string }).code];
    if (status) return status;
  }

  // Message pattern matching
  const msg = error instanceof Error ? error.message : String(error || "");
  for (const { pattern, status } of MESSAGE_PATTERN_MAP) {
    if (pattern.test(msg)) return status;
  }

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
 * Generate a simple correlation ID when missing
 * Used as fallback when no correlation ID is found in request
 */
function generateCorrelationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `express-${timestamp}-${random}`;
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

/** Options for logError */
interface LogErrorOptions {
  errorInfo: ReturnType<typeof extractErrorInfo>;
  logMessage: string;
  req: Request;
  correlationId: string;
  statusCode: number;
  operationName: string;
}

/** Log error using custom logger or stderr */
async function logError(error: unknown, opts: LogErrorOptions): Promise<void> {
  const { errorInfo, logMessage, req, correlationId, statusCode, operationName } = opts;
  logErrorWithContext(errorInfo, "[Express]");

  if (customErrorLogger) {
    try {
      await customErrorLogger.logError(logMessage, {
        req, correlationId: errorInfo.correlationId || correlationId, operation: operationName,
        statusCode: errorInfo.statusCode || statusCode, url: req.originalUrl, method: req.method,
        errorMessage: errorInfo.message, errorName: errorInfo.errorName, errorType: errorInfo.errorType, stack: errorInfo.stackTrace,
      });
    } catch (logError) {
      const logErr = logError instanceof Error ? logError : new Error(String(logError));
      // eslint-disable-next-line no-console -- Fallback logging when injected logger fails
      console.error(`Failed to log error: ${logErr.message}`);
      // eslint-disable-next-line no-console -- Preserve original error context for diagnostics
      console.error(`Original error: ${extractErrorMessage(error)}`);
    }
  } else {
    // eslint-disable-next-line no-console -- Default error logging when no custom logger is configured
    console.error(logMessage);
    if (error instanceof Error && error.stack) {
      // eslint-disable-next-line no-console -- Include stack for operational debugging
      console.error(`Stack: ${error.stack}`);
    }
  }
}

/**
 * Generic route error handler - logs error and sends RFC 7807 compliant response.
 * @param error - Error object or unknown error.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param operation - Optional operation name for logging.
 * @returns Promise that resolves when response is sent.
 */
export async function handleRouteError(error: unknown, req: Request, res: Response, operation?: string): Promise<void> {
  const requestContext = extractRequestContext(req);
  const correlationId = (req as Request & { correlationId?: string }).correlationId || requestContext.correlationId || generateCorrelationId();
  const statusCode = mapErrorToStatusCode(error);
  const errorMessage = extractErrorMessage(error);
  const operationName = operation || "unknown operation";

  const errorInfo = extractErrorInfo(error, { endpoint: req.originalUrl || req.path, method: req.method, correlationId });
  await logError(error, {
    errorInfo, logMessage: `${operationName} failed: ${errorMessage}`, req, correlationId, statusCode, operationName,
  });

  const errorResponse = createErrorResponseFromError(error, statusCode, req, correlationId);
  if (error instanceof AppError && error.correlationId) errorResponse.correlationId = error.correlationId;
  sendErrorResponse(res, errorResponse);
}
