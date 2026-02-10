/**
 * Application status and URLs API types
 * Server-side interfaces for updating and fetching application status
 */

/**
 * Application status values accepted by the API for update and returned in status responses.
 * API expects status to be one of these values.
 */
export type ApplicationStatus =
  | "healthy"
  | "degraded"
  | "deploying"
  | "error"
  | "maintenance";

/** Valid application status values (for validation or iteration). */
export const APPLICATION_STATUS_VALUES: readonly ApplicationStatus[] = [
  "healthy",
  "degraded",
  "deploying",
  "error",
  "maintenance",
];

/**
 * Request body for updating the current application's status and URLs
 * All fields optional; at least one typically sent
 */
export interface UpdateSelfStatusRequest {
  /** Application status: one of "healthy" | "degraded" | "deploying" | "error" | "maintenance" */
  status?: ApplicationStatus;
  /** Public URL of the application */
  url?: string;
  /** Internal URL of the application */
  internalUrl?: string;
  /** Port number (1-65535) */
  port?: number;
}

/**
 * Response from updating the current application's status
 */
export interface UpdateSelfStatusResponse {
  /** Whether the update succeeded */
  success?: boolean;
  /** Updated application data (when returned by controller) */
  application?: ApplicationStatusResponse;
  /** Optional message */
  message?: string;
}

/**
 * Application status and metadata (without configuration)
 * Used for both update response and get status response
 */
export interface ApplicationStatusResponse {
  /** Application ID */
  id?: string;
  /** Application key */
  key?: string;
  /** Display name */
  displayName?: string;
  /** Public URL */
  url?: string;
  /** Internal URL */
  internalUrl?: string;
  /** Port number */
  port?: number;
  /** Application status: one of healthy, degraded, deploying, error, maintenance */
  status?: ApplicationStatus;
  /** Runtime status (same values as status when present) */
  runtimeStatus?: ApplicationStatus;
  /** Environment ID or reference */
  environmentId?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
}
