/**
 * Browser-compatible permission service for user authorization with caching
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

interface PermissionCacheData {
  permissions: string[];
  timestamp: number;
}

export class BrowserPermissionService {
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private cache: CacheService;
  private permissionTTL: number;
  private applicationContextService: ApplicationContextService;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.permissionTTL = this.httpClient.config.cache?.permissionTTL || 900; // 15 minutes default
    this.applicationContextService = new ApplicationContextService(httpClient);
  }

  private logPermissionError(
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
    logErrorWithContext(errorInfo, "[BrowserPermissionService]");
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

  private getPermissionsQueryParams(): { environment: string } | undefined {
    const context = this.applicationContextService.getApplicationContext();
    return context.environment ? { environment: context.environment } : undefined;
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
      let userId = this.extractUserIdFromToken(token);
      const cacheKey = userId ? `permissions:${userId}` : null;

      if (cacheKey) {
        const cached = await this.cache.get<PermissionCacheData>(cacheKey);
        if (cached) return cached.permissions || [];
      }

      if (!userId) {
        userId = await this.resolveUserId(token, authStrategy);
        if (!userId) return [];
      }

      const authStrategyWithToken = this.buildAuthStrategyWithToken(token, authStrategy);
      const queryParams = this.getPermissionsQueryParams();
      const permissionResult = await this.apiClient.permissions.getPermissions(
        queryParams,
        authStrategyWithToken,
      );
      const permissions = permissionResult.data?.permissions || [];

      await this.cache.set<PermissionCacheData>(
        `permissions:${userId}`,
        { permissions, timestamp: Date.now() },
        this.permissionTTL,
      );
      return permissions;
    } catch (error) {
      this.logPermissionError(error, token, "getPermissions", "GET", "/api/auth/permissions");
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
      const authStrategyToUse = authStrategy || this.httpClient.config.authStrategy;
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
      this.logPermissionError(error, token, "refreshPermissions", "POST", "/api/auth/permissions/refresh");
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
      const userId = await this.resolveUserId(token, authStrategy);
      if (!userId) return;

      await this.cache.delete(`permissions:${userId}`);
    } catch (error) {
      this.logPermissionError(error, token, "clearPermissionsCache", "DELETE", "/cache/permissions");
    }
  }
}

