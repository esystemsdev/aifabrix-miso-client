/**
 * MisoClient SDK class - main entry point
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
import { registerLoggerService } from "./services/logger/unified-logger.factory";
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
import type {
  UpdateSelfStatusRequest,
  UpdateSelfStatusResponse,
  ApplicationStatusResponse,
} from "./api/types/applications.types";

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
    if (config.sensitiveFieldsConfig) DataMasker.setConfigPath(config.sensitiveFieldsConfig);

    const internalClient = new InternalHttpClient(config);
    this.redis = new RedisService(config.redis);
    this.logger = new LoggerService(internalClient as unknown as HttpClient, this.redis);
    this.httpClient = new HttpClient(config, this.logger);
    (this.logger as unknown as { httpClient: HttpClient }).httpClient = this.httpClient;
    this.apiClient = new ApiClient(this.httpClient);
    this.logger.setApiClient(this.apiClient);
    registerLoggerService(this.logger);
    this.cacheService = new CacheService(this.redis);
    this.auth = new AuthService(this.httpClient, this.apiClient, this.cacheService);
    this.roles = new RoleService(this.httpClient, this.apiClient, this.cacheService);
    this.permissions = new PermissionService(this.httpClient, this.apiClient, this.cacheService);
    this.tokenValidation = new TokenValidationService(config.keycloak);
    this.encryptionService = new EncryptionService(this.apiClient, this.config.encryptionKey);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.redis.connect();
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getToken(req: { headers: { authorization?: string } }): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    return authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  }

  validateOrigin(req: Request, allowedOrigins?: string[]): OriginValidationResult {
    return validateOriginUtil(req, allowedOrigins ?? this.config.allowedOrigins);
  }

  async getEnvironmentToken(): Promise<string> {
    return this.auth.getEnvironmentToken();
  }

  async login(params: { redirect: string; state?: string }): Promise<import("./types/config.types").LoginResponse> {
    return this.auth.login(params);
  }

  async validateToken(token: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.auth.validateToken(token, authStrategy);
  }

  async getUser(token: string, authStrategy?: AuthStrategy): Promise<UserInfo | null> {
    return this.auth.getUser(token, authStrategy);
  }

  async getUserInfo(token: string, authStrategy?: AuthStrategy): Promise<UserInfo | null> {
    return this.auth.getUserInfo(token, authStrategy);
  }

  async isAuthenticated(token: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.auth.isAuthenticated(token, authStrategy);
  }

  async logout(params: { token: string }): Promise<import("./types/config.types").LogoutResponse> {
    return this.auth.logout(params);
  }

  async refreshToken(refreshToken: string, authStrategy?: AuthStrategy): Promise<import("./types/config.types").RefreshTokenResponse | null> {
    return this.auth.refreshToken(refreshToken, authStrategy);
  }

  async validateTokenLocal(token: string, options?: TokenValidationOptions): Promise<TokenValidationResult> {
    return this.tokenValidation.validateTokenLocal(token, options);
  }

  setKeycloakConfig(config: KeycloakConfig): void {
    this.tokenValidation.setKeycloakConfig(config);
  }

  clearJwksCache(jwksUri?: string): void {
    this.tokenValidation.clearCache(jwksUri);
  }

  clearValidationCache(): void {
    this.tokenValidation.clearResultCache();
  }

  clearAllTokenCaches(): void {
    this.tokenValidation.clearAllCaches();
  }

  async getRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.roles.getRoles(token, authStrategy);
  }

  async hasRole(token: string, role: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.roles.hasRole(token, role, authStrategy);
  }

  async hasAnyRole(token: string, roles: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.roles.hasAnyRole(token, roles, authStrategy);
  }

  async hasAllRoles(token: string, roles: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.roles.hasAllRoles(token, roles, authStrategy);
  }

  async refreshRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.roles.refreshRoles(token, authStrategy);
  }

  async getPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.permissions.getPermissions(token, authStrategy);
  }

  async hasPermission(token: string, permission: string, authStrategy?: AuthStrategy): Promise<boolean> {
    return this.permissions.hasPermission(token, permission, authStrategy);
  }

  async hasAnyPermission(token: string, permissions: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.permissions.hasAnyPermission(token, permissions, authStrategy);
  }

  async hasAllPermissions(token: string, permissions: string[], authStrategy?: AuthStrategy): Promise<boolean> {
    return this.permissions.hasAllPermissions(token, permissions, authStrategy);
  }

  async refreshPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]> {
    return this.permissions.refreshPermissions(token, authStrategy);
  }

  async clearPermissionsCache(token: string, authStrategy?: AuthStrategy): Promise<void> {
    return this.permissions.clearPermissionsCache(token, authStrategy);
  }

  get log(): LoggerService {
    return this.logger;
  }

  get encryption(): EncryptionService {
    return this.encryptionService;
  }

  get cache(): CacheService {
    return this.cacheService;
  }

  async updateMyApplicationStatus(
    body: UpdateSelfStatusRequest,
    options?: { envKey?: string; authStrategy?: AuthStrategy },
  ): Promise<UpdateSelfStatusResponse> {
    const envKey =
      options?.envKey ?? this.logger.getApplicationContextService().getApplicationContext().environment;
    if (!envKey) {
      throw new Error(
        "updateMyApplicationStatus requires envKey or application context (client token/clientId with environment). Neither was available.",
      );
    }
    return this.apiClient.applications.updateSelfStatus(envKey, body, options?.authStrategy);
  }

  async getApplicationStatus(
    envKey: string,
    appKey: string,
    authStrategy?: AuthStrategy,
  ): Promise<ApplicationStatusResponse> {
    return this.apiClient.applications.getApplicationStatus(envKey, appKey, authStrategy);
  }

  async getMyApplicationStatus(
    options?: { envKey?: string; appKey?: string },
    authStrategy?: AuthStrategy,
  ): Promise<ApplicationStatusResponse> {
    const context = this.logger.getApplicationContextService().getApplicationContext();
    const envKey = options?.envKey ?? context.environment;
    const appKey = options?.appKey ?? context.application;
    if (!envKey || !appKey) {
      throw new Error(
        "getMyApplicationStatus requires envKey and appKey or application context (client token/clientId). Neither was fully available.",
      );
    }
    return this.apiClient.applications.getApplicationStatus(envKey, appKey, authStrategy);
  }

  getConfig(): MisoClientConfig {
    return { ...this.config };
  }

  isRedisConnected(): boolean {
    return this.redis.isConnected();
  }

  async requestWithAuthStrategy<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    authStrategy: AuthStrategy,
    data?: unknown,
    config?: import("axios").AxiosRequestConfig,
  ): Promise<T> {
    return this.httpClient.requestWithAuthStrategy<T>(method, url, authStrategy, data, config);
  }

  createAuthStrategy(
    methods: ("bearer" | "client-token" | "client-credentials" | "api-key")[],
    bearerToken?: string,
    apiKey?: string,
  ): AuthStrategy {
    return { methods, bearerToken, apiKey };
  }

  getDefaultAuthStrategy(bearerToken?: string): AuthStrategy {
    return AuthStrategyHandler.getDefaultStrategy(bearerToken);
  }
}
