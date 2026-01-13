/**
 * DataClient permission methods - extracted for code organization
 * These methods wrap BrowserPermissionService for the DataClient facade
 */

import { BrowserPermissionService } from "../services/browser-permission.service";
import { MisoClient } from "../index";

/**
 * Get user permissions (uses token from localStorage if not provided)
 * @param permissionService - Browser permission service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param token - Optional user authentication token
 * @returns Array of permission strings
 */
export async function getPermissions(
  permissionService: BrowserPermissionService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  token?: string,
): Promise<string[]> {
  if (!misoClient || !permissionService) {
    return [];
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return [];
  }
  return permissionService.getPermissions(userToken);
}

/**
 * Check if user has specific permission
 * @param permissionService - Browser permission service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param permission - Permission to check
 * @param token - Optional user authentication token
 * @returns True if user has the permission
 */
export async function hasPermission(
  permissionService: BrowserPermissionService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  permission: string,
  token?: string,
): Promise<boolean> {
  if (!misoClient || !permissionService) {
    return false;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return false;
  }
  return permissionService.hasPermission(userToken, permission);
}

/**
 * Check if user has any of the specified permissions
 * @param permissionService - Browser permission service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param permissions - Permissions to check
 * @param token - Optional user authentication token
 * @returns True if user has any of the permissions
 */
export async function hasAnyPermission(
  permissionService: BrowserPermissionService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  permissions: string[],
  token?: string,
): Promise<boolean> {
  if (!misoClient || !permissionService) {
    return false;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return false;
  }
  return permissionService.hasAnyPermission(userToken, permissions);
}

/**
 * Check if user has all of the specified permissions
 * @param permissionService - Browser permission service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param permissions - Permissions to check
 * @param token - Optional user authentication token
 * @returns True if user has all of the permissions
 */
export async function hasAllPermissions(
  permissionService: BrowserPermissionService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  permissions: string[],
  token?: string,
): Promise<boolean> {
  if (!misoClient || !permissionService) {
    return false;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return false;
  }
  return permissionService.hasAllPermissions(userToken, permissions);
}

/**
 * Force refresh permissions from controller (bypass cache)
 * @param permissionService - Browser permission service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param token - Optional user authentication token
 * @returns Array of permission strings
 */
export async function refreshPermissions(
  permissionService: BrowserPermissionService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  token?: string,
): Promise<string[]> {
  if (!misoClient || !permissionService) {
    return [];
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return [];
  }
  return permissionService.refreshPermissions(userToken);
}

/**
 * Clear cached permissions for a user
 * @param permissionService - Browser permission service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param token - Optional user authentication token
 */
export async function clearPermissionsCache(
  permissionService: BrowserPermissionService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  token?: string,
): Promise<void> {
  if (!misoClient || !permissionService) {
    return;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return;
  }
  return permissionService.clearPermissionsCache(userToken);
}
