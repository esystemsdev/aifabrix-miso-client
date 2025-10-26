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

const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let config: MisoClientConfig;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      environment: 'dev',
      applicationKey: 'test-app',
      applicationId: 'test-app-id-123',
      cache: { permissionTTL: 900 }
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn()
    } as any;

    mockRedisService = {
      isConnected: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    permissionService = new PermissionService(config, mockRedisService);
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
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        user: { id: '123' }
      });

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:users', 'write:posts']);
      expect(mockRedisService.get).toHaveBeenCalledWith('permissions:123:dev:test-app');
      // Note: HTTP client is still called to get user ID, but not for permissions
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/auth/validate',
        'token'
      );
    });

    it('should fetch permissions from controller when cache miss', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({
          userId: '123',
          permissions: ['read:users', 'write:posts'],
          environment: 'dev',
          application: 'test-app'
        });
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:users', 'write:posts']);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'permissions:123:dev:test-app',
        expect.stringContaining('"permissions":["read:users","write:posts"]'),
        900
      );
    });

    it('should handle Redis not connected', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({
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
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({
          userId: '123',
          permissions: ['read:users'],
          environment: 'dev',
          application: 'test-app'
        });
      mockRedisService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual(['read:users']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when user validation fails', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({});

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await permissionService.getPermissions('token');

      expect(result).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: ['read:users', 'write:posts'], timestamp: Date.now() })
      );
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });

      const result = await permissionService.hasPermission('token', 'read:users');

      expect(result).toBe(true);
    });

    it('should return false when user does not have permission', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ permissions: ['read:users'], timestamp: Date.now() })
      );
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });

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
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });

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
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });

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
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });

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
      mockHttpClient.authenticatedRequest.mockResolvedValue({ user: { id: '123' } });

      const result = await permissionService.hasAllPermissions('token', [
        'read:users',
        'write:posts'
      ]);

      expect(result).toBe(false);
    });
  });

  describe('refreshPermissions', () => {
    it('should fetch fresh permissions from controller', async () => {
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
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'permissions:123:dev:test-app',
        expect.stringContaining('"permissions":["read:users","write:posts"]'),
        900
      );
    });

    it('should handle errors during refresh', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await permissionService.refreshPermissions('token');

      expect(result).toEqual([]);
    });

    it('should return empty array when user validation fails', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({});

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

      expect(mockRedisService.delete).toHaveBeenCalledWith('permissions:123:dev:test-app');
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
  });

  describe('configuration', () => {
    it('should use default permission TTL when not configured', () => {
      const configWithoutTTL = {
        controllerUrl: 'https://controller.aifabrix.ai',
        environment: 'dev' as const,
        applicationKey: 'test-app',
        applicationId: 'test-app-id-123'
      };

      const service = new PermissionService(configWithoutTTL, mockRedisService);
      expect(service).toBeDefined();
    });

    it('should use custom permission TTL when configured', () => {
      const configWithTTL = {
        controllerUrl: 'https://controller.aifabrix.ai',
        environment: 'dev' as const,
        applicationKey: 'test-app',
        applicationId: 'test-app-id-123',
        cache: { permissionTTL: 1800 }
      };

      const service = new PermissionService(configWithTTL, mockRedisService);
      expect(service).toBeDefined();
    });
  });
});
