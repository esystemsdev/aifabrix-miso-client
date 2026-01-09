/**
 * Unit tests for AuthApi
 */

import { AuthApi } from '../../../src/api/auth.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  LoginRequest,
  LoginResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
  GetUserResponse,
} from '../../../src/api/types/auth.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('AuthApi', () => {
  let authApi: AuthApi;
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
    authApi = new AuthApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('login', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const params: LoginRequest = {
        redirect: 'http://localhost:3000/callback',
        state: 'abc123',
      };
      const mockResponse: LoginResponse = {
        success: true,
        data: {
          loginUrl: 'https://keycloak.example.com/auth',
          state: 'abc123',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authApi.login(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/login',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle authStrategy', async () => {
      const params: LoginRequest = {
        redirect: 'http://localhost:3000/callback',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: LoginResponse = {
        success: true,
        data: {
          loginUrl: 'https://keycloak.example.com/auth',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authApi.login(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/login',
        authStrategy,
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: LoginRequest = {
        redirect: 'http://localhost:3000/callback',
      };
      const error = new Error('Network error');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authApi.login(params)).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthLoginApi]'),
        expect.stringContaining('Network error'),
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

      const result = await authApi.validateToken(params);

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
      const error = new Error('Invalid token');

      mockHttpClient.authenticatedRequest.mockRejectedValue(error);

      await expect(authApi.validateToken(params)).rejects.toThrow('Invalid token');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthTokenApi]'),
        expect.stringContaining('Invalid token'),
      );
    });
  });

  describe('getUser', () => {
    it('should call HttpClient.authenticatedRequest with bearerToken', async () => {
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

      const result = await authApi.getUser(authStrategy);

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

    it('should throw error if no authStrategy provided', async () => {
      await expect(authApi.getUser()).rejects.toThrow(
        'getUser requires authentication - provide authStrategy with bearerToken',
      );
    });
  });

});

