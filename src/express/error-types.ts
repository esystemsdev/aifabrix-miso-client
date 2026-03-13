/**
 * Express Error Types
 * Application error classes and interfaces for Express.js applications
 */

export interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  correlationId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: string | number | boolean | null;
}

export interface ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  validationErrors?: ValidationError[];
}

/** HTTP status to error type URI mapping */
const ERROR_TYPE_MAP: Record<number, string> = {
  400: "/Errors/BadRequest", 401: "/Errors/Unauthorized", 403: "/Errors/Forbidden",
  404: "/Errors/NotFound", 405: "/Errors/MethodNotAllowed", 409: "/Errors/Conflict",
  422: "/Errors/UnprocessableEntity", 429: "/Errors/TooManyRequests",
  500: "/Errors/InternalServerError", 503: "/Errors/ServiceUnavailable",
};

/** HTTP status to title mapping */
const ERROR_TITLE_MAP: Record<number, string> = {
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 409: "Conflict", 422: "Unprocessable Entity",
  429: "Too Many Requests", 500: "Internal Server Error", 503: "Service Unavailable",
};

/** Optional AppError constructor options (reduces param count for max-params rule) */
export interface AppErrorOptions {
  validationErrors?: ValidationError[];
  errorType?: string;
  instance?: string;
  correlationId?: string;
}

function normalizeAppErrorOptions(opts?: AppErrorOptions | ValidationError[]): AppErrorOptions {
  if (!opts) return {};
  return Array.isArray(opts) ? { validationErrors: opts } : opts;
}

export class AppError extends Error implements ApiError {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly validationErrors?: ValidationError[];
  public readonly errorType?: string;
  public readonly instance?: string;
  public readonly correlationId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    options?: AppErrorOptions | ValidationError[],
  ) {
    super(message);
    const opts = normalizeAppErrorOptions(options);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.validationErrors = opts.validationErrors || [];
    this.errorType = opts.errorType;
    this.instance = opts.instance;
    this.correlationId = opts.correlationId;
    Error.captureStackTrace(this, this.constructor);
  }

  /** Convert AppError to RFC 7807 ErrorResponse format */
  toErrorResponse(requestUrl?: string): {
    type: string; title: string; status: number; detail: string;
    instance?: string; correlationId?: string; errors?: ValidationError[];
  } {
    return {
      type: this.errorType || ERROR_TYPE_MAP[this.statusCode] || "/Errors/InternalServerError",
      title: ERROR_TITLE_MAP[this.statusCode] || "Internal Server Error",
      status: this.statusCode,
      detail: this.message,
      instance: this.instance || requestUrl,
      correlationId: this.correlationId,
      errors: this.validationErrors && this.validationErrors.length > 0 ? this.validationErrors : undefined,
    };
  }
}

/**
 * Create a success response envelope.
 * @param data - Response data.
 * @param message - Optional success message.
 * @param correlationId - Optional correlation ID.
 * @returns Success response object.
 */
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  correlationId?: string,
): ApiResponse<T> => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  if (correlationId) {
    response.correlationId = correlationId;
  }

  return response;
};

/**
 * Create an error response envelope.
 * @param error - Error message.
 * @param correlationId - Optional correlation ID.
 * @returns Error response object.
 */
export const createErrorResponse = (
  error: string,
  correlationId?: string,
): ApiResponse => {
  const response: ApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  if (correlationId) {
    response.correlationId = correlationId;
  }

  return response;
};
