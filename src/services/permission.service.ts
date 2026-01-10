/**
 * Permission service for user authorization with caching
 */

import { HttpClient } from "../utils/http-client";
import { ApiClient } from "../api";
import { CacheService } from "./cache.service";
import {
  MisoClientConfig,
  AuthStrategy,
  AuthMethod,
} from "../types/config.types";
import jwt from "jsonwebtoken";
import { ApplicationContextService } from "./application-context.service";

interface PermissionCacheData {
  permissions: string[];
  timestamp: number;
}

export class PermissionService {
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private cache: CacheService;
  private config: MisoClientConfig;
  private permissionTTL: number;
  private applicationContextService: ApplicationContextService;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.permissionTTL = this.config.cache?.permissionTTL || 900; // 15 minutes default
    this.applicationContextService = new ApplicationContextService(httpClient);
  }

  /**
   * Extract userId from JWT token without making API call
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded) return null;

      // Try common JWT claim fields for user ID
      return (decoded.sub ||
        decoded.userId ||
        decoded.user_id ||
        decoded.id) as string | null;
    } catch (error) {
      return null;
    }
  }


  /**
   * Get user permissions with caching
   * Optimized to extract userId from token first to check cache before API call
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getPermissions(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<string[]> {
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
        const authStrategyToUse = authStrategy || this.config.authStrategy;
        const authStrategyWithToken: AuthStrategy = authStrategyToUse 
          ? { ...authStrategyToUse, bearerToken: token }
          : { methods: ['bearer'] as AuthMethod[], bearerToken: token };
        
        const userInfo = await this.apiClient.auth.validateToken(
          { token },
          authStrategyWithToken,
        );
        userId = userInfo.data?.user?.id || null;
        if (!userId) {
          return [];
        }
      }

      // Cache miss - fetch from controller using ApiClient
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken = authStrategyToUse 
        ? { ...authStrategyToUse, bearerToken: token }
          : { methods: ['bearer'] as AuthMethod[], bearerToken: token };
      
      // Extract environment from application context service
      const context = this.applicationContextService.getApplicationContext();
      const queryParams = context.environment ? { environment: context.environment } : undefined;
      
      const permissionResult = await this.apiClient.permissions.getPermissions(
        queryParams,
        authStrategyWithToken,
      );

      const permissions = permissionResult.data?.permissions || [];

      // Cache the result (use userId-based key)
      const finalCacheKey = `permissions:${userId}`;
      await this.cache.set<PermissionCacheData>(
        finalCacheKey,
        { permissions, timestamp: Date.now() },
        this.permissionTTL,
      );

      return permissions;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get permissions:", error);
      return [];
    }
  }

  /**
   * Check if user has specific permission
   * @param token - User authentication token
   * @param permission - Permission to check
   * @param authStrategy - Optional authentication strategy override
   */
  async hasPermission(
    token: string,
    permission: string,
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    const permissions = await this.getPermissions(token, authStrategy);
    return permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   * @param token - User authentication token
   * @param permissions - Permissions to check
   * @param authStrategy - Optional authentication strategy override
   */
  async hasAnyPermission(
    token: string,
    permissions: string[],
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    const userPermissions = await this.getPermissions(token, authStrategy);
    return permissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }

  /**
   * Check if user has all of the specified permissions
   * @param token - User authentication token
   * @param permissions - Permissions to check
   * @param authStrategy - Optional authentication strategy override
   */
  async hasAllPermissions(
    token: string,
    permissions: string[],
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    const userPermissions = await this.getPermissions(token, authStrategy);
    return permissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }

  /**
   * Force refresh permissions from controller (bypass cache)
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async refreshPermissions(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<string[]> {
    try {
      // Get user info to extract userId
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken = authStrategyToUse 
        ? { ...authStrategyToUse, bearerToken: token }
          : { methods: ['bearer'] as AuthMethod[], bearerToken: token };
      
      const userInfo = await this.apiClient.auth.validateToken(
        { token },
        authStrategyWithToken,
      );

      if (!userInfo.data?.user?.id) {
        return [];
      }

      const userId = userInfo.data.user.id;
      const cacheKey = `permissions:${userId}`;

      // Extract environment from application context service
      const context = this.applicationContextService.getApplicationContext();
      const queryParams = context.environment ? { environment: context.environment } : undefined;

      // Fetch fresh permissions from controller using refresh endpoint via ApiClient
      const permissionResult = await this.apiClient.permissions.refreshPermissions(
        queryParams,
        authStrategyWithToken,
      );

      const permissions = permissionResult.data?.permissions || [];

      // Update cache with fresh data
      await this.cache.set<PermissionCacheData>(
        cacheKey,
        { permissions, timestamp: Date.now() },
        this.permissionTTL,
      );

      return permissions;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to refresh permissions:", error);
      return [];
    }
  }

  /**
   * Clear cached permissions for a user
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async clearPermissionsCache(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<void> {
    try {
      // Get user info to extract userId
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken = authStrategyToUse 
        ? { ...authStrategyToUse, bearerToken: token }
          : { methods: ['bearer'] as AuthMethod[], bearerToken: token };
      
      const userInfo = await this.apiClient.auth.validateToken(
        { token },
        authStrategyWithToken,
      );

      if (!userInfo.data?.user?.id) {
        return;
      }

      const userId = userInfo.data.user.id;
      const cacheKey = `permissions:${userId}`;

      // Clear from cache
      await this.cache.delete(cacheKey);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to clear permissions cache:", error);
    }
  }
}
