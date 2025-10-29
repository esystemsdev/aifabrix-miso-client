/**
 * Permission service for user authorization with Redis caching
 */

import { HttpClient } from '../utils/http-client';
import { RedisService } from './redis.service';
import { MisoClientConfig, PermissionResult } from '../types/config.types';
import jwt from 'jsonwebtoken';

export class PermissionService {
  private httpClient: HttpClient;
  private redis: RedisService;
  private config: MisoClientConfig;
  private permissionTTL: number;

  constructor(httpClient: HttpClient, redis: RedisService) {
    this.config = httpClient.config;
    this.redis = redis;
    this.httpClient = httpClient;
    this.permissionTTL = this.config.cache?.permissionTTL || 900; // 15 minutes default
  }

  /**
   * Extract userId from JWT token without making API call
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded) return null;
      
      // Try common JWT claim fields for user ID
      return (decoded.sub || decoded.userId || decoded.user_id || decoded.id) as string | null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user permissions with Redis caching
   * Optimized to extract userId from token first to check cache before API call
   */
  async getPermissions(token: string): Promise<string[]> {
    try {
      // Extract userId from token to check cache first (avoids API call on cache hit)
      let userId = this.extractUserIdFromToken(token);
      const cacheKey = userId ? `permissions:${userId}` : null;

      // Check Redis cache first if we have userId
      if (cacheKey && this.redis.isConnected()) {
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

      // Cache miss or no userId in token - fetch from controller
      // If we don't have userId, get it from validate endpoint
      if (!userId) {
        const userInfo = await this.httpClient.authenticatedRequest<{ user: { id: string } }>(
          'POST',
          '/api/auth/validate',
          token
        );
        userId = userInfo.user?.id || null;
        if (!userId) {
          return [];
        }
      }

      // Cache miss - fetch from controller
      const permissionResult = await this.httpClient.authenticatedRequest<PermissionResult>(
        'GET',
        '/api/auth/permissions', // Backend knows app/env from client token
        token
      );

      const permissions = permissionResult.permissions || [];

      // Cache the result in Redis (use userId-based key)
      const finalCacheKey = `permissions:${userId}`;
      if (this.redis.isConnected()) {
        await this.redis.set(
          finalCacheKey,
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
        '/api/auth/validate',
        token
      );

      if (!userInfo.user?.id) {
        return [];
      }

      const userId = userInfo.user.id;
      const cacheKey = `permissions:${userId}`;

      // Fetch fresh permissions from controller using refresh endpoint
      const permissionResult = await this.httpClient.authenticatedRequest<PermissionResult>(
        'GET',
        '/api/auth/permissions/refresh',
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
        '/api/auth/validate',
        token
      );

      if (!userInfo.user?.id) {
        return;
      }

      const userId = userInfo.user.id;
      const cacheKey = `permissions:${userId}`;

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
