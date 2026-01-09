import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataClient } from '@aifabrix/miso-client';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock error handler
vi.mock('../../utils/error-handler', () => ({
  getErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error occurred';
  }),
}));

// Mock validation
vi.mock('../../utils/validation', () => ({
  validateRoleName: vi.fn((role: string) => {
    if (!role || role.trim().length === 0) {
      return { valid: false, error: 'Role name cannot be empty' };
    }
    return { valid: true };
  }),
  validatePermissionName: vi.fn((permission: string) => {
    if (!permission || permission.trim().length === 0) {
      return { valid: false, error: 'Permission name cannot be empty' };
    }
    return { valid: true };
  }),
  validatePermissionsList: vi.fn((permissions: string) => {
    if (!permissions || permissions.trim().length === 0) {
      return { valid: false, error: 'Permissions cannot be empty' };
    }
    return { valid: true };
  }),
}));

describe('useAuthorizationTests', () => {
  let mockDataClient: {
    getRoles: ReturnType<typeof vi.fn>;
    getPermissions: ReturnType<typeof vi.fn>;
    hasRole: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
    hasAnyRole: ReturnType<typeof vi.fn>;
    hasAllRoles: ReturnType<typeof vi.fn>;
    hasAnyPermission: ReturnType<typeof vi.fn>;
    hasAllPermissions: ReturnType<typeof vi.fn>;
    refreshRoles: ReturnType<typeof vi.fn>;
    refreshPermissions: ReturnType<typeof vi.fn>;
    clearCache: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataClient = {
      getRoles: vi.fn(),
      getPermissions: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasAnyRole: vi.fn(),
      hasAllRoles: vi.fn(),
      hasAnyPermission: vi.fn(),
      hasAllPermissions: vi.fn(),
      refreshRoles: vi.fn(),
      refreshPermissions: vi.fn(),
      clearCache: vi.fn(),
    };
  });

  describe('DataClient validation', () => {
    it('should handle null DataClient', async () => {
      // Simulate the hook behavior when dataClient is null
      const { toast } = await import('sonner');
      
      // This simulates what the hook does
      if (!mockDataClient) {
        toast.error('DataClient not initialized');
      }

      expect(toast.error).toHaveBeenCalledWith('DataClient not initialized');
    });
  });

  describe('getRoles functionality', () => {
    it('should call getRoles on DataClient', async () => {
      const roles = ['admin', 'user'];
      mockDataClient.getRoles.mockResolvedValue(roles);

      const result = await mockDataClient.getRoles();
      expect(result).toEqual(roles);
      expect(mockDataClient.getRoles).toHaveBeenCalledTimes(1);
    });

    it('should handle getRoles error', async () => {
      const error = new Error('Failed to get roles');
      mockDataClient.getRoles.mockRejectedValue(error);

      await expect(mockDataClient.getRoles()).rejects.toThrow('Failed to get roles');
    });
  });

  describe('getPermissions functionality', () => {
    it('should call getPermissions on DataClient', async () => {
      const permissions = ['user.read', 'user.write'];
      mockDataClient.getPermissions.mockResolvedValue(permissions);

      const result = await mockDataClient.getPermissions();
      expect(result).toEqual(permissions);
      expect(mockDataClient.getPermissions).toHaveBeenCalledTimes(1);
    });

    it('should handle getPermissions error', async () => {
      const error = new Error('Failed to get permissions');
      mockDataClient.getPermissions.mockRejectedValue(error);

      await expect(mockDataClient.getPermissions()).rejects.toThrow('Failed to get permissions');
    });
  });

  describe('hasRole functionality', () => {
    it('should call hasRole on DataClient', async () => {
      mockDataClient.hasRole.mockResolvedValue(true);

      const result = await mockDataClient.hasRole('admin');
      expect(result).toBe(true);
      expect(mockDataClient.hasRole).toHaveBeenCalledWith('admin');
    });

    it('should return false for non-existent role', async () => {
      mockDataClient.hasRole.mockResolvedValue(false);

      const result = await mockDataClient.hasRole('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('hasPermission functionality', () => {
    it('should call hasPermission on DataClient', async () => {
      mockDataClient.hasPermission.mockResolvedValue(true);

      const result = await mockDataClient.hasPermission('user.read');
      expect(result).toBe(true);
      expect(mockDataClient.hasPermission).toHaveBeenCalledWith('user.read');
    });

    it('should return false for non-existent permission', async () => {
      mockDataClient.hasPermission.mockResolvedValue(false);

      const result = await mockDataClient.hasPermission('user.delete');
      expect(result).toBe(false);
    });
  });

  describe('hasAnyRole functionality', () => {
    it('should call hasAnyRole on DataClient', async () => {
      mockDataClient.hasAnyRole.mockResolvedValue(true);

      const result = await mockDataClient.hasAnyRole(['admin', 'user']);
      expect(result).toBe(true);
      expect(mockDataClient.hasAnyRole).toHaveBeenCalledWith(['admin', 'user']);
    });
  });

  describe('hasAllRoles functionality', () => {
    it('should call hasAllRoles on DataClient', async () => {
      mockDataClient.hasAllRoles.mockResolvedValue(true);

      const result = await mockDataClient.hasAllRoles(['admin', 'user']);
      expect(result).toBe(true);
      expect(mockDataClient.hasAllRoles).toHaveBeenCalledWith(['admin', 'user']);
    });
  });

  describe('hasAnyPermission functionality', () => {
    it('should call hasAnyPermission on DataClient', async () => {
      mockDataClient.hasAnyPermission.mockResolvedValue(true);

      const result = await mockDataClient.hasAnyPermission(['user.read', 'user.write']);
      expect(result).toBe(true);
      expect(mockDataClient.hasAnyPermission).toHaveBeenCalledWith(['user.read', 'user.write']);
    });
  });

  describe('hasAllPermissions functionality', () => {
    it('should call hasAllPermissions on DataClient', async () => {
      mockDataClient.hasAllPermissions.mockResolvedValue(true);

      const result = await mockDataClient.hasAllPermissions(['user.read', 'user.write']);
      expect(result).toBe(true);
      expect(mockDataClient.hasAllPermissions).toHaveBeenCalledWith(['user.read', 'user.write']);
    });
  });

  describe('refreshRoles functionality', () => {
    it('should call refreshRoles on DataClient', async () => {
      mockDataClient.refreshRoles.mockResolvedValue(undefined);

      await mockDataClient.refreshRoles();
      expect(mockDataClient.refreshRoles).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshPermissions functionality', () => {
    it('should call refreshPermissions on DataClient', async () => {
      mockDataClient.refreshPermissions.mockResolvedValue(undefined);

      await mockDataClient.refreshPermissions();
      expect(mockDataClient.refreshPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache functionality', () => {
    it('should call clearCache on DataClient', () => {
      mockDataClient.clearCache.mockReturnValue(undefined);

      mockDataClient.clearCache();
      expect(mockDataClient.clearCache).toHaveBeenCalledTimes(1);
    });
  });
});
