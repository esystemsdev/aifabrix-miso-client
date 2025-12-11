/**
 * Main MisoClient SDK class
 */

import { AuthService } from "./services/auth.service";
import { RoleService } from "./services/role.service";
import { PermissionService } from "./services/permission.service";
import { LoggerService } from "./services/logger.service";
import { RedisService } from "./services/redis.service";
import { CacheService } from "./services/cache.service";
import { HttpClient } from "./utils/http-client";
import { InternalHttpClient } from "./utils/internal-http-client";
import { DataMasker } from "./utils/data-masker";
import { AuthStrategyHandler } from "./utils/auth-strategy";
import { MisoClientConfig, UserInfo, AuthStrategy } from "./types/config.types";

export class MisoClient {
  private config: MisoClientConfig;
  private httpClient: HttpClient;
  private redis: RedisService;
  private auth: AuthService;
  private roles: RoleService;
  private permissions: PermissionService;
  private logger: LoggerService;
  private cacheService: CacheService;
  private initialized = false;

  constructor(config: MisoClientConfig) {
    this.config = config;

    // Initialize DataMasker with custom config path if provided
    if (config.sensitiveFieldsConfig) {
      DataMasker.setConfigPath(config.sensitiveFieldsConfig);
    }

    // Create InternalHttpClient first (base HTTP functionality)
    const internalClient = new InternalHttpClient(config);

    // Create Redis service
    this.redis = new RedisService(config.redis);

    // Create LoggerService with InternalHttpClient first (needs httpClient.request() and httpClient.config)
    // InternalHttpClient has these methods, so we can use it directly
    // Type assertion needed because InternalHttpClient has compatible interface with HttpClient
    this.logger = new LoggerService(
      internalClient as unknown as HttpClient,
      this.redis,
    );

    // Create public HttpClient that wraps InternalHttpClient with logger
    this.httpClient = new HttpClient(config, this.logger);

    // Update LoggerService to use the new public HttpClient (for logging)
    // Type assertion needed because httpClient property is private in LoggerService but needs to be updated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.logger as any).httpClient = this.httpClient;

    // Create services
    this.auth = new AuthService(this.httpClient, this.redis);

    // Initialize cache service with Redis support (used by roles and permissions)
    this.cacheService = new CacheService(this.redis);

    // Initialize services that use cache
    this.roles = new RoleService(this.httpClient, this.cacheService);
    this.permissions = new PermissionService(
      this.httpClient,
      this.cacheService,
    );
  }

