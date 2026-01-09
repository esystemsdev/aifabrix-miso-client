/**
 * Role service for completely authorization with caching
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

interface RoleCacheData {
  roles: string[];
  timestamp: number;
}

export class RoleService {
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
   * Get user roles with Redis caching
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
}
