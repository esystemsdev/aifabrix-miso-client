/**
 * Unit tests for RoleService
 */

import { RoleService } from '../../src/services/role.service';
import { HttpClient } from '../../src/utils/http-client';
import { RedisService } from '../../src/services/redis.service';
import { MisoClientConfig } from '../../src/types/config.types';

// Mock HttpClient
jest.mock('../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock RedisService
jest.mock('../../src/services/redis.service');
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('RoleService', () => {
  let roleService: RoleService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      environment: 'dev',
      applicationKey: 'test-app',
      applicationId: 'test-app-id-123',
      cache: { roleTTL: 900 }
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn()
    } as any;

    mockRedisService = {
      isConnected: jest.fn(),
      get: jest.fn(),
      set: jest.fn()
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    roleService = new RoleService(config, mockRedisService);

    // Get the actual HttpClient instance created by RoleService
    mockHttpClient = (roleService as any).httpClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoles', () => {
    it('should return cached roles from Redis', async () => {
      const cachedRoles = { roles: ['admin', 'user'], timestamp: Date.now() };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedRoles));
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        user: { id: '123' }
      });

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['admin', 'user']);
      expect(mockRedisService.get).toHaveBeenCalledWith('roles:123:dev:test-app');
      // Note: HTTP client is still called to get user ID, but not for roles
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/auth/validate',
        'token'
      );
    });

    it('should fetch roles from controller when cache miss', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({ userId: '123', roles: ['admin', 'user'] });
      mockRedisService.set.mockResolvedValue(true);

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['admin', 'user']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/auth/roles',
        'token'
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'roles:123:dev:test-app',
        expect.stringContaining('"roles":["admin","user"]'),
        900
      );
    });

    it('should handle Redis connection failure gracefully', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({ userId: '123', roles: ['admin'] });

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['admin']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/auth/roles',
        'token'
      );
    });

    it('should handle invalid cached data', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue('invalid-json');
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({ userId: '123', roles: ['user'] });

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['user']);
    });

    it('should return empty array on error', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await roleService.getRoles('token');

      expect(result).toEqual([]);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has role', async () => {
      jest.spyOn(roleService, 'getRoles').mockResolvedValue(['admin', 'user']);

      const result = await roleService.hasRole('token', 'admin');

      expect(result).toBe(true);
    });

    it('should return false when user does not have role', async () => {
      jest.spyOn(roleService, 'getRoles').mockResolvedValue(['user']);

      const result = await roleService.hasRole('token', 'admin');

      expect(result).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true when user has any of the roles', async () => {
      jest.spyOn(roleService, 'getRoles').mockResolvedValue(['admin', 'user']);

      const result = await roleService.hasAnyRole('token', ['admin', 'moderator']);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the roles', async () => {
      jest.spyOn(roleService, 'getRoles').mockResolvedValue(['user']);

      const result = await roleService.hasAnyRole('token', ['admin', 'moderator']);

      expect(result).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true when user has all roles', async () => {
      jest.spyOn(roleService, 'getRoles').mockResolvedValue(['admin', 'user', 'moderator']);

      const result = await roleService.hasAllRoles('token', ['admin', 'user']);

      expect(result).toBe(true);
    });

    it('should return false when user missing some roles', async () => {
      jest.spyOn(roleService, 'getRoles').mockResolvedValue(['admin']);

      const result = await roleService.hasAllRoles('token', ['admin', 'user']);

      expect(result).toBe(false);
    });
  });

  describe('refreshRoles', () => {
    it('should force refresh roles from controller', async () => {
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({ userId: '123', roles: ['admin', 'user'] });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.set.mockResolvedValue(true);

      const result = await roleService.refreshRoles('token');

      expect(result).toEqual(['admin', 'user']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/auth/roles',
        'token'
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'roles:123:dev:test-app',
        expect.stringContaining('"roles":["admin","user"]'),
        900
      );
    });

    it('should return empty array on error', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await roleService.refreshRoles('token');

      expect(result).toEqual([]);
    });
  });
});