  /**
   * Initialize the client (connect to Redis if configured)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.redis.connect();
      this.initialized = true;
    } catch (error) {
      // Redis connection failed, continue with controller fallback mode
      this.initialized = true; // Still mark as initialized for fallback mode
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    this.initialized = false;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ==================== AUTHENTICATION METHODS ====================

  /**
   * Extract Bearer token from request headers
   * Supports common request object patterns (Express, Fastify, Next.js)
   */
  getToken(req: { headers: { authorization?: string } }): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return null;
    }

    // Support "Bearer <token>" format
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // If no Bearer prefix, assume the whole header is the token
    return authHeader;
  }

  /**
   * Get environment token using client credentials
   * This is called automatically by HttpClient but can be called manually
   */
  async getEnvironmentToken(): Promise<string> {
    return this.auth.getEnvironmentToken();
  }

  /**
   * Initiate login flow by calling controller
   * Returns the login URL and state for browser redirect or manual navigation
   * @param params - Login parameters
   * @param params.redirect - Required callback URL where Keycloak redirects after authentication
   * @param params.state - Optional CSRF protection token (auto-generated if omitted)
   * @returns Login response with loginUrl and state
   */
  async login(params: {
    redirect: string;
    state?: string;
  }): Promise<import("./types/config.types").LoginResponse> {
    return this.auth.login(params);
  }

  /**
   * Validate token with controller
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async validateToken(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    return this.auth.validateToken(token, authStrategy);
  }

  /**
   * Get user information from token
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getUser(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<UserInfo | null> {
    return this.auth.getUser(token, authStrategy);
  }

  /**
   * Get user information from GET /api/v1/auth/user endpoint
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getUserInfo(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<UserInfo | null> {
    return this.auth.getUserInfo(token, authStrategy);
  }

  /**
   * Check if user is authenticated
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async isAuthenticated(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    return this.auth.isAuthenticated(token, authStrategy);
  }

  /**
   * Logout user
   * @param params - Logout parameters
   * @param params.token - Access token to invalidate
   * @returns Logout response with success message
   */
  async logout(params: {
    token: string;
  }): Promise<import("./types/config.types").LogoutResponse> {
    return this.auth.logout(params);
  }

  // ==================== AUTHORIZATION METHODS ====================

  /**
   * Get user roles (cached in Redis if available)
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getRoles(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<string[]> {
    return this.roles.getRoles(token, authStrategy);
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
    return this.roles.hasRole(token, role, authStrategy);
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
    return this.roles.hasAnyRole(token, roles, authStrategy);
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
    return this.roles.hasAllRoles(token, roles, authStrategy);
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
    return this.roles.refreshRoles(token, authStrategy);
  }

  /**
   * Get user permissions (cached in Redis if available)
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getPermissions(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<string[]> {
    return this.permissions.getPermissions(token, authStrategy);
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
    return this.permissions.hasPermission(token, permission, authStrategy);
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
    return this.permissions.hasAnyPermission(token, permissions, authStrategy);
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
    return this.permissions.hasAllPermissions(token, permissions, authStrategy);
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
    return this.permissions.refreshPermissions(token, authStrategy);
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
    return this.permissions.clearPermissionsCache(token, authStrategy);
  }

  // ==================== LOGGING METHODS ====================

  /**
   * Get logger service for application logging
   */
  get log(): LoggerService {
    return this.logger;
  }

  // ==================== ENCRYPTION METHODS ====================
  // Note: EncryptionUtil is now available as a static class from the express module
  // Use: import { EncryptionUtil } from '@aifabrix/miso-client'

  // ==================== CACHE METHODS ====================

  /**
   * Get cache service for generic caching
   */
  get cache(): CacheService {
    return this.cacheService;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get current configuration
   */
  getConfig(): MisoClientConfig {
    return { ...this.config };
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.redis.isConnected();
  }

  /**
   * Make request with authentication strategy
   * Tries authentication methods in priority order based on strategy
   * @param method - HTTP method
   * @param url - Request URL
   * @param authStrategy - Authentication strategy configuration
   * @param data - Optional request data
   * @param config - Optional Axios request config
   * @returns Response data
   */
  async requestWithAuthStrategy<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    authStrategy: AuthStrategy,
    data?: unknown,
    config?: import("axios").AxiosRequestConfig,
  ): Promise<T> {
    return this.httpClient.requestWithAuthStrategy<T>(
      method,
      url,
      authStrategy,
      data,
      config,
    );
  }

  /**
   * Create authentication strategy helper
   * @param methods - Array of authentication methods in priority order
   * @param bearerToken - Optional bearer token
   * @param apiKey - Optional API key
   * @returns Authentication strategy
   */
  createAuthStrategy(
    methods: ("bearer" | "client-token" | "client-credentials" | "api-key")[],
    bearerToken?: string,
    apiKey?: string,
  ): AuthStrategy {
    return {
      methods,
      bearerToken,
      apiKey,
    };
  }

  /**
   * Get default authentication strategy
   * Uses bearer token and client token in that order
   * @param bearerToken - Optional bearer token
   * @returns Default authentication strategy
   */
  getDefaultAuthStrategy(bearerToken?: string): AuthStrategy {
    return AuthStrategyHandler.getDefaultStrategy(bearerToken);
  }
}

// Export types
export * from "./types/config.types";

// Export pagination, filter, sort types
export * from "./types/pagination.types";
export * from "./types/filter.types";
export * from "./types/sort.types";

// Export error types (use explicit exports to avoid conflict with config.types ErrorResponse)
export type {
  ErrorResponse as ErrorResponseFromErrors,
  ErrorEnvelope,
} from "./types/errors.types";

// Export services for advanced usage
export { AuthService } from "./services/auth.service";
export { RoleService } from "./services/role.service";
export { LoggerService } from "./services/logger.service";
export { RedisService } from "./services/redis.service";
export { CacheService } from "./services/cache.service";
export { HttpClient } from "./utils/http-client";

// Export utilities
export { loadConfig } from "./utils/config-loader";

// Export pagination, filter, sort utilities
export * from "./utils/pagination.utils";
export * from "./utils/filter.utils";
export * from "./utils/sort.utils";

// Export error classes and utilities
export {
  MisoClientError,
  ApiErrorException,
  transformError,
  handleApiError,
} from "./utils/errors";

// Express utilities (v2.1.0+)
// Export everything except ErrorResponse to avoid conflict with config.types ErrorResponse
export {
  ResponseHelper,
  PaginationMeta,
  injectResponseHelpers,
  asyncHandler,
  asyncHandlerNamed,
  ValidationHelper,
  AppError,
  ApiError,
  ValidationError,
  ApiResponse,
  createSuccessResponse,
  createErrorResponse,
  ErrorLogger,
  setErrorLogger,
  handleRouteError,
  RBACErrorExtensions,
  getErrorTypeUri,
  getErrorTitle,
  sendErrorResponse,
  EncryptionUtil,
} from "./express";

// Export Express ErrorResponse with alias to avoid conflict with SDK ErrorResponse
export { ErrorResponse as ExpressErrorResponse } from "./express/error-response";
