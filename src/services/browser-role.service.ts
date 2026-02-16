/**
 * Browser-compatible role service for user authorization with caching
 * Uses in-memory cache only (no Redis) and browser-compatible JWT decoder
 */

import { HttpClient } from "../utils/http-client";
import { ApiClient } from "../api";
import { CacheService } from "./cache.service";
import {
  AuthStrategy,
  AuthMethod,
} from "../types/config.types";
import { decodeJWT } from "../utils/browser-jwt-decoder";
import { ApplicationContextService } from "./application-context.service";
import { extractErrorInfo } from "../utils/error-extractor";
import { logErrorWithContext } from "../utils/console-logger";

interface RoleCacheData {
  roles: string[];
  timestamp: number;
}

export class BrowserRoleService {
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private cache: CacheService;
  private roleTTL: number;
  private applicationContextService: ApplicationContextService;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.roleTTL = this.httpClient.config.cache?.roleTTL || 900; // 15 minutes default
    this.applicationContextService = new ApplicationContextService(httpClient);
  }

  private logRoleError(
    error: unknown,
    token: string,
    operation: string,
    method: string,
    path: string,
  ): void {
    const errorInfo = extractErrorInfo(error, {
      endpoint: path,
      method,
      correlationId: (error as { correlationId?: string })?.correlationId,
    });
    errorInfo.message = `Failed to ${operation}: ${errorInfo.message}`;
    logErrorWithContext(errorInfo, "[BrowserRoleService]");
  }

  /**
   * Extract userId from JWT token without verification.
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

  private buildAuthStrategyWithToken(
    token: string,
    authStrategy?: AuthStrategy,
  ): AuthStrategy {
    const base = authStrategy || this.httpClient.config.authStrategy;
    return base ? { ...base, bearerToken: token } : { methods: ['bearer'] as AuthMethod[], bearerToken: token };
  }

  private async resolveUserId(token: string, authStrategy?: AuthStrategy): Promise<string | null> {
    const userInfo = await this.apiClient.auth.validateToken(
      { token },
      this.buildAuthStrategyWithToken(token, authStrategy),
    );
    return userInfo.data?.user?.id || null;
  }

  private getRolesQueryParams(): { environment: string } | undefined {
    const context = this.applicationContextService.getApplicationContext();
    return context.environment ? { environment: context.environment } : undefined;
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
      let userId = this.extractUserIdFromToken(token);
      const cacheKey = userId ? `roles:${userId}` : null;

      if (cacheKey) {
        const cached = await this.cache.get<RoleCacheData>(cacheKey);
        if (cached) return cached.roles || [];
      }

      if (!userId) {
        userId = await this.resolveUserId(token, authStrategy);
        if (!userId) return [];
      }

      const authStrategyWithToken = this.buildAuthStrategyWithToken(token, authStrategy);
      const queryParams = this.getRolesQueryParams();
      const roleResult = await this.apiClient.roles.getRoles(
        queryParams,
        authStrategyWithToken,
      );
      const roles = roleResult.data?.roles || [];

      await this.cache.set<RoleCacheData>(
        `roles:${userId}`,
        { roles, timestamp: Date.now() },
        this.roleTTL,
      );

      return roles;
    } catch (error) {
      this.logRoleError(error, token, "getRoles", "GET", "/api/auth/roles");
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
      const userId = await this.resolveUserId(token, authStrategy);
      if (!userId) return [];

      const authStrategyWithToken = this.buildAuthStrategyWithToken(token, authStrategy);
      const queryParams = this.getRolesQueryParams();
      const roleResult = await this.apiClient.roles.refreshRoles(
        queryParams,
        authStrategyWithToken,
      );
      const roles = roleResult.data?.roles || [];

      await this.cache.set<RoleCacheData>(
        `roles:${userId}`,
        { roles, timestamp: Date.now() },
        this.roleTTL,
      );
      return roles;
    } catch (error) {
      this.logRoleError(error, token, "refreshRoles", "POST", "/api/auth/roles/refresh");
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
      const userId = await this.resolveUserId(token, authStrategy);
      if (!userId) return;

      await this.cache.delete(`roles:${userId}`);
    } catch (error) {
      this.logRoleError(error, token, "clearRolesCache", "DELETE", "/cache/roles");
    }
  }
}

