/**
 * Role service for user authorization with Redis caching
 */

import { HttpClient } from '../utils/http-client';
import { RedisService } from './redis.service';
import { MisoClientConfig, RoleResult } from '../types/config.types';

export class RoleService {
  private httpClient: HttpClient;
  private redis: RedisService;
  private config: MisoClientConfig;
  private roleTTL: number;

  constructor(config: MisoClientConfig, redis: RedisService) {
    this.config = config;
    this.redis = redis;
    this.httpClient = new HttpClient(config);
    this.roleTTL = config.cache?.roleTTL || 900; // 15 minutes default
  }

  /**
   * Get user roles with Redis caching
   */
  async getRoles(token: string): Promise<string[]> {
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
      const cacheKey = `roles:${userId}:${this.config.environment}:${this.config.applicationKey}`;

      // Check Redis cache first
      if (this.redis.isConnected()) {
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

      // Cache miss - fetch from controller
      const roleResult = await this.httpClient.authenticatedRequest<RoleResult>(
        'GET',
        '/auth/roles',
        token
      );

      const roles = roleResult.roles || [];

      // Cache the result in Redis
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
        '/auth/validate',
        token
      );

      if (!userInfo.user?.id) {
        return [];
      }

      const userId = userInfo.user.id;
      const cacheKey = `roles:${userId}:${this.config.environment}:${this.config.applicationKey}`;

      // Fetch fresh roles from controller
      const roleResult = await this.httpClient.authenticatedRequest<RoleResult>(
        'GET',
        '/auth/roles',
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
