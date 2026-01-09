/**
 * Error-related type definitions
 */

/**
 * Parsed error with human-readable title and detail
 */
export interface ParsedError {
  /** Human-readable error title */
  title: string;
  /** Detailed error message */
  detail: string;
}

/**
 * Error details for display in error dialogs
 */
export interface ErrorDetails {
  /** Error message */
  message: string;
  /** Additional error details */
  details?: unknown;
  /** Stack trace if available */
  stack?: string;
}
