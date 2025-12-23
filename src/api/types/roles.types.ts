/**
 * Roles API request and response type definitions
 * All types use camelCase naming convention for public API outputs
 */

/**
 * Get roles query parameters
 */
export interface GetRolesQueryParams {
  environment?: string;
  application?: string;
}

/**
 * Get roles response
 */
export interface GetRolesResponse {
  success: boolean;
  data: {
    roles: string[];
  };
  timestamp: string;
}

/**
 * Refresh roles response
 */
export interface RefreshRolesResponse {
  success: boolean;
  data: {
    roles: string[];
  };
  timestamp: string;
}

