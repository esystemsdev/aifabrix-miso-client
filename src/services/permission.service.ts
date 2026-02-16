/**
 * Permission service for user authorization with caching
 */

import { HttpClient } from "../utils/http-client";
import { ApiClient } from "../api";
import { CacheService } from "./cache.service";
import {
  AuthStrategy,
  AuthMethod,
} from "../types/config.types";
import { extractUserIdFromToken } from "../utils/browser-jwt-decoder";
import { ApplicationContextService } from "./application-context.service";
import { extractErrorInfo } from "../utils/error-extractor";
import { logErrorWithContext } from "../utils/console-logger";

interface PermissionCacheData {
  permissions: string[];
  timestamp: number;
}

export class PermissionService {
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

  /**
   * Build auth strategy with bearer token.
   */
  private buildAuthStrategy(token: string, authStrategy?: AuthStrategy): AuthStrategy {
    const base = authStrategy || this.httpClient.config.authStrategy;
    return base ? { ...base, bearerToken: token } : { methods: ['bearer'] as AuthMethod[], bearerToken: token };
  }

  /**
   * Get environment query params from application context.
   */
  private getEnvironmentParams(): { environment: string } | undefined {
    const context = this.applicationContextService.getApplicationContext();
    return context.environment ? { environment: context.environment } : undefined;
  }

  /**
   * Get userId from token, validating via API if not in JWT.
   */
  private async resolveUserId(token: string, authStrategy?: AuthStrategy): Promise<string | null> {
    const userId = extractUserIdFromToken(token);
    if (userId) return userId;
    const authStrategyWithToken = this.buildAuthStrategy(token, authStrategy);
    const userInfo = await this.apiClient.auth.validateToken({ token }, authStrategyWithToken);
    return userInfo.data?.user?.id || null;
  }

  /**
   * Get user permissions with caching
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    try {
      let userId = extractUserIdFromToken(token);
      const cacheKey = userId ? `permissions:${userId}` : null;

      // Check cache first
      if (cacheKey) {
        const cached = await this.cache.get<PermissionCacheData>(cacheKey);
        if (cached) return cached.permissions || [];
      }

      // Resolve userId if not in token
      if (!userId) {
        userId = await this.resolveUserId(token, authStrategy);
        if (!userId) return [];
      }

      // Fetch from controller
      const permissions = await this.fetchPermissionsFromController(token, authStrategy);

      // Cache result
      await this.cache.set<PermissionCacheData>(`permissions:${userId}`, { permissions, timestamp: Date.now() }, this.permissionTTL);
      return permissions;
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/auth/permissions",
        method: "GET",
        correlationId: (error as { correlationId?: string })?.correlationId,
      });
      errorInfo.message = `Failed to get permissions: ${errorInfo.message}`;
      logErrorWithContext(errorInfo, "[PermissionService]");
      return [];
    }
  }

  /**
   * Fetch permissions from controller API.
   */
  private async fetchPermissionsFromController(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    const authStrategyWithToken = this.buildAuthStrategy(token, authStrategy);
    const queryParams = this.getEnvironmentParams();
    const permissionResult = await this.apiClient.permissions.getPermissions(queryParams, authStrategyWithToken);
    return permissionResult.data?.permissions || [];
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
  async refreshPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    try {
      const authStrategyWithToken = this.buildAuthStrategy(token, authStrategy);
      const userInfo = await this.apiClient.auth.validateToken({ token }, authStrategyWithToken);
      const userId = userInfo.data?.user?.id;
      if (!userId) return [];

      // Fetch fresh permissions
      const queryParams = this.getEnvironmentParams();
      const permissionResult = await this.apiClient.permissions.refreshPermissions(queryParams, authStrategyWithToken);
      const permissions = permissionResult.data?.permissions || [];

      // Update cache
      await this.cache.set<PermissionCacheData>(`permissions:${userId}`, { permissions, timestamp: Date.now() }, this.permissionTTL);
      return permissions;
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/auth/permissions/refresh",
        method: "POST",
        correlationId: (error as { correlationId?: string })?.correlationId,
      });
      errorInfo.message = `Failed to refresh permissions: ${errorInfo.message}`;
      logErrorWithContext(errorInfo, "[PermissionService]");
      return [];
    }
  }

  /**
   * Clear cached permissions for a user
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async clearPermissionsCache(token: string, authStrategy?: AuthStrategy): Promise<void> {
    try {
      const authStrategyWithToken = this.buildAuthStrategy(token, authStrategy);
      const userInfo = await this.apiClient.auth.validateToken({ token }, authStrategyWithToken);
      const userId = userInfo.data?.user?.id;
      if (!userId) return;
      await this.cache.delete(`permissions:${userId}`);
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/cache/permissions",
        method: "DELETE",
        correlationId: (error as { correlationId?: string })?.correlationId,
      });
      errorInfo.message = `Failed to clear permissions cache: ${errorInfo.message}`;
      logErrorWithContext(errorInfo, "[PermissionService]");
    }
  }
}
