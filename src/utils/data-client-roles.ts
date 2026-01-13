/**
 * DataClient role methods - extracted for code organization
 * These methods wrap BrowserRoleService for the DataClient facade
 */

import { BrowserRoleService } from "../services/browser-role.service";
import { MisoClient } from "../index";

/**
 * Get user roles (uses token from localStorage if not provided)
 * @param roleService - Browser role service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param token - Optional user authentication token
 * @returns Array of role strings
 */
export async function getRoles(
  roleService: BrowserRoleService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  token?: string,
): Promise<string[]> {
  if (!misoClient || !roleService) {
    return [];
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return [];
  }
  return roleService.getRoles(userToken);
}

/**
 * Check if user has specific role
 * @param roleService - Browser role service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param role - Role to check
 * @param token - Optional user authentication token
 * @returns True if user has the role
 */
export async function hasRole(
  roleService: BrowserRoleService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  role: string,
  token?: string,
): Promise<boolean> {
  if (!misoClient || !roleService) {
    return false;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return false;
  }
  return roleService.hasRole(userToken, role);
}

/**
 * Check if user has any of the specified roles
 * @param roleService - Browser role service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param roles - Roles to check
 * @param token - Optional user authentication token
 * @returns True if user has any of the roles
 */
export async function hasAnyRole(
  roleService: BrowserRoleService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  roles: string[],
  token?: string,
): Promise<boolean> {
  if (!misoClient || !roleService) {
    return false;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return false;
  }
  return roleService.hasAnyRole(userToken, roles);
}

/**
 * Check if user has all of the specified roles
 * @param roleService - Browser role service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param roles - Roles to check
 * @param token - Optional user authentication token
 * @returns True if user has all of the roles
 */
export async function hasAllRoles(
  roleService: BrowserRoleService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  roles: string[],
  token?: string,
): Promise<boolean> {
  if (!misoClient || !roleService) {
    return false;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return false;
  }
  return roleService.hasAllRoles(userToken, roles);
}

/**
 * Force refresh roles from controller (bypass cache)
 * @param roleService - Browser role service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param token - Optional user authentication token
 * @returns Array of role strings
 */
export async function refreshRoles(
  roleService: BrowserRoleService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  token?: string,
): Promise<string[]> {
  if (!misoClient || !roleService) {
    return [];
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return [];
  }
  return roleService.refreshRoles(userToken);
}

/**
 * Clear cached roles for a user
 * @param roleService - Browser role service instance
 * @param misoClient - MisoClient instance (for availability check)
 * @param getTokenFn - Function to get user token
 * @param token - Optional user authentication token
 */
export async function clearRolesCache(
  roleService: BrowserRoleService | null,
  misoClient: MisoClient | null,
  getTokenFn: () => string | null,
  token?: string,
): Promise<void> {
  if (!misoClient || !roleService) {
    return;
  }
  const userToken = token || getTokenFn();
  if (!userToken) {
    return;
  }
  return roleService.clearRolesCache(userToken);
}
