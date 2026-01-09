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
import { extractClientTokenInfo } from "../utils/token-utils";

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

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
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
      return (decoded.sub ||
        decoded.userId ||
        decoded.user_id ||
        decoded.id) as string | null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract environment from client token (server-side)
   * Gets the client token from HttpClient's internal state or config
   */
  private getEnvironmentFromClientToken(): string | null {
    try {
      // Try to get client token from config first (if provided)
      if (this.config.clientToken) {
        const tokenInfo = extractClientTokenInfo(this.config.clientToken);
        if (tokenInfo.environment) {
          return tokenInfo.environment;
        }
      }
      
      // Try to access from internal client (private property access)
      // This is a workaround since clientToken is private in InternalHttpClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalClient = (this.httpClient as any).internalClient;
      if (internalClient) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clientToken = (internalClient as any).clientToken;
        if (clientToken && typeof clientToken === 'string') {
          const tokenInfo = extractClientTokenInfo(clientToken);
          return tokenInfo.environment || null;
        }
      }
      
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to extract environment from client token:", error);
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
      
      // Extract environment from client token for query parameter
      const environment = this.getEnvironmentFromClientToken();
      const queryParams = environment ? { environment } : undefined;
      
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

      // Extract environment from client token for query parameter
      const environment = this.getEnvironmentFromClientToken();
      const queryParams = environment ? { environment } : undefined;

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
