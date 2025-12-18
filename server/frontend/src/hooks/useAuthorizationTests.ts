import { useState } from 'react';
import { toast } from 'sonner';
import { DataClient } from '@aifabrix/miso-client';

/**
 * Hook for authorization testing functions
 * 
 * Provides test functions for roles and permissions operations
 */
export function useAuthorizationTests(dataClient: DataClient | null, isLoading: boolean) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  /**
   * Get user roles
   */
  const testGetRoles = async () => {
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
    } catch (error: any) {
      toast.error('Failed to get roles', { description: error.message });
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get user permissions
   */
  const testGetPermissions = async () => {
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
    } catch (error: any) {
      toast.error('Failed to get permissions', { description: error.message });
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check specific role
   */
  const testHasRole = async (roleToCheck: string) => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    if (!roleToCheck) {
      toast.error('Please enter a role to check');
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
    } catch (error: any) {
      toast.error('Failed to check role', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check specific permission
   */
  const testHasPermission = async (permissionToCheck: string) => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    if (!permissionToCheck) {
      toast.error('Please enter a permission to check');
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
    } catch (error: any) {
      toast.error('Failed to check permission', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has any of the specified roles
   */
  const testHasAnyRole = async (rolesToCheck: string) => {
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
    } catch (error: any) {
      toast.error('Failed to check roles', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has all of the specified roles
   */
  const testHasAllRoles = async (rolesToCheck: string) => {
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
    } catch (error: any) {
      toast.error('Failed to check roles', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has any of the specified permissions
   */
  const testHasAnyPermission = async (permissionsToCheck: string) => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    if (!permissionsToCheck) {
      toast.error('Please enter permissions to check (comma-separated)');
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
    } catch (error: any) {
      toast.error('Failed to check permissions', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has all of the specified permissions
   */
  const testHasAllPermissions = async (permissionsToCheck: string) => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    if (!permissionsToCheck) {
      toast.error('Please enter permissions to check (comma-separated)');
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
    } catch (error: any) {
      toast.error('Failed to check permissions', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh roles cache
   */
  const testRefreshRoles = async () => {
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
    } catch (error: any) {
      toast.error('Failed to refresh roles', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh permissions cache
   */
  const testRefreshPermissions = async () => {
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
    } catch (error: any) {
      toast.error('Failed to refresh permissions', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear roles cache
   */
  const testClearRolesCache = async () => {
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
    } catch (error: any) {
      toast.error('Failed to clear roles cache', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear permissions cache
   */
  const testClearPermissionsCache = async () => {
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
    } catch (error: any) {
      toast.error('Failed to clear permissions cache', { description: error.message });
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

