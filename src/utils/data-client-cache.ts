/**
 * DataClient cache management utilities
 * Handles cache operations, size enforcement, and metrics tracking
 */

import { CacheEntry, CacheConfig } from "../types/data-client.types";
import { generateCacheKey } from "./data-client-utils";
import { ApiRequestOptions } from "../types/data-client.types";

/**
 * Cache manager interface
 */
export interface CacheManager {
  cache: Map<string, CacheEntry>;
  metrics: {
    cacheHits: number;
    cacheMisses: number;
  };
}

/**
 * Get cached entry if valid
 */
export function getCachedEntry<T>(
  cache: Map<string, CacheEntry>,
  cacheKey: string,
  metrics: { cacheHits: number; cacheMisses: number },
): T | null {
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.cacheHits++;
    return cached.data as T;
  }
  metrics.cacheMisses++;
  return null;
}

/**
 * Set cache entry with TTL and enforce max size
 */
export function setCacheEntry(
  cache: Map<string, CacheEntry>,
  cacheKey: string,
  data: unknown,
  ttl: number,
  maxSize: number,
): void {
  cache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttl * 1000,
    key: cacheKey,
  });

  // Enforce max cache size
  if (cache.size > maxSize) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

/**
 * Check if caching is enabled for request
 */
export function isCacheEnabled(
  method: string,
  cacheConfig: CacheConfig | undefined,
  options?: ApiRequestOptions,
): boolean {
  const isGetRequest = method.toUpperCase() === "GET";
  return (
    (cacheConfig?.enabled !== false) &&
    isGetRequest &&
    (options?.cache?.enabled !== false)
  );
}

/**
 * Generate cache key for request
 */
export function getCacheKeyForRequest(
  endpoint: string,
  options?: ApiRequestOptions,
): string {
  return options?.cache?.key || generateCacheKey(endpoint, options);
}

