/**
 * API-related type definitions
 */

/**
 * Result of an API request
 */
export interface ApiResult {
  /** HTTP method used */
  method?: string;
  /** API endpoint */
  endpoint?: string;
  /** HTTP status code */
  status?: number | string;
  /** Timestamp of the request */
  timestamp: string;
  /** Response data */
  data?: unknown;
  /** Error message if request failed */
  error?: string;
  /** Error type */
  type?: string;
  /** Error message */
  message?: string;
  /** Additional error details */
  details?: unknown;
  /** Whether user is authenticated */
  authenticated?: boolean;
  /** Token value */
  token?: string;
  /** Token information */
  tokenInfo?: unknown;
}

/**
 * Result of an authorization operation
 */
export interface AuthorizationResult {
  /** User roles */
  roles?: string[];
  /** User permissions */
  permissions?: string[];
  /** Count of roles/permissions */
  count?: number;
  /** Timestamp of the operation */
  timestamp: string;
  /** Success message */
  message?: string;
  /** Error message */
  error?: string;
  /** Role being checked */
  role?: string;
  /** Whether user has the role */
  hasRole?: boolean;
  /** Permission being checked */
  permission?: string;
  /** Whether user has the permission */
  hasPermission?: boolean;
  /** Whether user has any of the roles */
  hasAnyRole?: boolean;
  /** Whether user has all of the roles */
  hasAllRoles?: boolean;
  /** Whether user has any of the permissions */
  hasAnyPermission?: boolean;
  /** Whether user has all of the permissions */
  hasAllPermissions?: boolean;
}
