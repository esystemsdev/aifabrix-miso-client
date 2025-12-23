/**
 * Auth API request and response type definitions
 * All types use camelCase naming convention for public API outputs
 */

/**
 * Login request parameters (query params for GET)
 */
export interface LoginRequest {
  redirect: string;
  state?: string;
}

/**
 * Login response with login URL
 */
export interface LoginResponse {
  success: boolean;
  data: {
    loginUrl: string;
    state?: string;
  };
  timestamp: string;
}

/**
 * Device code request parameters
 */
export interface DeviceCodeRequest {
  environment?: string;
  scope?: string;
}

/**
 * Device code response
 */
export interface DeviceCodeResponse {
  success: boolean;
  data: {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    expiresIn: number;
    interval: number;
  };
  timestamp: string;
}

/**
 * Device code token request (body)
 */
export interface DeviceCodeTokenRequest {
  deviceCode: string;
}

/**
 * Device code token response
 */
export interface DeviceCodeTokenResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  };
  timestamp: string;
}

/**
 * Device code refresh request (body)
 */
export interface DeviceCodeRefreshRequest {
  refreshToken: string;
}

/**
 * Validate token request (body)
 */
export interface ValidateTokenRequest {
  token: string;
  environment?: string;
  application?: string;
}

/**
 * Validate token response
 */
export interface ValidateTokenResponse {
  success: boolean;
  data: {
    authenticated: boolean;
    user?: {
      id: string;
      username: string;
      email: string;
    };
    expiresAt?: string;
  };
  timestamp: string;
}

/**
 * Get user response
 */
export interface GetUserResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      username: string;
      email: string;
    };
    authenticated: boolean;
  };
  timestamp: string;
}

/**
 * Logout response
 */
export interface LogoutResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Refresh token request (body)
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponse {
  success: boolean;
  data: DeviceCodeTokenResponse['data'];
  message?: string;
  timestamp: string;
}

/**
 * Client token response (for /api/v1/auth/client-token)
 */
export interface ClientTokenResponse {
  success: boolean;
  data: {
    token: string;
    expiresIn: number;
    expiresAt: string;
  };
  timestamp: string;
}

/**
 * Client token legacy response (for /api/v1/auth/token)
 */
export interface ClientTokenLegacyResponse {
  success: boolean;
  token: string;
  expiresIn: number;
  expiresAt: string;
  timestamp: string;
}

/**
 * Callback request (query params)
 */
export interface CallbackRequest {
  code: string;
  state: string;
  redirect: string;
  environment?: string;
  application?: string;
}

/**
 * Callback response
 */
export interface CallbackResponse {
  success: boolean;
  message: string;
}

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

/**
 * Cache stats response
 */
export interface CacheStatsResponse {
  success: boolean;
  data: {
    hits: number;
    misses: number;
    size: number;
  };
  timestamp: string;
}

/**
 * Cache performance response
 */
export interface CachePerformanceResponse {
  success: boolean;
  data: {
    hitRate: number;
    avgResponseTime: number;
  };
  timestamp: string;
}

/**
 * Cache efficiency response
 */
export interface CacheEfficiencyResponse {
  success: boolean;
  data: {
    efficiency: number;
  };
  timestamp: string;
}

/**
 * Clear cache response
 */
export interface ClearCacheResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Invalidate cache request (body)
 */
export interface InvalidateCacheRequest {
  pattern?: string;
}

/**
 * Invalidate cache response
 */
export interface InvalidateCacheResponse {
  success: boolean;
  message: string;
  invalidated: number;
  timestamp: string;
}

/**
 * Diagnostics response
 */
export interface DiagnosticsResponse {
  success: boolean;
  data: {
    database: Record<string, unknown>;
    controller: Record<string, unknown>;
    environment: Record<string, unknown>;
    keycloak: Record<string, unknown>;
  };
  timestamp: string;
}

