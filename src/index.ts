/**
 * Main MisoClient SDK class
 */

import { AuthService } from "./services/auth.service";
import { RoleService } from "./services/role.service";
import { PermissionService } from "./services/permission.service";
import { LoggerService } from "./services/logger";
import { RedisService } from "./services/redis.service";
import { CacheService } from "./services/cache.service";
import { HttpClient } from "./utils/http-client";
import { InternalHttpClient } from "./utils/internal-http-client";
import { ApiClient } from "./api";
import { DataMasker } from "./utils/data-masker";
import { AuthStrategyHandler } from "./utils/auth-strategy";
import { MisoClientConfig, UserInfo, AuthStrategy } from "./types/config.types";
import { validateOrigin as validateOriginUtil, OriginValidationResult } from "./utils/origin-validator";
import { Request } from "express";
import { TokenValidationService } from "./services/token-validation.service";
import { EncryptionService } from "./services/encryption.service";
import {
  TokenValidationOptions,
  TokenValidationResult,
  KeycloakConfig,
} from "./types/token-validation.types";

export class MisoClient {
  private config: MisoClientConfig;
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private redis: RedisService;
  private auth: AuthService;
  private roles: RoleService;
  private permissions: PermissionService;
  private logger: LoggerService;
  private cacheService: CacheService;
  private tokenValidation: TokenValidationService;
  private encryptionService: EncryptionService;
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

    // Create ApiClient that wraps HttpClient (provides typed API interfaces)
    this.apiClient = new ApiClient(this.httpClient);

    // Set ApiClient in LoggerService (resolves circular dependency)
    this.logger.setApiClient(this.apiClient);

