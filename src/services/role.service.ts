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
import { extractUserIdFromToken } from "../utils/browser-jwt-decoder";
import { ApplicationContextService } from "./application-context.service";

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
  private applicationContextService: ApplicationContextService;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.roleTTL = this.config.cache?.roleTTL || 900; // 15 minutes default
    this.applicationContextService = new ApplicationContextService(httpClient);
  }

  /** Build auth strategy with bearer token */
  private buildAuthStrategy(token: string, authStrategy?: AuthStrategy): AuthStrategy {
    const base = authStrategy || this.config.authStrategy;
    return base ? { ...base, bearerToken: token } : { methods: ['bearer'] as AuthMethod[], bearerToken: token };
  }

  /** Get environment query params from application context */
  private getEnvironmentParams(): { environment: string } | undefined {
    const context = this.applicationContextService.getApplicationContext();
    return context.environment ? { environment: context.environment } : undefined;
  }

  /** Get userId from token, validating via API if not in JWT */
  private async resolveUserId(token: string, authStrategy?: AuthStrategy): Promise<string | null> {
    const userId = extractUserIdFromToken(token);
    if (userId) return userId;
    const authStrategyWithToken = this.buildAuthStrategy(token, authStrategy);
    const userInfo = await this.apiClient.auth.validateToken({ token }, authStrategyWithToken);
    return userInfo.data?.user?.id || null;
  }

  /**
   * Get user roles with Redis caching
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    try {
      let userId = extractUserIdFromToken(token);
      const cacheKey = userId ? `roles:${userId}` : null;

      // Check cache first
      if (cacheKey) {
        const cached = await this.cache.get<RoleCacheData>(cacheKey);
        if (cached) return cached.roles || [];
      }

      // Resolve userId if not in token
      if (!userId) {
        userId = await this.resolveUserId(token, authStrategy);
        if (!userId) return [];
      }

      // Fetch from controller
      const roles = await this.fetchRolesFromController(token, authStrategy);

      // Cache result
      await this.cache.set<RoleCacheData>(`roles:${userId}`, { roles, timestamp: Date.now() }, this.roleTTL);
      return roles;
    } catch (error) {
      console.error("Failed to get roles:", error); // eslint-disable-line no-console
      return [];
    }
  }

  /** Fetch roles from controller API */
  private async fetchRolesFromController(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    const authStrategyWithToken = this.buildAuthStrategy(token, authStrategy);
    const queryParams = this.getEnvironmentParams();
    const roleResult = await this.apiClient.roles.getRoles(queryParams, authStrategyWithToken);
    return roleResult.data?.roles || [];
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
  async refreshRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    try {
      const authStrategyWithToken = this.buildAuthStrategy(token, authStrategy);
      const userInfo = await this.apiClient.auth.validateToken({ token }, authStrategyWithToken);
      const userId = userInfo.data?.user?.id;
      if (!userId) return [];

      // Fetch fresh roles
      const queryParams = this.getEnvironmentParams();
      const roleResult = await this.apiClient.roles.refreshRoles(queryParams, authStrategyWithToken);
      const roles = roleResult.data?.roles || [];

      // Update cache
      await this.cache.set<RoleCacheData>(`roles:${userId}`, { roles, timestamp: Date.now() }, this.roleTTL);
      return roles;
    } catch (error) {
      console.error("Failed to refresh roles:", error); // eslint-disable-line no-console
      return [];
    }
  }
}
