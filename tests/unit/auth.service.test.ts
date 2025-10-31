/**
 * Unit tests for AuthService
 */

import { AuthService } from '../../src/services/auth.service';
import { HttpClient } from '../../src/utils/http-client';
import { RedisService } from '../../src/services/redis.service';
import { MisoClientConfig } from '../../src/types/config.types';

// Mock HttpClient
jest.mock('../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock RedisService
jest.mock('../../src/services/redis.service');
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

// Mock axios for getEnvironmentToken
jest.mock('axios');

describe('AuthService', () => {
  let authService: AuthService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      clientId: 'ctrl-dev-test-app',
      clientSecret: 'test-secret'
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn(),
      request: jest.fn()
    } as any;
    (mockHttpClient as any).config = config; // Add config to httpClient for access

    mockRedisService = {} as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    authService = new AuthService(mockHttpClient, mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should generate correct login URL', () => {
      const loginUrl = authService.login('/dashboard');

      expect(loginUrl).toContain('https://controller.aifabrix.ai/api/auth/login');
      expect(loginUrl).toContain('redirect=%2Fdashboard');
      // No longer includes environment/application - backend extracts from client credentials
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        authenticated: true,
        user: { id: '123', username: 'testuser' }
      });

      const result = await authService.validateToken('valid-token');

      expect(result).toBe(true);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/auth/validate',
        'valid-token'
      );
    });

    it('should return false for invalid token', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        authenticated: false,
        error: 'Invalid token'
      });

      const result = await authService.validateToken('invalid-token');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await authService.validateToken('token');

      expect(result).toBe(false);
    });
  });

  describe('getUser', () => {
    it('should return user info for valid token', async () => {
      const userInfo = { id: '123', username: 'testuser', email: 'test@example.com' };
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        authenticated: true,
        user: userInfo
      });

      const result = await authService.getUser('valid-token');

      expect(result).toEqual(userInfo);
    });

    it('should return null for invalid token', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        authenticated: false,
        error: 'Invalid token'
      });

      const result = await authService.getUser('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await authService.getUser('token');

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should call logout endpoint', async () => {
      mockHttpClient.request.mockResolvedValue({});

      await authService.logout();

      expect(mockHttpClient.request).toHaveBeenCalledWith('POST', '/api/auth/logout');
    });

    it('should throw error on failure', async () => {
      mockHttpClient.request.mockRejectedValue(new Error('Logout failed'));

      await expect(authService.logout()).rejects.toThrow('Logout failed');
    });

    it('should handle non-Error thrown values', async () => {
      mockHttpClient.request.mockRejectedValue('String error');

      await expect(authService.logout()).rejects.toThrow('Logout failed: Unknown error');
    });
  });

  describe('isAuthenticated', () => {
    it('should return authentication status', async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        authenticated: true,
        user: { id: '123', username: 'testuser' }
      });

      const result = await authService.isAuthenticated('token');

      expect(result).toBe(true);
    });
  });

  describe('getEnvironmentToken', () => {
    let mockAxios: any;
    let mockTempAxios: any;

    beforeEach(() => {
      mockAxios = require('axios');
      mockTempAxios = {
        post: jest.fn()
      };
      // Reset and setup axios.create mock
      mockAxios.create.mockImplementation((config?: any) => {
        if (config?.headers?.['X-Client-Id']) {
          return mockTempAxios;
        }
        return { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn() };
      });
    });

    it('should fetch and return environment token', async () => {
      mockTempAxios.post.mockResolvedValue({
        data: {
          success: true,
          token: 'env-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      const result = await authService.getEnvironmentToken();

      expect(result).toBe('env-token-123');
      expect(mockTempAxios.post).toHaveBeenCalledWith('/api/auth/token');
    });

    it('should throw error on invalid response', async () => {
      mockTempAxios.post.mockResolvedValue({
        data: {
          success: false
        }
      });

      await expect(authService.getEnvironmentToken()).rejects.toThrow('Failed to get environment token');
    });

    it('should throw error on network failure', async () => {
      mockTempAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(authService.getEnvironmentToken()).rejects.toThrow('Failed to get environment token');
    });

    it('should handle non-Error thrown values', async () => {
      mockTempAxios.post.mockRejectedValue('String error');

      await expect(authService.getEnvironmentToken()).rejects.toThrow('Failed to get environment token: Unknown error');
    });
  });

  describe('getUserInfo', () => {
    it('should return user info from GET endpoint', async () => {
      const userInfo = { id: '123', username: 'testuser', email: 'test@example.com' };
      mockHttpClient.authenticatedRequest.mockResolvedValue(userInfo);

      const result = await authService.getUserInfo('valid-token');

      expect(result).toEqual(userInfo);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/auth/user',
        'valid-token'
      );
    });

    it('should return null on error', async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(new Error('Network error'));

      const result = await authService.getUserInfo('token');

      expect(result).toBeNull();
    });
  });

  describe('API_KEY support for testing', () => {
    beforeEach(() => {
      config = {
        controllerUrl: 'https://controller.aifabrix.ai',
        clientId: 'ctrl-dev-test-app',
        clientSecret: 'test-secret',
        apiKey: 'test-api-key-123'
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockRedisService);
    });

    describe('validateToken with API_KEY', () => {
      it('should return true for matching API_KEY without calling controller', async () => {
        const result = await authService.validateToken('test-api-key-123');

        expect(result).toBe(true);
        expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
      });

      it('should fall through to controller for non-matching token', async () => {
        mockHttpClient.authenticatedRequest.mockResolvedValue({
          authenticated: true,
          user: { id: '123', username: 'testuser' }
        });

        const result = await authService.validateToken('different-token');

        expect(result).toBe(true);
        expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
          'POST',
          '/api/auth/validate',
          'different-token'
        );
      });

      it('should be case-sensitive', async () => {
        mockHttpClient.authenticatedRequest.mockResolvedValue({
          authenticated: false,
          error: 'Invalid token'
        });

        const result = await authService.validateToken('TEST-API-KEY-123');

        expect(result).toBe(false);
        expect(mockHttpClient.authenticatedRequest).toHaveBeenCalled();
      });
    });

    describe('getUser with API_KEY', () => {
      it('should return null for matching API_KEY without calling controller', async () => {
        const result = await authService.getUser('test-api-key-123');

        expect(result).toBeNull();
        expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
      });

      it('should fall through to controller for non-matching token', async () => {
        const userInfo = { id: '123', username: 'testuser', email: 'test@example.com' };
        mockHttpClient.authenticatedRequest.mockResolvedValue({
          authenticated: true,
          user: userInfo
        });

        const result = await authService.getUser('different-token');

        expect(result).toEqual(userInfo);
        expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
          'POST',
          '/api/auth/validate',
          'different-token'
        );
      });
    });

    describe('getUserInfo with API_KEY', () => {
      it('should return null for matching API_KEY without calling controller', async () => {
        const result = await authService.getUserInfo('test-api-key-123');

        expect(result).toBeNull();
        expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
      });

      it('should fall through to controller for non-matching token', async () => {
        const userInfo = { id: '123', username: 'testuser', email: 'test@example.com' };
        mockHttpClient.authenticatedRequest.mockResolvedValue(userInfo);

        const result = await authService.getUserInfo('different-token');

        expect(result).toEqual(userInfo);
        expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
          'GET',
          '/api/auth/user',
          'different-token'
        );
      });
    });

    describe('isAuthenticated with API_KEY', () => {
      it('should return true for matching API_KEY (delegates to validateToken)', async () => {
        const result = await authService.isAuthenticated('test-api-key-123');

        expect(result).toBe(true);
        expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
      });

      it('should fall through to controller for non-matching token', async () => {
        mockHttpClient.authenticatedRequest.mockResolvedValue({
          authenticated: true,
          user: { id: '123', username: 'testuser' }
        });

        const result = await authService.isAuthenticated('different-token');

        expect(result).toBe(true);
        expect(mockHttpClient.authenticatedRequest).toHaveBeenCalled();
      });
    });
  });

  describe('validateToken without API_KEY (normal flow)', () => {
    it('should call controller when API_KEY is not configured', async () => {
      config = {
        controllerUrl: 'https://controller.aifabrix.ai',
        clientId: 'ctrl-dev-test-app',
        clientSecret: 'test-secret'
        // apiKey not set
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockRedisService);

      mockHttpClient.authenticatedRequest.mockResolvedValue({
        authenticated: true,
        user: { id: '123', username: 'testuser' }
      });

      const result = await authService.validateToken('some-token');

      expect(result).toBe(true);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/auth/validate',
        'some-token'
      );
    });
  });
});
