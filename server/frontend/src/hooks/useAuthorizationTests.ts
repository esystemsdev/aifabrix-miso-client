import { useState } from 'react';
import { toast } from 'sonner';
import { DataClient } from '@aifabrix/miso-client';
import { AuthorizationResult } from '../types';
import { getErrorMessage } from '../utils/error-handler';
import { validateRoleName, validatePermissionName, validatePermissionsList } from '../utils/validation';

/**
 * Hook for authorization testing functions
 * 
 * Provides test functions for roles and permissions operations including:
 * - Getting roles and permissions
 * - Checking specific roles and permissions
 * - Testing role/permission combinations (hasAny, hasAll)
 * - Refreshing and clearing caches
 * 
 * @param dataClient - DataClient instance (null if not initialized)
 * @param isLoading - Whether DataClient is currently loading
 * @returns Object containing loading state, results, roles, permissions, and test functions
 * 
 * @example
 * ```tsx
 * const { loading, roles, testGetRoles, testHasRole } = useAuthorizationTests(dataClient, isLoading);
 * 
 * // Get all roles
 * await testGetRoles();
 * 
 * // Check specific role
 * await testHasRole('admin');
 * ```
 */
export function useAuthorizationTests(dataClient: DataClient | null, isLoading: boolean) {
  const [loading, setLoading] = useState(false);
  
  const [result, setResult] = useState<AuthorizationResult | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  /**
   * Get user roles
   * 
   * Retrieves all roles assigned to the current user from the DataClient.
   * Updates the roles state and displays a success toast with the count.
   * 
   * @returns Promise that resolves when roles are retrieved
   * @throws Will display error toast if retrieval fails
   */
  const testGetRoles = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const userRoles = await dataClient.getRoles();
      setRoles(userRoles);
      setResult({
        roles: userRoles,
        count: userRoles.length,
        timestamp: new Date().toISOString(),
      });
      toast.success(`Retrieved ${userRoles.length} roles`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to get roles', { description: errorMessage });
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get user permissions
   * 
   * Retrieves all permissions assigned to the current user from the DataClient.
   * Updates the permissions state and displays a success toast with the count.
   * 
   * @returns Promise that resolves when permissions are retrieved
   * @throws Will display error toast if retrieval fails
   */
  const testGetPermissions = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const userPermissions = await dataClient.getPermissions();
      setPermissions(userPermissions);
      setResult({
        permissions: userPermissions,
        count: userPermissions.length,
        timestamp: new Date().toISOString(),
      });
      toast.success(`Retrieved ${userPermissions.length} permissions`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to get permissions', { description: errorMessage });
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check specific role
   * 
   * Validates the role name and checks if the current user has the specified role.
   * 
   * @param roleToCheck - Role name to check (must be valid per validation rules)
   * @returns Promise that resolves when role check completes
   * @throws Will display error toast if validation fails or check fails
   */
  const testHasRole = async (roleToCheck: string): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    const roleValidation = validateRoleName(roleToCheck);
    if (!roleValidation.valid) {
      toast.error(roleValidation.error || 'Invalid role name');
      return;
    }

    setLoading(true);
    try {
      const hasRole = await dataClient.hasRole(roleToCheck);
      setResult({
        role: roleToCheck,
        hasRole,
        timestamp: new Date().toISOString(),
      });
      toast.success(hasRole ? `User has role: ${roleToCheck}` : `User does not have role: ${roleToCheck}`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to check role', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check specific permission
   * 
   * Validates the permission name and checks if the current user has the specified permission.
   * 
   * @param permissionToCheck - Permission name to check (must be valid per validation rules)
   * @returns Promise that resolves when permission check completes
   * @throws Will display error toast if validation fails or check fails
   */
  const testHasPermission = async (permissionToCheck: string): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    const permissionValidation = validatePermissionName(permissionToCheck);
    if (!permissionValidation.valid) {
      toast.error(permissionValidation.error || 'Invalid permission name');
      return;
    }

    setLoading(true);
    try {
      const hasPermission = await dataClient.hasPermission(permissionToCheck);
      setResult({
        permission: permissionToCheck,
        hasPermission,
        timestamp: new Date().toISOString(),
      });
      toast.success(hasPermission ? `User has permission: ${permissionToCheck}` : `User does not have permission: ${permissionToCheck}`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to check permission', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has any of the specified roles
   * 
   * Checks if the current user has at least one of the specified roles.
   * 
   * @param rolesToCheck - Comma-separated list of role names to check
   * @returns Promise that resolves when role check completes
   * @throws Will display error toast if check fails
   */
  const testHasAnyRole = async (rolesToCheck: string): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    if (!rolesToCheck) {
      toast.error('Please enter roles to check (comma-separated)');
      return;
    }

    setLoading(true);
    try {
      const rolesArray = rolesToCheck.split(',').map(r => r.trim()).filter(Boolean);
      const hasAny = await dataClient.hasAnyRole(rolesArray);
      setResult({
        roles: rolesArray,
        hasAnyRole: hasAny,
        timestamp: new Date().toISOString(),
      });
      toast.success(hasAny ? 'User has at least one of the roles' : 'User does not have any of the roles');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to check roles', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has all of the specified roles
   * 
   * Checks if the current user has all of the specified roles.
   * 
   * @param rolesToCheck - Comma-separated list of role names to check
   * @returns Promise that resolves when role check completes
   * @throws Will display error toast if check fails
   */
  const testHasAllRoles = async (rolesToCheck: string): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    if (!rolesToCheck) {
      toast.error('Please enter roles to check (comma-separated)');
      return;
    }

    setLoading(true);
    try {
      const rolesArray = rolesToCheck.split(',').map(r => r.trim()).filter(Boolean);
      const hasAll = await dataClient.hasAllRoles(rolesArray);
      setResult({
        roles: rolesArray,
        hasAllRoles: hasAll,
        timestamp: new Date().toISOString(),
      });
      toast.success(hasAll ? 'User has all of the roles' : 'User does not have all of the roles');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to check roles', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has any of the specified permissions
   * 
   * Validates permissions and checks if the current user has at least one of the specified permissions.
   * 
   * @param permissionsToCheck - Comma-separated list of permission names to check
   * @returns Promise that resolves when permission check completes
   * @throws Will display error toast if validation fails or check fails
   */
  const testHasAnyPermission = async (permissionsToCheck: string): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    const permissionsValidation = validatePermissionsList(permissionsToCheck);
    if (!permissionsValidation.valid) {
      toast.error(permissionsValidation.error || 'Invalid permissions');
      return;
    }

    setLoading(true);
    try {
      const permissionsArray = permissionsToCheck.split(',').map(p => p.trim()).filter(Boolean);
      const hasAny = await dataClient.hasAnyPermission(permissionsArray);
      setResult({
        permissions: permissionsArray,
        hasAnyPermission: hasAny,
        timestamp: new Date().toISOString(),
      });
      toast.success(hasAny ? 'User has at least one of the permissions' : 'User does not have any of the permissions');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to check permissions', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has all of the specified permissions
   * 
   * Validates permissions and checks if the current user has all of the specified permissions.
   * 
   * @param permissionsToCheck - Comma-separated list of permission names to check
   * @returns Promise that resolves when permission check completes
   * @throws Will display error toast if validation fails or check fails
   */
  const testHasAllPermissions = async (permissionsToCheck: string): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    const permissionsValidation = validatePermissionsList(permissionsToCheck);
    if (!permissionsValidation.valid) {
      toast.error(permissionsValidation.error || 'Invalid permissions');
      return;
    }

    setLoading(true);
    try {
      const permissionsArray = permissionsToCheck.split(',').map(p => p.trim()).filter(Boolean);
      const hasAll = await dataClient.hasAllPermissions(permissionsArray);
      setResult({
        permissions: permissionsArray,
        hasAllPermissions: hasAll,
        timestamp: new Date().toISOString(),
      });
      toast.success(hasAll ? 'User has all of the permissions' : 'User does not have all of the permissions');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to check permissions', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh roles cache
   * 
   * Forces a refresh of the roles cache by bypassing cached data and fetching fresh roles from the server.
   * Updates the roles state with the refreshed data.
   * 
   * @returns Promise that resolves when roles cache is refreshed
   * @throws Will display error toast if refresh fails
   */
  const testRefreshRoles = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const refreshedRoles = await dataClient.refreshRoles();
      setRoles(refreshedRoles);
      setResult({
        message: 'Roles cache refreshed',
        roles: refreshedRoles,
        timestamp: new Date().toISOString(),
      });
      toast.success('Roles cache refreshed');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to refresh roles', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh permissions cache
   * 
   * Forces a refresh of the permissions cache by bypassing cached data and fetching fresh permissions from the server.
   * Updates the permissions state with the refreshed data.
   * 
   * @returns Promise that resolves when permissions cache is refreshed
   * @throws Will display error toast if refresh fails
   */
  const testRefreshPermissions = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const refreshedPermissions = await dataClient.refreshPermissions();
      setPermissions(refreshedPermissions);
      setResult({
        message: 'Permissions cache refreshed',
        permissions: refreshedPermissions,
        timestamp: new Date().toISOString(),
      });
      toast.success('Permissions cache refreshed');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to refresh permissions', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear roles cache
   * 
   * Clears the cached roles data, forcing the next roles request to fetch fresh data from the server.
   * 
   * @returns Promise that resolves when roles cache is cleared
   * @throws Will display error toast if clearing fails
   */
  const testClearRolesCache = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      await dataClient.clearRolesCache();
      setResult({
        message: 'Roles cache cleared',
        timestamp: new Date().toISOString(),
      });
      toast.success('Roles cache cleared');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to clear roles cache', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear permissions cache
   * 
   * Clears the cached permissions data, forcing the next permissions request to fetch fresh data from the server.
   * 
   * @returns Promise that resolves when permissions cache is cleared
   * @throws Will display error toast if clearing fails
   */
  const testClearPermissionsCache = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      await dataClient.clearPermissionsCache();
      setResult({
        message: 'Permissions cache cleared',
        timestamp: new Date().toISOString(),
      });
      toast.success('Permissions cache cleared');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to clear permissions cache', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || isLoading || !dataClient;

  return {
    loading,
    result,
    roles,
    permissions,
    isDisabled,
    testGetRoles,
    testGetPermissions,
    testHasRole,
    testHasPermission,
    testHasAnyRole,
    testHasAllRoles,
    testHasAnyPermission,
    testHasAllPermissions,
    testRefreshRoles,
    testRefreshPermissions,
    testClearRolesCache,
    testClearPermissionsCache,
  };
}

