/**
 * Unit tests for RolesApi
 */

import { RolesApi } from '../../../src/api/roles.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  GetRolesQueryParams,
  GetRolesResponse,
  RefreshRolesResponse,
} from '../../../src/api/types/roles.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('RolesApi', () => {
  let rolesApi: RolesApi;
  let mockHttpClient: jest.Mocked<HttpClient>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
    mockHttpClient = {
      authenticatedRequest: jest.fn(),
      requestWithAuthStrategy: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    rolesApi = new RolesApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('getRoles', () => {
    it('should call HttpClient.authenticatedRequest with correct parameters', async () => {
      const params: GetRolesQueryParams = {
        environment: 'dev',
        application: 'test-app',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
        bearerToken: 'test-token',
      };
      const mockResponse: GetRolesResponse = {
        success: true,
        data: {
          roles: ['admin', 'user'],
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await rolesApi.getRoles(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/roles',
        authStrategy.bearerToken,
        undefined,
        { params },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle requestWithAuthStrategy when no bearerToken', async () => {
      const params: GetRolesQueryParams = {
        environment: 'dev',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: GetRolesResponse = {
        success: true,
        data: {
          roles: ['admin'],
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await rolesApi.getRoles(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/roles',
        authStrategy,
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error if no authStrategy provided', async () => {
      await expect(rolesApi.getRoles()).rejects.toThrow(
        'getRoles requires authentication - provide authStrategy with bearerToken',
      );
    });

    it('should handle errors', async () => {
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
        bearerToken: 'test-token',
      };
      const error = new Error('Network error');

      mockHttpClient.authenticatedRequest.mockRejectedValue(error);

      await expect(rolesApi.getRoles(undefined, authStrategy)).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[RolesApi]'),
        expect.stringContaining('Network error'),
      );
    });
  });

  describe('refreshRoles', () => {
    it('should call HttpClient.authenticatedRequest with correct parameters', async () => {
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
        bearerToken: 'test-token',
      };
      const mockResponse: RefreshRolesResponse = {
        success: true,
        data: {
          roles: ['admin', 'user', 'moderator'],
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await rolesApi.refreshRoles(undefined, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/roles/refresh',
        authStrategy.bearerToken,
        undefined,
        { params: undefined },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error if no authStrategy provided', async () => {
      await expect(rolesApi.refreshRoles()).rejects.toThrow(
        'refreshRoles requires authentication - provide authStrategy with bearerToken',
      );
    });
  });
});

