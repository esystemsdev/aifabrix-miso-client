/**
 * Permissions API request and response type definitions
 * All types use camelCase naming convention for public API outputs
 */

/**
 * Get permissions query parameters
 */
export interface GetPermissionsQueryParams {
  environment?: string;
  application?: string;
}

/**
 * Get permissions response
 */
export interface GetPermissionsResponse {
  success: boolean;
  data: {
    permissions: string[];
  };
  timestamp: string;
}

/**
 * Refresh permissions response
 */
export interface RefreshPermissionsResponse {
  success: boolean;
  data: {
    permissions: string[];
  };
  timestamp: string;
}

