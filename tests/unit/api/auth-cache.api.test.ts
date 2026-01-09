/**
 * Unit tests for AuthCacheApi
 */

import { AuthCacheApi } from '../../../src/api/auth-cache.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  CacheStatsResponse,
  CachePerformanceResponse,
  CacheEfficiencyResponse,
  ClearCacheResponse,
  InvalidateCacheRequest,
  InvalidateCacheResponse,
} from '../../../src/api/types/auth.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('AuthCacheApi', () => {
  let authCacheApi: AuthCacheApi;
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
    authCacheApi = new AuthCacheApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('getCacheStats', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: CacheStatsResponse = {
        success: true,
        data: {
          hits: 100,
          misses: 50,
          size: 150,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCacheStats();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/stats',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: CacheStatsResponse = {
        success: true,
        data: {
          hits: 200,
          misses: 100,
          size: 300,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCacheStats(authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/stats',
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
      const mockResponse: CacheStatsResponse = {
        success: true,
        data: {
          hits: 150,
          misses: 75,
          size: 225,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCacheStats(authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/stats',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Network error');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authCacheApi.getCacheStats()).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthCacheApi]'),
        expect.stringContaining('Network error'),
      );
    });
  });

  describe('getCachePerformance', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: CachePerformanceResponse = {
        success: true,
        data: {
          hitRate: 0.85,
          avgResponseTime: 12.5,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCachePerformance();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/performance',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: CachePerformanceResponse = {
        success: true,
        data: {
          hitRate: 0.9,
          avgResponseTime: 10.0,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCachePerformance(authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/performance',
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
      const mockResponse: CachePerformanceResponse = {
        success: true,
        data: {
          hitRate: 0.88,
          avgResponseTime: 11.0,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCachePerformance(authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/performance',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Performance fetch failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authCacheApi.getCachePerformance()).rejects.toThrow('Performance fetch failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthCacheApi]'),
        expect.stringContaining('Performance fetch failed'),
      );
    });
  });

  describe('getCacheEfficiency', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: CacheEfficiencyResponse = {
        success: true,
        data: {
          efficiency: 0.92,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCacheEfficiency();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/efficiency',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: CacheEfficiencyResponse = {
        success: true,
        data: {
          efficiency: 0.95,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCacheEfficiency(authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/efficiency',
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
      const mockResponse: CacheEfficiencyResponse = {
        success: true,
        data: {
          efficiency: 0.93,
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authCacheApi.getCacheEfficiency(authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/auth/cache/efficiency',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Efficiency calculation failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authCacheApi.getCacheEfficiency()).rejects.toThrow('Efficiency calculation failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthCacheApi]'),
        expect.stringContaining('Efficiency calculation failed'),
      );
    });
  });

  describe('clearCache', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: ClearCacheResponse = {
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authCacheApi.clearCache();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/cache/clear',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: ClearCacheResponse = {
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authCacheApi.clearCache(authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/cache/clear',
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
      const mockResponse: ClearCacheResponse = {
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authCacheApi.clearCache(authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/cache/clear',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Clear cache failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authCacheApi.clearCache()).rejects.toThrow('Clear cache failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthCacheApi]'),
        expect.stringContaining('Clear cache failed'),
      );
    });
  });

  describe('invalidateCache', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const params: InvalidateCacheRequest = {
        pattern: 'user:*',
      };
      const mockResponse: InvalidateCacheResponse = {
        success: true,
        message: 'Cache invalidated successfully',
        invalidated: 42,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authCacheApi.invalidateCache(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/cache/invalidate',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request when no authStrategy and no pattern', async () => {
      const params: InvalidateCacheRequest = {};
      const mockResponse: InvalidateCacheResponse = {
        success: true,
        message: 'Cache invalidated successfully',
        invalidated: 0,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authCacheApi.invalidateCache(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/cache/invalidate',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: InvalidateCacheRequest = {
        pattern: 'roles:*',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: InvalidateCacheResponse = {
        success: true,
        message: 'Cache invalidated successfully',
        invalidated: 15,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await authCacheApi.invalidateCache(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/cache/invalidate',
        authStrategy.bearerToken,
        params,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const params: InvalidateCacheRequest = {
        pattern: 'permissions:*',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: InvalidateCacheResponse = {
        success: true,
        message: 'Cache invalidated successfully',
        invalidated: 8,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await authCacheApi.invalidateCache(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/auth/cache/invalidate',
        authStrategy,
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: InvalidateCacheRequest = {
        pattern: 'invalid:*',
      };
      const error = new Error('Invalidate cache failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(authCacheApi.invalidateCache(params)).rejects.toThrow('Invalidate cache failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AuthCacheApi]'),
        expect.stringContaining('Invalidate cache failed'),
      );
    });
  });
});

