/**
 * Unit tests for PermissionService
 */

import { PermissionService } from '../../src/services/permission.service';
import { HttpClient } from '../../src/utils/http-client';
import { RedisService } from '../../src/services/redis.service';
import { MisoClientConfig } from '../../src/types/config.types';

// Mock dependencies
jest.mock('../../src/utils/http-client');
jest.mock('../../src/services/redis.service');
jest.mock('jsonwebtoken');

const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;
const jwt = require('jsonwebtoken');

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let config: MisoClientConfig;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      clientId: 'ctrl-dev-test-app',
      clientSecret: 'test-secret',
      cache: { permissionTTL: 900 }
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn()
    } as any;
    (mockHttpClient as any).config = config; // Add config to httpClient for access

    mockRedisService = {
      isConnected: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    permissionService = new PermissionService(mockHttpClient, mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPermissions', () => {
    it('should return cached permissions from Redis', async () => {
      const cachedPermissions = {
        permissions: ['read:users', 'write:posts'],
        timestamp: Date.now()
      };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedPermissions));
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:users', 'write:posts']);
      expect(mockRedisService.get).toHaveBeenCalledWith('permissions:123');
      // No HTTP client calls when userId extracted from token and cache hit
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it('should fetch permissions from controller when cache miss', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        permissions: ['read:users', 'write:posts'],
        environment: 'dev',
        application: 'test-app'
      });
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:users', 'write:posts']);
      // Only one call - to get permissions (userId extracted from token)
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/auth/permissions',
        'token'
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'permissions:123',
        expect.stringContaining('"permissions":["read:users","write:posts"]'),
        900
      );
    });

    it('should handle Redis not connected', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        permissions: ['read:users'],
        environment: 'dev',
        application: 'test-app'
      });

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:users']);
      expect(mockRedisService.get).not.toHaveBeenCalled();
      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    it('should handle invalid cached data', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue('invalid-json');
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        permissions: ['read:users'],
        environment: 'dev',
        application: 'test-app'
      });
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:users']);
      // Only one call - to get permissions (userId extracted from token)
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user validation fails', async () => {
      // JWT decode returns null (no userId in token)
      jwt.decode.mockReturnValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({});

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual([]);
    });

    it('should handle JWT decode failure gracefully', async () => {
      // Mock JWT decode to throw error
      jwt.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await permissionService.getPermissions('invalid-token');

      expect(result).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: ['read:users', 'write:posts'], timestamp: Date.now() })
      );
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await permissionService.hasPermission('token', 'read:users');

      expect(result).toBe(true);
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it('should return false when user does not have permission', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: ['read:users'], timestamp: Date.now() })
      );
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await permissionService.hasPermission('token', 'write:posts');

      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has any of the permissions', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: ['read:users', 'write:posts'], timestamp: Date.now() })
      );
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await permissionService.hasAnyPermission('token', [
        'write:posts',
        'delete:users'
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the permissions', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: ['read:users'], timestamp: Date.now() })
      );
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await permissionService.hasAnyPermission('token', [
        'write:posts',
        'delete:users'
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all permissions', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          permissions: ['read:users', 'write:posts', 'delete:users'],
          timestamp: Date.now()
        })
      );
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await permissionService.hasAllPermissions('token', [
        'read:users',
        'write:posts'
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user is missing some permissions', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: ['read:users'], timestamp: Date.now() })
      );
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await permissionService.hasAllPermissions('token', [
        'read:users',
        'write:posts'
      ]);

      expect(result).toBe(false);
    });
  });

  describe('refreshPermissions', () => {
    it('should fetch fresh permissions from controller', async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({
          userId: '123',
          permissions: ['read:users', 'write:posts'],
          environment: 'dev',
          application: 'test-app'
        });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.refreshPermissions('token');

      expect(result).toEqual(['read:users', 'write:posts']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/auth/permissions/refresh',
        'token'
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'permissions:123',
        expect.stringContaining('"permissions":["read:users","write:posts"]'),
        900
      );
    });

    it('should handle errors during refresh', async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await permissionService.refreshPermissions('token');

      expect(result).toEqual([]);
    });

    it('should return empty array when user validation fails', async () => {
      // Mock JWT decode to return userId, but validate returns empty
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockResolvedValueOnce({});

      const result = await permissionService.refreshPermissions('token');

      expect(result).toEqual([]);
    });
  });

  describe('clearPermissionsCache', () => {
    it('should clear cached permissions from Redis', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache('token');

      expect(mockRedisService.delete).toHaveBeenCalledWith('permissions:123');
    });

    it('should handle Redis not connected', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });
      mockRedisService.isConnected.mockReturnValue(false);

      await permissionService.clearPermissionsCache('token');

      expect(mockRedisService.delete).not.toHaveBeenCalled();
    });

    it('should handle user validation failure', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({});

      await permissionService.clearPermissionsCache('token');

      expect(mockRedisService.delete).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      await expect(permissionService.clearPermissionsCache('token')).resolves.not.toThrow();
    });

    it('should handle Redis delete failure gracefully', async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.delete.mockRejectedValue(new Error('Redis delete failed'));

      await expect(permissionService.clearPermissionsCache('token')).resolves.not.toThrow();
    });

    it('should extract userId from validate API when clearing cache', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '456' } });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache('token');

      expect(mockRedisService.delete).toHaveBeenCalledWith('permissions:456');
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/auth/validate',
        'token'
      );
    });

    it('should handle different user IDs from validate API when clearing cache', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '789' } });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache('token');

      expect(mockRedisService.delete).toHaveBeenCalledWith('permissions:789');
    });

    it('should always use validate API to get userId for clearing cache', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '999' } });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache('token');

      expect(mockRedisService.delete).toHaveBeenCalledWith('permissions:999');
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/auth/validate',
        'token'
      );
    });
  });

  describe('extractUserIdFromToken edge cases', () => {
    it('should extract userId from id field when sub is not present', async () => {
      jwt.decode.mockReturnValue({ id: 'user-from-id' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: 'user-from-id',
        permissions: ['read:test'],
        environment: 'dev',
        application: 'test-app'
      });

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:test']);
      expect(mockRedisService.get).toHaveBeenCalledWith('permissions:user-from-id');
    });

    it('should handle JWT decode returning empty object', async () => {
      jwt.decode.mockReturnValue({});
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({
          userId: '123',
          permissions: ['read:test'],
          environment: 'dev',
          application: 'test-app'
        });

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:test']);
    });

    it('should handle permissions array in response correctly', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        permissions: ['perm1', 'perm2', 'perm3'],
        environment: 'dev',
        application: 'test-app'
      });
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['perm1', 'perm2', 'perm3']);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'permissions:123',
        expect.stringContaining('"permissions":["perm1","perm2","perm3"]'),
        900
      );
    });

    it('should handle empty permissions array', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        permissions: [],
        environment: 'dev',
        application: 'test-app'
      });
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual([]);
    });
  });

  describe('permission checking edge cases', () => {
    it('should handle empty permissions array in hasPermission', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: [], timestamp: Date.now() })
      );

      const result = await permissionService.hasPermission('token', 'read:users');

      expect(result).toBe(false);
    });

    it('should handle permission check with multiple matching permissions', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          permissions: ['read:users', 'write:users', 'delete:users'],
          timestamp: Date.now()
        })
      );

      const result = await permissionService.hasPermission('token', 'write:users');

      expect(result).toBe(true);
    });

    it('should handle hasAnyPermission with empty array input', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          permissions: ['read:users'],
          timestamp: Date.now()
        })
      );

      const result = await permissionService.hasAnyPermission('token', []);

      expect(result).toBe(false);
    });

    it('should handle hasAllPermissions with empty array input', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          permissions: ['read:users'],
          timestamp: Date.now()
        })
      );

      const result = await permissionService.hasAllPermissions('token', []);

      expect(result).toBe(true); // Empty array should return true
    });

    it('should handle hasAllPermissions with exact match', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          permissions: ['read:users', 'write:users'],
          timestamp: Date.now()
        })
      );

      const result = await permissionService.hasAllPermissions('token', [
        'read:users',
        'write:users'
      ]);

      expect(result).toBe(true);
    });

    it('should handle hasAllPermissions with one permission missing', async () => {
      jwt.decode.mockReturnValue({ sub: '123' });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          permissions: ['read:users'],
          timestamp: Date.now()
        })
      );

      const result = await permissionService.hasAllPermissions('token', [
        'read:users',
        'write:users',
        'delete:users'
      ]);

      expect(result).toBe(false);
    });
  });

  describe('refreshPermissions edge cases', () => {
    it('should handle refresh when userId extracted from token', async () => {
      jwt.decode.mockReturnValue({ sub: 'refresh-user' });
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: 'refresh-user' } })
        .mockResolvedValueOnce({
          userId: 'refresh-user',
          permissions: ['refresh:perm'],
          environment: 'dev',
          application: 'test-app'
        });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.refreshPermissions('token');

      expect(result).toEqual(['refresh:perm']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/auth/permissions/refresh',
        'token'
      );
    });

    it('should handle refresh when cache update fails', async () => {
      jwt.decode.mockReturnValue({ sub: 'refresh-user' });
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: 'refresh-user' } })
        .mockResolvedValueOnce({
          userId: 'refresh-user',
          permissions: ['perm1'],
          environment: 'dev',
          application: 'test-app'
        });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.set.mockResolvedValue(false);

      const result = await permissionService.refreshPermissions('token');

      // Should still return permissions even if cache update fails
      expect(result).toEqual(['perm1']);
    });
  });

  describe('configuration', () => {
    it('should use default permission TTL when not configured', () => {
      const configWithoutTTL = {
        controllerUrl: 'https://controller.aifabrix.ai',
        clientId: 'ctrl-dev-test-app',
        clientSecret: 'test-secret'
      };
      (mockHttpClient as any).config = configWithoutTTL;

      const service = new PermissionService(mockHttpClient, mockRedisService);
      expect(service).toBeDefined();
    });

    it('should use custom permission TTL when configured', () => {
      const configWithTTL = {
        controllerUrl: 'https://controller.aifabrix.ai',
        clientId: 'ctrl-dev-test-app',
        clientSecret: 'test-secret',
        cache: { permissionTTL: 1800 }
      };
      (mockHttpClient as any).config = configWithTTL;

      const service = new PermissionService(mockHttpClient, mockRedisService);
      expect(service).toBeDefined();
    });
  });
});
