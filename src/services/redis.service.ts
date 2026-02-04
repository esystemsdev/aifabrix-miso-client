/**
 * Redis service for caching and log queuing
 */

import Redis from "ioredis";
import { RedisConfig } from "../types/config.types";

export class RedisService {
  private redis?: Redis;
  private config?: RedisConfig;
  private connected = false;

  constructor(config?: RedisConfig) {
    this.config = config;
  }

  /**
   * Connect to Redis if configured.
   */
  async connect(): Promise<void> {
    if (!this.config) {
      // Redis not configured - silently use controller fallback
      return;
    }

    try {
      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db || 0,
        keyPrefix: this.config.keyPrefix || "miso:",
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: false, // Disable ready check to avoid this.info error
        disableClientInfo: true, // Disable client info for Redis < 7.2 compatibility
      });

      await this.redis.connect();
      this.connected = true;
      // Connection successful - no need to log in production
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to connect to Redis:", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from Redis.
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.connected = false;
      // Disconnection successful - no need to log in production
    }
  }

  /**
   * Get a cached value by key.
   * @param key - Cache key.
   * @returns Cached value or null.
   */
  async get(key: string): Promise<string | null> {
    if (!this.redis || !this.connected) {
      return null;
    }

    try {
      return await this.redis.get(key);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Redis get error:", {
        key,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Set a cached value with TTL.
   * @param key - Cache key.
   * @param value - Serialized value.
   * @param ttl - Time-to-live in seconds.
   * @returns True if set succeeded.
   */
  async set(key: string, value: string, ttl: number): Promise<boolean> {
    if (!this.redis || !this.connected) {
      return false;
    }

    try {
      await this.redis.setex(key, ttl, value);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Redis set error:", {
        key,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete a cached value.
   * @param key - Cache key.
   * @returns True if delete succeeded.
   */
  async delete(key: string): Promise<boolean> {
    if (!this.redis || !this.connected) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Redis delete error:", {
        key,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Push a value onto a Redis list.
   * @param queue - Queue/list name.
   * @param value - Serialized value.
   * @returns True if push succeeded.
   */
  async rpush(queue: string, value: string): Promise<boolean> {
    if (!this.redis || !this.connected) {
      return false;
    }

    try {
      await this.redis.rpush(queue, value);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Redis rpush error:", {
        queue,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
