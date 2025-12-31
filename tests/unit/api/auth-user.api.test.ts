/**
 * Unit tests for AuthUserApi
 */

import { AuthUserApi } from '../../../src/api/auth-user.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  GetUserResponse,
  LogoutResponse,
  CallbackRequest,
  CallbackResponse,
} from '../../../src/api/types/auth.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('AuthUserApi', () => {
  let authUserApi: AuthUserApi;
  let mockHttpClient: jest.Mocked<HttpClient>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
    mockHttpClient = {
      request: jest.fn(),
      authenticatedRequest: jest.fn(),
      requestWithAuthStrategy: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    authUserApi = new AuthUserApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('getUser', () => {
    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: GetUserResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
          },
          authenticated: true,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authUserApi.getUser(authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/user',
        authStrategy.bearerToken,
        undefined,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: GetUserResponse = {
        success: true,
        data: {
          user: {
            id: 'user-456',
            username: 'testuser2',
            email: 'test2@example.com',
          },
          authenticated: true,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authUserApi.getUser(authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/user',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when no authStrategy provided', async () => {
      await expect(authUserApi.getUser()).rejects.toThrow(
        'getUser requires authentication - provide authStrategy with bearerToken',
      );
    });

    it('should handle errors', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'invalid-token',
      };
      const error = new Error('Get user failed');

      mockHttpClient.authenticatedRequest.mockRejectedValue(error);

      await expect(authUserApi.getUser(authStrategy)).rejects.toThrow('Get user failed');
      expect(console.error).toHaveBeenCalledWith('Get user API call failed:', error);
    });
  });

  describe('logout', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const mockResponse: LogoutResponse = {
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authUserApi.logout();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/logout',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Logout failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authUserApi.logout()).rejects.toThrow('Logout failed');
      expect(console.error).toHaveBeenCalledWith('Logout API call failed:', error);
    });
  });

  describe('logoutWithToken', () => {
    it('should call HttpClient.request with token in body', async () => {
      const token = 'test-token';
      const mockResponse: LogoutResponse = {
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authUserApi.logoutWithToken(token);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/logout',
        { token },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const token = 'invalid-token';
      const error = new Error('Logout with token failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authUserApi.logoutWithToken(token)).rejects.toThrow('Logout with token failed');
      expect(console.error).toHaveBeenCalledWith('Logout with token API call failed:', error);
    });
  });

  describe('handleCallback', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const params: CallbackRequest = {
        code: 'auth-code-123',
        state: 'state-123',
        redirect: 'http://localhost:3000/callback',
      };
      const mockResponse: CallbackResponse = {
        success: true,
        message: 'Callback handled successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authUserApi.handleCallback(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/callback',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy provided', async () => {
      const params: CallbackRequest = {
        code: 'auth-code-456',
        state: 'state-456',
        redirect: 'http://localhost:3000/callback',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: CallbackResponse = {
        success: true,
        message: 'Callback handled successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authUserApi.handleCallback(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/callback',
        authStrategy,
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle callback with minimal params', async () => {
      const params: CallbackRequest = {
        code: 'auth-code-789',
        state: 'state-789',
        redirect: 'http://localhost:3000/callback',
      };
      const mockResponse: CallbackResponse = {
        success: true,
        message: 'Callback handled successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authUserApi.handleCallback(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/callback',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: CallbackRequest = {
        code: 'invalid-code',
        state: 'invalid-state',
        redirect: 'http://localhost:3000/callback',
      };
      const error = new Error('Handle callback failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authUserApi.handleCallback(params)).rejects.toThrow('Handle callback failed');
      expect(console.error).toHaveBeenCalledWith('Handle callback API call failed:', error);
    });
  });
});

