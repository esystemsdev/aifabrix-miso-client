/**
 * Enhanced console logger with correlation ID prefixes
 * Provides structured console logging for errors and events
 */

import { StructuredErrorInfo } from "./error-extractor";

/**
 * Log error with context to console
 * Formats error with correlation ID prefix and structured details
 *
 * @param errorInfo - Structured error information
 * @param prefix - Optional prefix (e.g., '[MisoClient]', '[DataClient]', '[AUTH]')
 *
 * @example
 * ```typescript
 * const errorInfo = extractErrorInfo(error, { endpoint: '/api/users', method: 'POST' });
 * logErrorWithContext(errorInfo, '[MisoClient]');
 * // Output: [MisoClient] [abc123-xyz] ApiError: Request failed | Status: 400 | Endpoint: POST /api/users
 * ```
 */
export function logErrorWithContext(
  errorInfo: StructuredErrorInfo,
  prefix: string = "[MisoClient]",
): void {
  const correlationId = errorInfo.correlationId || "no-correlation-id";
  const parts: string[] = [];

  // Build error description
  parts.push(`${errorInfo.errorName}: ${errorInfo.message}`);

  // Add status code if available
  if (errorInfo.statusCode !== undefined) {
    parts.push(`Status: ${errorInfo.statusCode}`);
  }

  // Add endpoint and method if available
  if (errorInfo.endpoint && errorInfo.method) {
    parts.push(`Endpoint: ${errorInfo.method} ${errorInfo.endpoint}`);
  } else if (errorInfo.endpoint) {
    parts.push(`Endpoint: ${errorInfo.endpoint}`);
  } else if (errorInfo.method) {
    parts.push(`Method: ${errorInfo.method}`);
  }

  // Build final message
  const message = parts.join(" | ");
  const prefixed = `${prefix} [${correlationId}]`;

  // eslint-disable-next-line no-console -- Architecture-approved error logging utility
  console.error(prefixed, message);

  // Log response body if available
  if (errorInfo.responseBody) {
    // eslint-disable-next-line no-console -- Architecture-approved error logging utility
    console.error(
      prefixed,
      `Response Body: ${JSON.stringify(errorInfo.responseBody, null, 2)}`,
    );
  }

  // Log stack trace if available
  if (errorInfo.stackTrace) {
    // eslint-disable-next-line no-console -- Architecture-approved error logging utility
    console.error(prefixed, `Stack Trace: ${errorInfo.stackTrace}`);
  }

  // Log original error if available
  if (errorInfo.originalError) {
    // eslint-disable-next-line no-console -- Architecture-approved error logging utility
    console.error(
      prefixed,
      `Original Error: ${String(errorInfo.originalError)}`,
    );
  }
}

/** Write warning to console. */
export function writeWarn(msg: string): void {
  // eslint-disable-next-line no-console -- Architecture-approved warning logging utility
  console.warn(msg);
}

/** Write error to console. */
export function writeErr(msg: string): void {
  // eslint-disable-next-line no-console -- Architecture-approved error logging utility
  console.error(msg);
}
