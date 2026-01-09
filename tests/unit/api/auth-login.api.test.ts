/**
 * Unit tests for AuthLoginApi
 */

import { AuthLoginApi } from '../../../src/api/auth-login.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  LoginRequest,
  LoginResponse,
  DeviceCodeRequest,
  DeviceCodeResponse,
  DeviceCodeTokenRequest,
  DeviceCodeTokenResponse,
  DeviceCodeRefreshRequest,
  DiagnosticsResponse,
} from '../../../src/api/types/auth.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('AuthLoginApi', () => {
  let authLoginApi: AuthLoginApi;
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
    authLoginApi = new AuthLoginApi(mockHttpClient);
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

      const result = await authLoginApi.login(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/login',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with params without state', async () => {
      const params: LoginRequest = {
        redirect: 'http://localhost:3000/callback',
      };
      const mockResponse: LoginResponse = {
        success: true,
        data: {
          loginUrl: 'https://keycloak.example.com/auth',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.login(params);

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
        methods: ['bearer'],
      };
      const mockResponse: LoginResponse = {
        success: true,
        data: {
          loginUrl: 'https://keycloak.example.com/auth',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authLoginApi.login(params, authStrategy);

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
      const error = new Error('Login failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authLoginApi.login(params)).rejects.toThrow('Login failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthLoginApi]'),
        expect.stringContaining('Login failed'),
      );
    });
  });

  describe('initiateDeviceCode', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const params: DeviceCodeRequest = {
        environment: 'production',
        scope: 'openid profile',
      };
      const mockResponse: DeviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-123',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://keycloak.example.com/device',
          verificationUriComplete: 'https://keycloak.example.com/device?user_code=ABCD-EFGH',
          expiresIn: 600,
          interval: 5,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.initiateDeviceCode(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/login',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with minimal params', async () => {
      const params: DeviceCodeRequest = {};
      const mockResponse: DeviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-456',
          userCode: 'IJKL-MNOP',
          verificationUri: 'https://keycloak.example.com/device',
          expiresIn: 600,
          interval: 5,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.initiateDeviceCode(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/login',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle authStrategy', async () => {
      const params: DeviceCodeRequest = {
        environment: 'staging',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: DeviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-789',
          userCode: 'QRST-UVWX',
          verificationUri: 'https://keycloak.example.com/device',
          expiresIn: 600,
          interval: 5,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authLoginApi.initiateDeviceCode(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/login',
        authStrategy,
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: DeviceCodeRequest = {
        environment: 'production',
      };
      const error = new Error('Device code initiation failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authLoginApi.initiateDeviceCode(params)).rejects.toThrow('Device code initiation failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthLoginApi]'),
        expect.stringContaining('Device code initiation failed'),
      );
    });
  });

  describe('pollDeviceCodeToken', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const params: DeviceCodeTokenRequest = {
        deviceCode: 'device-code-123',
      };
      const mockResponse: DeviceCodeTokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          expiresIn: 3600,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.pollDeviceCodeToken(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/login/device/token',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle response without refreshToken', async () => {
      const params: DeviceCodeTokenRequest = {
        deviceCode: 'device-code-456',
      };
      const mockResponse: DeviceCodeTokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-456',
          expiresIn: 3600,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.pollDeviceCodeToken(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/login/device/token',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: DeviceCodeTokenRequest = {
        deviceCode: 'invalid-code',
      };
      const error = new Error('Token polling failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authLoginApi.pollDeviceCodeToken(params)).rejects.toThrow('Token polling failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthLoginApi]'),
        expect.stringContaining('Token polling failed'),
      );
    });
  });

  describe('refreshDeviceCodeToken', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const params: DeviceCodeRefreshRequest = {
        refreshToken: 'refresh-token-123',
      };
      const mockResponse: DeviceCodeTokenResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token-123',
          refreshToken: 'new-refresh-token-123',
          expiresIn: 3600,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.refreshDeviceCodeToken(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/login/device/refresh',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: DeviceCodeRefreshRequest = {
        refreshToken: 'invalid-refresh-token',
      };
      const error = new Error('Token refresh failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authLoginApi.refreshDeviceCodeToken(params)).rejects.toThrow('Token refresh failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthLoginApi]'),
        expect.stringContaining('Token refresh failed'),
      );
    });
  });

  describe('getLoginDiagnostics', () => {
    it('should call HttpClient.request with environment parameter', async () => {
      const environment = 'production';
      const mockResponse: DiagnosticsResponse = {
        success: true,
        data: {
          database: {
            connected: true,
            latency: 5,
          },
          controller: {
            url: 'https://controller.example.com',
            reachable: true,
          },
          environment: {
            name: 'production',
          },
          keycloak: {
            url: 'https://keycloak.example.com',
            reachable: true,
          },
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.getLoginDiagnostics(environment);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/login/diagnostics',
        undefined,
        { params: { environment } },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request without environment parameter', async () => {
      const mockResponse: DiagnosticsResponse = {
        success: true,
        data: {
          database: {
            connected: true,
            latency: 3,
          },
          controller: {
            url: 'https://controller.example.com',
            reachable: true,
          },
          environment: {
            name: 'development',
          },
          keycloak: {
            url: 'https://keycloak.example.com',
            reachable: true,
          },
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authLoginApi.getLoginDiagnostics();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/login/diagnostics',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Diagnostics fetch failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authLoginApi.getLoginDiagnostics()).rejects.toThrow('Diagnostics fetch failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthLoginApi]'),
        expect.stringContaining('Diagnostics fetch failed'),
      );
    });
  });
});

