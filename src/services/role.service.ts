/**
 * Role service for completely authorization with caching
 */

import { HttpClient } from '../utils/http-client';
import { CacheService } from './cache.service';
import { MisoClientConfig, RoleResult } from '../types/config.types';
import jwt from 'jsonwebtoken';

interface RoleCacheData {
  roles: string[];
  timestamp: number;
}

export class RoleService {
  private httpClient: HttpClient;
  private cache: CacheService;
  private config: MisoClientConfig;
  private roleTTL: number;

  constructor(httpClient: HttpClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.roleTTL = this.config.cache?.roleTTL || 900; // 15 minutes default
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
   * Get user roles with Redis caching
   * Optimized to extract userId from token first to check cache before API call
   */
  async getRoles(token: string): Promise<string[]> {
    try {
      // Extract userId from token to check cache first (avoids API call on cache hit)
      let userId = this.extractUserIdFromToken(token);
      const cacheKey = userId ? `roles:${userId}` : null;

      // Check cache first if we have userId
      if (cacheKey) {
        const cached = await this.cache.get<RoleCacheData>(cacheKey);
        if (cached) {
          return cached.roles || [];
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
      const roleResult = await this.httpClient.authenticatedRequest<RoleResult>(
        'GET',
        '/api/auth/roles', // Backend knows app/env from client token
        token
      );

      const roles = roleResult.roles || [];

      // Cache the result (use userId-based key)
      const finalCacheKey = `roles:${userId}`;
      await this.cache.set<RoleCacheData>(
        finalCacheKey,
        { roles, timestamp: Date.now() },
        this.roleTTL
      );

      return roles;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to get roles:', error);
      return [];
    }
  }

  /**
   * Check if user has specific role
   */
  async hasRole(token: string, role: string): Promise<boolean> {
    const roles = await this.getRoles(token);
    return roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  async hasAnyRole(token: string, roles: string[]): Promise<boolean> {
    const userRoles = await this.getRoles(token);
    return roles.some((role) => userRoles.includes(role));
  }

  /**
   * Check if user has all of the specified roles
   */
  async hasAllRoles(token: string, roles: string[]): Promise<boolean> {
    const userRoles = await this.getRoles(token);
    return roles.every((role) => userRoles.includes(role));
  }

  /**
   * Force refresh roles from controller (bypass cache)
   */
  async refreshRoles(token: string): Promise<string[]> {
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
      const cacheKey = `roles:${userId}`;

      // Fetch fresh roles from controller using refresh endpoint
      const roleResult = await this.httpClient.authenticatedRequest<RoleResult>(
        'GET',
        '/api/auth/roles/refresh',
        token
      );

      const roles = roleResult.roles || [];

      // Update cache with fresh data
      await this.cache.set<RoleCacheData>(
        cacheKey,
        { roles, timestamp: Date.now() },
        this.roleTTL
      );

      return roles;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh roles:', error);
      return [];
    }
  }
}
