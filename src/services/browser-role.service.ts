/**
 * Browser-compatible role service for user authorization with caching
 * Uses in-memory cache only (no Redis) and browser-compatible JWT decoder
 */

import { HttpClient } from "../utils/http-client";
import { ApiClient } from "../api";
import { CacheService } from "./cache.service";
import {
  MisoClientConfig,
  AuthStrategy,
  AuthMethod,
} from "../types/config.types";
import { decodeJWT } from "../utils/browser-jwt-decoder";
import { extractClientTokenInfo } from "../utils/token-utils";
import { isBrowser, getLocalStorage } from "../utils/data-client-utils";

interface RoleCacheData {
  roles: string[];
  timestamp: number;
}

export class BrowserRoleService {
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private cache: CacheService;
  private config: MisoClientConfig;
  private roleTTL: number;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.roleTTL = this.config.cache?.roleTTL || 900; // 15 minutes default
  }

  /**
   * Extract userId from JWT token without making API call
   * Uses browser-compatible JWT decoder
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = decodeJWT(token);
      if (!decoded) {
        return null;
      }

      // Try common JWT claim fields for user ID
      return (
        (decoded.sub ||
          decoded.userId ||
          decoded.user_id ||
          decoded.id) as string | null
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract environment from client token stored in localStorage
   * Returns null if not available (browser-only)
   */
  private getEnvironmentFromClientToken(): string | null {
    if (!isBrowser()) {
      return null;
    }

    try {
      const clientToken = getLocalStorage("miso:client-token");
      if (!clientToken) {
        console.warn("[BrowserRoleService] No client token found in localStorage");
        return null;
      }

      const tokenInfo = extractClientTokenInfo(clientToken);
      
      // Log token info for debugging
      if (!tokenInfo.environment) {
        console.warn("[BrowserRoleService] No environment in client token. Token info:", tokenInfo);
        console.log("[BrowserRoleService] Available token info fields:", Object.keys(tokenInfo));
      }
      
      return tokenInfo.environment || null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to extract environment from client token:", error);
      return null;
    }
  }

  /**
   * Get user roles with caching
   * Optimized to extract userId from token first to check cache before API call
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getRoles(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<string[]> {
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
      
      // Log warning if environment is missing (required by controller)
      if (!environment) {
        // eslint-disable-next-line no-console
        console.warn(
          "[BrowserRoleService] Environment not found in client token. " +
          "Roles API requires environment parameter. " +
          "This may cause a 400 Bad Request error."
        );
      }
      
      const queryParams = environment ? { environment } : undefined;
      
      const roleResult = await this.apiClient.roles.getRoles(
        queryParams,
        authStrategyWithToken,
      );

      const roles = roleResult.data?.roles || [];

      // Cache the result (use userId-based key)
      const finalCacheKey = `roles:${userId}`;
      await this.cache.set<RoleCacheData>(
        finalCacheKey,
        { roles, timestamp: Date.now() },
        this.roleTTL,
      );

      return roles;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get roles:", error);
      return [];
    }
  }

  /**
   * Check if user has specific role
   * @param token - User authentication token
   * @param role - Role to check
   * @param authStrategy - Optional authentication strategy override
   */
  async hasRole(
    token: string,
    role: string,
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    const roles = await this.getRoles(token, authStrategy);
    return roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   * @param token - User authentication token
   * @param roles - Roles to check
   * @param authStrategy - Optional authentication strategy override
   */
  async hasAnyRole(
    token: string,
    roles: string[],
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    const userRoles = await this.getRoles(token, authStrategy);
    return roles.some((role) => userRoles.includes(role));
  }

  /**
   * Check if user has all of the specified roles
   * @param token - User authentication token
   * @param roles - Roles to check
   * @param authStrategy - Optional authentication strategy override
   */
  async hasAllRoles(
    token: string,
    roles: string[],
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    const userRoles = await this.getRoles(token, authStrategy);
    return roles.every((role) => userRoles.includes(role));
  }

  /**
   * Force refresh roles from controller (bypass cache)
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async refreshRoles(
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
      const cacheKey = `roles:${userId}`;

      // Extract environment from client token for query parameter
      const environment = this.getEnvironmentFromClientToken();
      const queryParams = environment ? { environment } : undefined;

      // Fetch fresh roles from controller using refresh endpoint via ApiClient
      const roleResult = await this.apiClient.roles.refreshRoles(
        queryParams,
        authStrategyWithToken,
      );

      const roles = roleResult.data?.roles || [];

      // Update cache with fresh data
      await this.cache.set<RoleCacheData>(
        cacheKey,
        { roles, timestamp: Date.now() },
        this.roleTTL,
      );

      return roles;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to refresh roles:", error);
      return [];
    }
  }

  /**
   * Clear cached roles for a user
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async clearRolesCache(
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
      const cacheKey = `roles:${userId}`;

      // Clear from cache
      await this.cache.delete(cacheKey);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to clear roles cache:", error);
    }
  }
}

