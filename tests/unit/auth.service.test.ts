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

describe('AuthService', () => {
  let authService: AuthService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      environment: 'dev',
      applicationKey: 'test-app',
      applicationId: 'test-app-id-123'
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn(),
      post: jest.fn()
    } as any;

    mockRedisService = {} as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    authService = new AuthService(config, mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should generate correct login URL', () => {
      const loginUrl = authService.login('/dashboard');

      expect(loginUrl).toContain('https://controller.aifabrix.ai/auth/login');
      expect(loginUrl).toContain('environment=dev');
      expect(loginUrl).toContain('application=test-app');
      expect(loginUrl).toContain('redirect=%2Fdashboard');
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
        '/auth/validate',
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
      mockHttpClient.post.mockResolvedValue({});

      await authService.logout();

      expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/logout', {
        environment: 'dev',
        application: 'test-app'
      });
    });

    it('should throw error on failure', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('Logout failed'));

      await expect(authService.logout()).rejects.toThrow('Logout failed');
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
});
