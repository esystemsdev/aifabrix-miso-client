/**
 * Role service for user authorization with Redis caching
 */

import { HttpClient } from '../utils/http-client';
import { RedisService } from './redis.service';
import { MisoClientConfig, RoleResult } from '../types/config.types';
import jwt from 'jsonwebtoken';

export class RoleService {
  private httpClient: HttpClient;
  private redis: RedisService;
  private config: MisoClientConfig;
  private roleTTL: number;

  constructor(httpClient: HttpClient, redis: RedisService) {
    this.config = httpClient.config;
    this.redis = redis;
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

      // Check Redis cache first if we have userId
      if (cacheKey && this.redis.isConnected()) {
        const cachedRoles = await this.redis.get(cacheKey);
        if (cachedRoles) {
          try {
            const parsed = JSON.parse(cachedRoles);
            return parsed.roles || [];
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Failed to parse cached roles:', error);
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
      const roleResult = await this.httpClient.authenticatedRequest<RoleResult>(
        'GET',
        '/api/auth/roles', // Backend knows app/env from client token
        token
      );

      const roles = roleResult.roles || [];

      // Cache the result in Redis (use userId-based key)
      const finalCacheKey = `roles:${userId}`;
      if (this.redis.isConnected()) {
        await this.redis.set(
          finalCacheKey,
          JSON.stringify({ roles, timestamp: Date.now() }),
          this.roleTTL
        );
      }

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
      if (this.redis.isConnected()) {
        await this.redis.set(
          cacheKey,
          JSON.stringify({ roles, timestamp: Date.now() }),
          this.roleTTL
        );
      }

      return roles;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh roles:', error);
      return [];
    }
  }
}
