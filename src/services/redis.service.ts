/**
 * Redis service for caching and log queuing
 */

import Redis from 'ioredis';
import { RedisConfig } from '../types/config.types';

export class RedisService {
  private redis?: Redis;
  private config?: RedisConfig;
  private connected = false;

  constructor(config?: RedisConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config) {
      // eslint-disable-next-line no-console
      console.log('Redis not configured, using controller fallback');
      return;
    }

    try {
      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db || 0,
        keyPrefix: this.config.keyPrefix || 'miso:',
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      await this.redis.connect();
      this.connected = true;
      // eslint-disable-next-line no-console
      console.log('Connected to Redis');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to connect to Redis:', error);
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.connected = false;
      // eslint-disable-next-line no-console
      console.log('Disconnected from Redis');
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.redis || !this.connected) {
      return null;
    }

    try {
      return await this.redis.get(key);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl: number): Promise<boolean> {
    if (!this.redis || !this.connected) {
      return false;
    }

    try {
      await this.redis.setex(key, ttl, value);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Redis set error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.redis || !this.connected) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async rpush(queue: string, value: string): Promise<boolean> {
    if (!this.redis || !this.connected) {
      return false;
    }

    try {
      await this.redis.rpush(queue, value);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Redis rpush error:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
