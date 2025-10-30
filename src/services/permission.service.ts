/**
 * Permission service for user authorization with caching
 */

import { HttpClient } from '../utils/http-client';
import { CacheService } from './cache.service';
import { MisoClientConfig, PermissionResult } from '../types/config.types';
import jwt from 'jsonwebtoken';

interface PermissionCacheData {
  permissions: string[];
  timestamp: number;
}

export class PermissionService {
  private httpClient: HttpClient;
  private cache: CacheService;
  private config: MisoClientConfig;
  private permissionTTL: number;

  constructor(httpClient: HttpClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
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
   * Get user permissions with caching
   * Optimized to extract userId from token first to check cache before API call
   */
  async getPermissions(token: string): Promise<string[]> {
    try {
      // Extract userId from token to check cache first (avoids API call on cache hit)
      let userId = this.extractUserIdFromToken(token);
      const cacheKey = userId ? `permissions:${userId}` : null;

      // Check cache first if we have userId
      if (cacheKey) {
        const cached = await this.cache.get<PermissionCacheData>(cacheKey);
        if (cached) {
          return cached.permissions || [];
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

      // Cache the result (use userId-based key)
      const finalCacheKey = `permissions:${userId}`;
      await this.cache.set<PermissionCacheData>(
        finalCacheKey,
        { permissions, timestamp: Date.now() },
        this.permissionTTL
      );

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
      await this.cache.set<PermissionCacheData>(
        cacheKey,
        { permissions, timestamp: Date.now() },
        this.permissionTTL
      );

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

      // Clear from cache
      await this.cache.delete(cacheKey);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to clear permissions cache:', error);
    }
  }
}