    // Register LoggerService for unified logging interface
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerLoggerService } = require("./services/logger/unified-logger.factory");
    registerLoggerService(this.logger);

    // Initialize cache service with Redis support (used by auth, roles and permissions)
    this.cacheService = new CacheService(this.redis);

    // Create services (pass both httpClient and apiClient for gradual migration)
    this.auth = new AuthService(this.httpClient, this.apiClient, this.cacheService);

    // Initialize services that use cache
    this.roles = new RoleService(this.httpClient, this.apiClient, this.cacheService);
    this.permissions = new PermissionService(
      this.httpClient,
      this.apiClient,
      this.cacheService,
    );

    // Initialize token validation service
    this.tokenValidation = new TokenValidationService(config.keycloak);

    // Initialize encryption service with encryption key from config
    this.encryptionService = new EncryptionService(this.apiClient, this.config.encryptionKey);
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
   * Validate request origin against configured allowed origins
   * Uses allowedOrigins from client configuration if not provided
   * 
   * @param req - Express Request object
   * @param allowedOrigins - Optional array of allowed origins (defaults to config.allowedOrigins)
   * @returns Validation result with valid flag and optional error message
   */
  validateOrigin(req: Request, allowedOrigins?: string[]): OriginValidationResult {
    const origins = allowedOrigins ?? this.config.allowedOrigins;
    return validateOriginUtil(req, origins);
  }

  /** Get environment token using client credentials */
  async getEnvironmentToken(): Promise<string> {
    return this.auth.getEnvironmentToken();
  }

  /** Initiate login flow - returns login URL for browser redirect */
  async login(params: { redirect: string; state?: string }): Promise<import("./types/config.types").LoginResponse> {
    return this.auth.login(params);
  }

  /** Validate token with controller */
  async validateToken(token: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.auth.validateToken(token, authStrategy);
  }

  /** Get user information from token */
  async getUser(token: string, authStrategy?: AuthStrategy): Promise<UserInfo | null> {
    return this.auth.getUser(token, authStrategy);
  }

  /** Get user information from GET /api/v1/auth/user endpoint */
  async getUserInfo(token: string, authStrategy?: AuthStrategy): Promise<UserInfo | null> {
    return this.auth.getUserInfo(token, authStrategy);
  }

  /** Check if user is authenticated */
  async isAuthenticated(token: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.auth.isAuthenticated(token, authStrategy);
  }

  /** Logout user */
  async logout(params: { token: string }): Promise<import("./types/config.types").LogoutResponse> {
    return this.auth.logout(params);
  }

  /** Refresh user access token using refresh token */
  async refreshToken(refreshToken: string, authStrategy?: AuthStrategy): Promise<import("./types/config.types").RefreshTokenResponse | null> {
    return this.auth.refreshToken(refreshToken, authStrategy);
  }

  /** Validate token locally using JWKS (no API call) */
  async validateTokenLocal(token: string, options?: TokenValidationOptions): Promise<TokenValidationResult> {
    return this.tokenValidation.validateTokenLocal(token, options);
  }

  /** Set or update Keycloak configuration for local validation */
  setKeycloakConfig(config: KeycloakConfig): void {
    this.tokenValidation.setKeycloakConfig(config);
  }

  /** Clear JWKS cache */
  clearJwksCache(jwksUri?: string): void {
    this.tokenValidation.clearCache(jwksUri);
  }

  /** Clear validation result cache */
  clearValidationCache(): void {
    this.tokenValidation.clearResultCache();
  }

  /** Clear all token validation caches (JWKS + results) */
  clearAllTokenCaches(): void {
    this.tokenValidation.clearAllCaches();
  }

  // ==================== ROLE METHODS ====================

  /** Get user roles (cached if Redis available) */
  async getRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.roles.getRoles(token, authStrategy);
  }

  /** Check if user has specific role */
  async hasRole(token: string, role: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.roles.hasRole(token, role, authStrategy);
  }

  /** Check if user has any of the specified roles */
  async hasAnyRole(token: string, roles: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.roles.hasAnyRole(token, roles, authStrategy);
  }

  /** Check if user has all of the specified roles */
  async hasAllRoles(token: string, roles: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.roles.hasAllRoles(token, roles, authStrategy);
  }

  /** Force refresh roles from controller (bypass cache) */
  async refreshRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.roles.refreshRoles(token, authStrategy);
  }

  // ==================== PERMISSION METHODS ====================

  /** Get user permissions (cached if Redis available) */
  async getPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.permissions.getPermissions(token, authStrategy);
  }

  /** Check if user has specific permission */
  async hasPermission(token: string, permission: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.permissions.hasPermission(token, permission, authStrategy);
  }

  /** Check if user has any of the specified permissions */
  async hasAnyPermission(token: string, permissions: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.permissions.hasAnyPermission(token, permissions, authStrategy);
  }

  /** Check if user has all of the specified permissions */
  async hasAllPermissions(token: string, permissions: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.permissions.hasAllPermissions(token, permissions, authStrategy);
  }

  /** Force refresh permissions from controller (bypass cache) */
  async refreshPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.permissions.refreshPermissions(token, authStrategy);
  }

  /** Clear cached permissions for a user */
  async clearPermissionsCache(token: string, authStrategy?: AuthStrategy): Promise<void> {
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

  /**
   * Get encryption service for security parameter management
   * Provides encrypt/decrypt methods that call the controller
   */
  get encryption(): EncryptionService {
    return this.encryptionService;
  }

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

  /** Check if Redis is connected */
  isRedisConnected(): boolean {
    return this.redis.isConnected();
  }

  /** Make request with authentication strategy */
  async requestWithAuthStrategy<T>(method: "GET" | "POST" | "PUT" | "DELETE", url: string, authStrategy: AuthStrategy, data?: unknown, config?: import("axios").AxiosRequestConfig): Promise<T> {
    return this.httpClient.requestWithAuthStrategy<T>(method, url, authStrategy, data, config);
  }

  /** Create authentication strategy helper */
  createAuthStrategy(methods: ("bearer" | "client-token" | "client-credentials" | "api-key")[], bearerToken?: string, apiKey?: string): AuthStrategy {
    return { methods, bearerToken, apiKey };
  }

  /** Get default authentication strategy */
  getDefaultAuthStrategy(bearerToken?: string): AuthStrategy {
    return AuthStrategyHandler.getDefaultStrategy(bearerToken);
  }
}

// Export types
export * from "./types/config.types";

