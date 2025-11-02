/**
 * Error types for Miso/Dataplane API responses
 * All keys follow camelCase convention
 */

/**
 * Canonical error response for AIFabrix Miso APIs.
 * Follows RFC 7807-style structured error format.
 */
export interface ErrorResponse {
  /** Human-readable list of error messages. */
  errors: string[];

  /** RFC 7807 type URI. */
  type?: string;

  /** Short, human-readable title. */
  title?: string;

  /** HTTP status code. */
  statusCode: number;

  /** URI/path identifying the error instance. */
  instance?: string;

  /** Request correlation key for debugging/audit. */
  requestKey?: string;
}

/**
 * Top-level error envelope.
 */
export interface ErrorEnvelope {
  /** Error response object. */
  error: ErrorResponse;
}
