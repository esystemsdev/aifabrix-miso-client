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

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

describe('RoleService', () => {
  let roleService: RoleService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      clientId: 'ctrl-dev-test-app',
      clientSecret: 'test-secret',
      cache: { roleTTL: 900 }
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn()
    } as any;
    (mockHttpClient as any).config = config; // Add config to httpClient for access

    mockRedisService = {
      isConnected: jest.fn(),
      get: jest.fn(),
      set: jest.fn()
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    roleService = new RoleService(mockHttpClient, mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoles', () => {
    it('should return cached roles from Redis', async () => {
      const cachedRoles = { roles: ['admin', 'user'], timestamp: Date.now() };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedRoles));
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['admin', 'user']);
      expect(mockRedisService.get).toHaveBeenCalledWith('roles:123');
      // No HTTP client calls when userId extracted from token and cache hit
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it('should fetch roles from controller when cache miss', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        roles: ['admin', 'user'],
        environment: 'dev',
        application: 'test-app'
      });
      mockRedisService.set.mockResolvedValue(true);

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['admin', 'user']);
      // Only one call - to get roles (userId extracted from token)
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/auth/roles',
        'token'
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'roles:123',
        expect.stringContaining('"roles":["admin","user"]'),
        900
      );
    });

    it('should handle Redis connection failure gracefully', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        roles: ['admin'],
        environment: 'dev',
        application: 'test-app'
      });

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['admin']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/auth/roles',
        'token'
      );
    });

    it('should handle invalid cached data', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue('invalid-json');
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '123',
        roles: ['user'],
        environment: 'dev',
        application: 'test-app'
      });

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['user']);
    });

    it('should return empty array on error', async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await roleService.getRoles('token');

      expect(result).toEqual([]);
    });

    it('should handle JWT decode failure gracefully', async () => {
      // Mock JWT decode to throw error
      jwt.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await roleService.getRoles('invalid-token');

      expect(result).toEqual([]);
    });

    it('should extract userId from different JWT claim fields', async () => {
      // Test with user_id field (alternative to sub)
      jwt.decode.mockReturnValue({ user_id: '456', userId: null });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: '456',
        roles: ['user'],
        environment: 'dev',
        application: 'test-app'
      });

      const result = await roleService.getRoles('token');

      expect(result).toEqual(['user']);
      expect(mockRedisService.get).toHaveBeenCalledWith('roles:456');
    });

    it('should return empty array when validate returns no userId', async () => {
      // JWT decode returns null
      jwt.decode.mockReturnValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        user: {} // No id field
      });

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
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: '123', userId: '123' });
      mockHttpClient.authenticatedRequest
        .mockResolvedValueOnce({ user: { id: '123' } })
        .mockResolvedValueOnce({
          userId: '123',
          roles: ['admin', 'user'],
          environment: 'dev',
          application: 'test-app'
        });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.set.mockResolvedValue(true);

      const result = await roleService.refreshRoles('token');

      expect(result).toEqual(['admin', 'user']);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/auth/roles/refresh',
        'token'
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'roles:123',
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
