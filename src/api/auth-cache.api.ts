/**
 * Auth Cache API client
 * Handles cache statistics and management
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  CacheStatsResponse,
  CachePerformanceResponse,
  CacheEfficiencyResponse,
  ClearCacheResponse,
  InvalidateCacheRequest,
  InvalidateCacheResponse,
} from './types/auth.types';
import { extractErrorInfo } from '../utils/error-extractor';
import { logErrorWithContext } from '../utils/console-logger';

/**
 * Auth Cache API class
 * Handles cache-related endpoints
 */
export class AuthCacheApi {
  // Centralize endpoint URLs as constants
  private static readonly CACHE_STATS_ENDPOINT = '/api/v1/auth/cache/stats';
  private static readonly CACHE_PERFORMANCE_ENDPOINT = '/api/v1/auth/cache/performance';
  private static readonly CACHE_EFFICIENCY_ENDPOINT = '/api/v1/auth/cache/efficiency';
  private static readonly CACHE_CLEAR_ENDPOINT = '/api/v1/auth/cache/clear';
  private static readonly CACHE_INVALIDATE_ENDPOINT = '/api/v1/auth/cache/invalidate';

  constructor(private httpClient: HttpClient) {}

  /**
   * Get cache statistics
   * @param authStrategy - Optional authentication strategy override
   * @returns Cache stats response with hits, misses, and size
   */
  async getCacheStats(
    authStrategy?: AuthStrategy,
  ): Promise<CacheStatsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<CacheStatsResponse>(
          'GET',
          AuthCacheApi.CACHE_STATS_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<CacheStatsResponse>(
          'GET',
          AuthCacheApi.CACHE_STATS_ENDPOINT,
          authStrategy,
        );
      }
      return await this.httpClient.request<CacheStatsResponse>(
        'GET',
        AuthCacheApi.CACHE_STATS_ENDPOINT,
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: AuthCacheApi.CACHE_STATS_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[AuthCacheApi]');
      throw error;
    }
  }

  /**
   * Get cache performance metrics
   * @param authStrategy - Optional authentication strategy override
   * @returns Cache performance response with hitRate and avgResponseTime
   */
  async getCachePerformance(
    authStrategy?: AuthStrategy,
  ): Promise<CachePerformanceResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<CachePerformanceResponse>(
          'GET',
          AuthCacheApi.CACHE_PERFORMANCE_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<CachePerformanceResponse>(
          'GET',
          AuthCacheApi.CACHE_PERFORMANCE_ENDPOINT,
          authStrategy,
        );
      }
      return await this.httpClient.request<CachePerformanceResponse>(
        'GET',
        AuthCacheApi.CACHE_PERFORMANCE_ENDPOINT,
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: AuthCacheApi.CACHE_PERFORMANCE_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[AuthCacheApi]');
      throw error;
    }
  }

  /**
   * Get cache efficiency metrics
   * @param authStrategy - Optional authentication strategy override
   * @returns Cache efficiency response with efficiency score
   */
  async getCacheEfficiency(
    authStrategy?: AuthStrategy,
  ): Promise<CacheEfficiencyResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<CacheEfficiencyResponse>(
          'GET',
          AuthCacheApi.CACHE_EFFICIENCY_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<CacheEfficiencyResponse>(
          'GET',
          AuthCacheApi.CACHE_EFFICIENCY_ENDPOINT,
          authStrategy,
        );
      }
      return await this.httpClient.request<CacheEfficiencyResponse>(
        'GET',
        AuthCacheApi.CACHE_EFFICIENCY_ENDPOINT,
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: AuthCacheApi.CACHE_EFFICIENCY_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[AuthCacheApi]');
      throw error;
    }
  }

  /**
   * Clear authentication cache
   * @param authStrategy - Optional authentication strategy override
   * @returns Clear cache response with success message
   */
  async clearCache(
    authStrategy?: AuthStrategy,
  ): Promise<ClearCacheResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<ClearCacheResponse>(
          'POST',
          AuthCacheApi.CACHE_CLEAR_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<ClearCacheResponse>(
          'POST',
          AuthCacheApi.CACHE_CLEAR_ENDPOINT,
          authStrategy,
        );
      }
      return await this.httpClient.request<ClearCacheResponse>(
        'POST',
        AuthCacheApi.CACHE_CLEAR_ENDPOINT,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthCacheApi.CACHE_CLEAR_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthCacheApi]');
      throw error;
    }
  }

  /**
   * Invalidate cache entries by pattern
   * @param params - Invalidate cache request parameters
   * @param authStrategy - Optional authentication strategy override
   * @returns Invalidate cache response with number of invalidated entries
   */
  async invalidateCache(
    params: InvalidateCacheRequest,
    authStrategy?: AuthStrategy,
  ): Promise<InvalidateCacheResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<InvalidateCacheResponse>(
          'POST',
          AuthCacheApi.CACHE_INVALIDATE_ENDPOINT,
          authStrategy.bearerToken,
          params,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<InvalidateCacheResponse>(
          'POST',
          AuthCacheApi.CACHE_INVALIDATE_ENDPOINT,
          authStrategy,
          params,
        );
      }
      return await this.httpClient.request<InvalidateCacheResponse>(
        'POST',
        AuthCacheApi.CACHE_INVALIDATE_ENDPOINT,
        params,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthCacheApi.CACHE_INVALIDATE_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthCacheApi]');
      throw error;
    }
  }
}

