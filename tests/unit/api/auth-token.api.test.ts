/**
 * Unit tests for AuthTokenApi
 */

import { AuthTokenApi } from '../../../src/api/auth-token.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  ValidateTokenRequest,
  ValidateTokenResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ClientTokenResponse,
  ClientTokenLegacyResponse,
} from '../../../src/api/types/auth.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('AuthTokenApi', () => {
  let authTokenApi: AuthTokenApi;
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
    authTokenApi = new AuthTokenApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('getClientToken', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: ClientTokenResponse = {
        success: true,
        data: {
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authTokenApi.getClientToken();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/client-token',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy provided', async () => {
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: ClientTokenResponse = {
        success: true,
        data: {
          token: 'client-token-456',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authTokenApi.getClientToken(authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/client-token',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Get client token failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authTokenApi.getClientToken()).rejects.toThrow('Get client token failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthTokenApi]'),
        expect.stringContaining('Get client token failed'),
      );
    });
  });

  describe('generateClientToken', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: ClientTokenLegacyResponse = {
        success: true,
        token: 'legacy-client-token-123',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authTokenApi.generateClientToken();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/token',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy provided', async () => {
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: ClientTokenLegacyResponse = {
        success: true,
        token: 'legacy-client-token-456',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authTokenApi.generateClientToken(authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/token',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Generate client token failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authTokenApi.generateClientToken()).rejects.toThrow('Generate client token failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthTokenApi]'),
        expect.stringContaining('Generate client token failed'),
      );
    });
  });

  describe('validateToken', () => {
    it('should call HttpClient.authenticatedRequest with correct parameters', async () => {
      const params: ValidateTokenRequest = {
        token: 'test-token',
      };
      const mockResponse: ValidateTokenResponse = {
        success: true,
        data: {
          authenticated: true,
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
          },
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authTokenApi.validateToken(params);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/validate',
        params.token,
        params,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest with authStrategy', async () => {
      const params: ValidateTokenRequest = {
        token: 'test-token',
        environment: 'production',
        application: 'my-app',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: ValidateTokenResponse = {
        success: true,
        data: {
          authenticated: true,
          user: {
            id: 'user-456',
            username: 'testuser2',
            email: 'test2@example.com',
          },
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authTokenApi.validateToken(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/validate',
        params.token,
        params,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle unauthenticated response', async () => {
      const params: ValidateTokenRequest = {
        token: 'invalid-token',
      };
      const mockResponse: ValidateTokenResponse = {
        success: true,
        data: {
          authenticated: false,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authTokenApi.validateToken(params);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/validate',
        params.token,
        params,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: ValidateTokenRequest = {
        token: 'invalid-token',
      };
      const error = new Error('Token validation failed');

      mockHttpClient.authenticatedRequest.mockRejectedValue(error);

      await expect(authTokenApi.validateToken(params)).rejects.toThrow('Token validation failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthTokenApi]'),
        expect.stringContaining('Token validation failed'),
      );
    });
  });

  describe('refreshToken', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const params: RefreshTokenRequest = {
        refreshToken: 'refresh-token-123',
      };
      const mockResponse: RefreshTokenResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token-123',
          refreshToken: 'new-refresh-token-123',
          expiresIn: 3600,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authTokenApi.refreshToken(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/refresh',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy provided', async () => {
      const params: RefreshTokenRequest = {
        refreshToken: 'refresh-token-456',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: RefreshTokenResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token-456',
          refreshToken: 'new-refresh-token-456',
          expiresIn: 3600,
        },
        message: 'Token refreshed successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authTokenApi.refreshToken(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/refresh',
        authStrategy,
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: RefreshTokenRequest = {
        refreshToken: 'invalid-refresh-token',
      };
      const error = new Error('Refresh token failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authTokenApi.refreshToken(params)).rejects.toThrow('Refresh token failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthTokenApi]'),
        expect.stringContaining('Refresh token failed'),
      );
    });
  });
});

