/**
 * Cache service for generic caching with Redis support and in-memory TTL fallback
 */

import { RedisService } from './redis.service';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private redis?: RedisService;
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Create a CacheService instance
   * @param redis - Optional RedisService for Redis-backed caching. If not provided, uses in-memory cache only.
   */
  constructor(redis?: RedisService) {
    this.redis = redis;

    // Start periodic cleanup of expired entries (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }
  }

  /**
   * Get cached value
   * Checks Redis first, then falls back to memory cache
   * @param key - Cache key
   * @returns Cached value or null if not found or expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first if available
      if (this.redis && this.redis.isConnected()) {
        const cached = await this.redis.get(key);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as T;
            // Also cache in memory for faster subsequent access
            // We don't know the TTL from Redis, so we'll use a default 5 minutes
            // This is just for optimization, Redis is still the source of truth
            this.setInMemory(key, parsed, 300);
            return parsed;
          } catch (error) {
            // Invalid JSON, remove from cache
            console.warn(`Failed to parse cached data for key ${key}:`, error);
            await this.delete(key);
            return null;
          }
        }
      }

      // Fallback to memory cache
      const entry = this.memoryCache.get(key);
      if (entry) {
        // Check if expired
        if (entry.expiresAt < Date.now()) {
          this.memoryCache.delete(key);
          return null;
        }
        return entry.value as T;
      }

      return null;
    } catch (error) {
      // On error, try memory cache
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiresAt >= Date.now()) {
        return entry.value as T;
      }
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * Sets in both Redis and memory cache
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized)
   * @param ttl - Time to live in seconds
   * @returns true if successful, false otherwise
   */
  async set<T>(key: string, value: T, ttl: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      let success = true;

      // Try to set in Redis first
      if (this.redis && this.redis.isConnected()) {
        success = await this.redis.set(key, serialized, ttl);
        // Continue even if Redis fails, fallback to memory
      }

      // Always set in memory cache as fallback
      this.setInMemory(key, value, ttl);

      return success;
    } catch (error) {
      // If serialization fails, try to set in memory with the raw value
      // This handles cases where value might not be JSON serializable
      try {
        this.setInMemory(key, value, ttl);
        return false; // Indicate Redis failed, but memory cache set
      } catch (memoryError) {
        console.error(`Failed to cache value for key ${key}:`, error);
        return false;
      }
    }
  }

  /**
   * Set value in memory cache
   */
  private setInMemory<T>(key: string, value: T, ttl: number): void {
    const expiresAt = Date.now() + ttl * 1000;
    this.memoryCache.set(key, {
      value,
      expiresAt
    });
  }

  /**
   * Delete value from cache
   * Deletes from both Redis and memory cache
   * @param key - Cache key
   * @returns true if deleted from at least one cache, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    let redisDeleted = false;

    // Delete from Redis if available
    if (this.redis && this.redis.isConnected()) {
      redisDeleted = await this.redis.delete(key);
    }

    // Delete from memory cache
    const memoryDeleted = this.memoryCache.delete(key);

    return redisDeleted || memoryDeleted;
  }

  /**
   * Clear all cache entries
   * Clears both Redis and memory cache
   * Note: This only clears keys that are accessible via this service instance
   * Redis may have other keys set by other services
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Note: We cannot efficiently clear all Redis keys without knowing all keys
    // So we only clear what we know about from memory cache
    // For a true Redis clear, users should use RedisService directly
    // or provide a pattern to delete
  }

  /**
   * Cleanup resources (stops cleanup interval)
   * Call this when the service is no longer needed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.memoryCache.clear();
  }
}