// Export pagination, filter, sort types
export * from "./types/pagination.types";
export * from "./types/filter.types";
export * from "./types/filter-schema.types";
export * from "./types/sort.types";

// Export error types (use explicit exports to avoid conflict with config.types ErrorResponse)
export type {
  ErrorResponse as ErrorResponseFromErrors,
  ErrorEnvelope,
} from "./types/errors.types";

// Export services for advanced usage
export { AuthService } from "./services/auth.service";
export { RoleService } from "./services/role.service";
export { PermissionService } from "./services/permission.service";
export { BrowserPermissionService } from "./services/browser-permission.service";
export { BrowserRoleService } from "./services/browser-role.service";
export { LoggerService } from "./services/logger";
export { RedisService } from "./services/redis.service";
export { CacheService } from "./services/cache.service";
export { HttpClient } from "./utils/http-client";

// Export unified logging interface
export {
  getLogger,
  setLoggerContext,
  clearLoggerContext,
  mergeLoggerContext,
} from "./services/logger/unified-logger.factory";
export type {
  UnifiedLogger,
} from "./services/logger/unified-logger.service";
export type { LoggerContext } from "./services/logger/logger-context-storage";

// Export utilities
export { loadConfig } from "./utils/config-loader";
export { validateOrigin } from "./utils/origin-validator";
export { getEnvironmentToken } from "./utils/environment-token";
export { extractClientTokenInfo } from "./utils/token-utils";
export type { ClientTokenInfo } from "./utils/token-utils";
export type { OriginValidationResult } from "./utils/origin-validator";
export { resolveControllerUrl, resolveKeycloakUrl, isBrowser, validateUrl } from "./utils/controller-url-resolver";
export { extractLoggingContext } from "./utils/logging-helpers";
export type { IndexedLoggingContext, HasKey, HasExternalSystem } from "./utils/logging-helpers";
export { extractRequestContext } from "./utils/request-context";
export type { RequestContext } from "./utils/request-context";

// Export pagination, filter, sort utilities
export * from "./utils/pagination.utils";
export * from "./utils/filter.utils";
export * from "./utils/filter-schema.utils";
export * from "./utils/sort.utils";

// Export error classes and utilities
export {
  MisoClientError,
  ApiErrorException,
  transformError,
  handleApiError,
} from "./utils/errors";

// Export encryption service and types
export { EncryptionService } from "./services/encryption.service";
export type { EncryptResult } from "./services/encryption.service";
export { EncryptionError } from "./utils/encryption-error";
export type { EncryptionErrorCode } from "./utils/encryption-error";
export type {
  EncryptRequest,
  EncryptResponse,
  DecryptRequest,
  DecryptResponse,
  EncryptionStorage,
} from "./api/types/encryption.types";

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
  createClientTokenEndpoint,
  hasConfig,
  loggerContextMiddleware,
} from "./express";
export type {
  ClientTokenEndpointOptions,
  ClientTokenResponse,
  DataClientConfigResponse,
} from "./express";

// Export Express ErrorResponse with alias to avoid conflict with SDK ErrorResponse
export { ErrorResponse as ExpressErrorResponse } from "./express/error-response";

// Export DataClient browser wrapper
export { DataClient, dataClient } from "./utils/data-client";
export type {
  DataClientConfig,
  ApiRequestOptions,
  InterceptorConfig,
  RequestMetrics,
  AuditConfig as DataClientAuditConfig,
  CacheEntry,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  ApiError as DataClientApiError,
} from "./types/data-client.types";

// Export DataClient auto-initialization helper
export { autoInitializeDataClient, getCachedDataClientConfig } from "./utils/data-client-auto-init";
export type { AutoInitOptions } from "./utils/data-client-auto-init";

// Token validation types (v3.4.0+)
export type {
  TokenType,
  TokenValidationOptions,
  TokenValidationResult,
  TokenPayload,
  KeycloakConfig,
  DelegatedProviderConfig,
  DelegatedProviderLookup,
} from "./types/token-validation.types";

// Token validation service (for advanced usage)
export { TokenValidationService } from "./services/token-validation.service";
