/**
 * Error types for Miso/Dataplane API responses
 * All keys follow camelCase convention
 */

/**
 * Authentication method that failed (from controller 401 response).
 * Used to identify which authentication mechanism caused a 401 error.
 */
export type AuthErrorMethod = "bearer" | "api-key" | "client-token" | "client-credentials" | null;

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
  correlationId?: string;

  /** Authentication method that was attempted and failed (401 errors only). */
  authMethod?: AuthErrorMethod;
}

/**
 * Top-level error envelope.
 */
export interface ErrorEnvelope {
  /** Error response object. */
  error: ErrorResponse;
}
