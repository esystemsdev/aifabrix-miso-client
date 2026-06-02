/**
 * Shared controller auth path constants for browser applications.
 */

export const AUTH_CONTROLLER_PATHS = {
  SESSION: "/api/v1/auth/session",
  REFRESH: "/api/v1/auth/refresh",
  LOGIN: "/api/v1/auth/login",
  CALLBACK: "/api/v1/auth/callback",
  LOGOUT: "/api/v1/auth/logout",
  CLIENT_TOKEN: "/api/v1/auth/client-token",
} as const;

export type AuthControllerPath =
  (typeof AUTH_CONTROLLER_PATHS)[keyof typeof AUTH_CONTROLLER_PATHS];

/** @deprecated Use AUTH_CONTROLLER_PATHS.SESSION */
export const AUTH_BROWSER_SESSION_PATHS = {
  SESSION: AUTH_CONTROLLER_PATHS.SESSION,
  REFRESH: AUTH_CONTROLLER_PATHS.REFRESH,
} as const;
