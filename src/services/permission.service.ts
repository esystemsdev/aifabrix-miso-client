/**
 * Permission service for user authorization with Redis caching
 */

import { HttpClient } from '../utils/http-client';
import { RedisService } from './redis.service';
import { MisoClientConfig, PermissionResult } from '../types/config.types';

export class PermissionService {
  private httpClient: HttpClient;
  private redis: RedisService;
  private config: MisoClientConfig;
  private permissionTTL: number;

  constructor(config: MisoClientConfig, redis: RedisService) {
    this.config = config;
    this.redis = redis;
    this.httpClient = new HttpClient(config);
    this.permissionTTL = config.cache?.permissionTTL || 900; // 15 minutes default
  }

  /**
   * Get user permissions with Redis caching
   */
  async getPermissions(token: string): Promise<string[]> {
    try {
      // First get user info to extract userId
      const userInfo = await this.httpClient.authenticatedRequest<{ user: { id: string } }>(
        'POST',
        '/auth/validate',
        token
      );

      if (!userInfo.user?.id) {
        return [];
      }

      const userId = userInfo.user.id;
      const cacheKey = `permissions:${userId}:${this.config.environment}:${this.config.applicationKey}`;

      // Check Redis cache first
      if (this.redis.isConnected()) {
        const cachedPermissions = await this.redis.get(cacheKey);
        if (cachedPermissions) {
          try {
            const parsed = JSON.parse(cachedPermissions);
            return parsed.permissions || [];
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Failed to parse cached permissions:', error);
          }
        }
      }

      // Cache miss - fetch from controller
      const permissionResult = await this.httpClient.authenticatedRequest<PermissionResult>(
        'GET',
        '/auth/permissions',
        token
      );

      const permissions = permissionResult.permissions || [];

      // Cache the result in Redis
      if (this.redis.isConnected()) {
        await this.redis.set(
          cacheKey,
          JSON.stringify({ permissions, timestamp: Date.now() }),
          this.permissionTTL
        );
      }

      return permissions;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to get permissions:', error);
      return [];
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(token: string, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(token);
    return permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(token: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(token);
    return permissions.some((permission) => userPermissions.includes(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(token: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(token);
    return permissions.every((permission) => userPermissions.includes(permission));
  }

  /**
   * Force refresh permissions from controller (bypass cache)
   */
  async refreshPermissions(token: string): Promise<string[]> {
    try {
      // Get user info to extract userId
      const userInfo = await this.httpClient.authenticatedRequest<{ user: { id: string } }>(
        'POST',
        '/auth/validate',
        token
      );

      if (!userInfo.user?.id) {
        return [];
      }

      const userId = userInfo.user.id;
      const cacheKey = `permissions:${userId}:${this.config.environment}:${this.config.applicationKey}`;

      // Fetch fresh permissions from controller
      const permissionResult = await this.httpClient.authenticatedRequest<PermissionResult>(
        'GET',
        '/auth/permissions',
        token
      );

      const permissions = permissionResult.permissions || [];

      // Update cache with fresh data
      if (this.redis.isConnected()) {
        await this.redis.set(
          cacheKey,
          JSON.stringify({ permissions, timestamp: Date.now() }),
          this.permissionTTL
        );
      }

      return permissions;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh permissions:', error);
      return [];
    }
  }

  /**
   * Clear cached permissions for a user
   */
  async clearPermissionsCache(token: string): Promise<void> {
    try {
      // Get user info to extract userId
      const userInfo = await this.httpClient.authenticatedRequest<{ user: { id: string } }>(
        'POST',
        '/auth/validate',
        token
      );

      if (!userInfo.user?.id) {
        return;
      }

      const userId = userInfo.user.id;
      const cacheKey = `permissions:${userId}:${this.config.environment}:${this.config.applicationKey}`;

      // Clear from Redis cache
      if (this.redis.isConnected()) {
        await this.redis.delete(cacheKey);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to clear permissions cache:', error);
    }
  }
}
