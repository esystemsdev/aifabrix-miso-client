/**
 * Unit tests for PermissionsApi
 */

import { PermissionsApi } from '../../../src/api/permissions.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  GetPermissionsQueryParams,
  GetPermissionsResponse,
  RefreshPermissionsResponse,
} from '../../../src/api/types/permissions.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('PermissionsApi', () => {
  let permissionsApi: PermissionsApi;
  let mockHttpClient: jest.Mocked<HttpClient>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
    mockHttpClient = {
      authenticatedRequest: jest.fn(),
      requestWithAuthStrategy: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    permissionsApi = new PermissionsApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('getPermissions', () => {
    it('should call HttpClient.authenticatedRequest with correct parameters', async () => {
      const params: GetPermissionsQueryParams = {
        environment: 'dev',
        application: 'test-app',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: GetPermissionsResponse = {
        success: true,
        data: {
          permissions: ['read', 'write'],
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await permissionsApi.getPermissions(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/permissions',
        authStrategy.bearerToken,
        undefined,
        { params },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle requestWithAuthStrategy when no bearerToken', async () => {
      const params: GetPermissionsQueryParams = {
        environment: 'dev',
      };
      const authStrategy: AuthStrategy = {
        environment: 'dev',
      };
      const mockResponse: GetPermissionsResponse = {
        success: true,
        data: {
          permissions: ['read'],
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await permissionsApi.getPermissions(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/permissions',
        authStrategy,
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error if no authStrategy provided', async () => {
      await expect(permissionsApi.getPermissions()).rejects.toThrow(
        'getPermissions requires authentication - provide authStrategy with bearerToken',
      );
    });

    it('should handle errors', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const error = new Error('Network error');

      mockHttpClient.authenticatedRequest.mockRejectedValue(error);

      await expect(permissionsApi.getPermissions(undefined, authStrategy)).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalledWith('Get permissions API call failed:', error);
    });
  });

  describe('refreshPermissions', () => {
    it('should call HttpClient.authenticatedRequest with correct parameters', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: RefreshPermissionsResponse = {
        success: true,
        data: {
          permissions: ['read', 'write', 'delete'],
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await permissionsApi.refreshPermissions(authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/permissions/refresh',
        authStrategy.bearerToken,
        undefined,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error if no authStrategy provided', async () => {
      await expect(permissionsApi.refreshPermissions()).rejects.toThrow(
        'refreshPermissions requires authentication - provide authStrategy with bearerToken',
      );
    });
  });
});

