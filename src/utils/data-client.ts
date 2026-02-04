/**
 * DataClient - Browser-compatible HTTP client wrapper around MisoClient
 * Provides enhanced HTTP capabilities with ISO 27001 compliance, caching, retry, and more
 */

import { MisoClient } from "../index";
import {
  DataClientConfig,
  ApiRequestOptions,
  InterceptorConfig,
  RequestMetrics,
  CacheEntry,
  AuditConfig,
} from "../types/data-client.types";
import { DataMasker } from "./data-masker";
import { ClientTokenInfo } from "./token-utils";
import { isBrowser } from "./data-client-utils";
import { getCachedEntry, isCacheEnabled, getCacheKeyForRequest } from "./data-client-cache";
import { executeHttpRequest } from "./data-client-request";
import {
  getToken,
  hasClientToken,
  hasAnyToken,
  getClientToken,
  getControllerUrl,
  logout,
  getEnvironmentToken,
  getClientTokenInfo,
  handleOAuthCallback,
} from "./data-client-auth";
import { redirectToLogin as redirectToLoginAuth } from "./data-client-redirect";
import {
  createDefaultConfig,
  createMisoConfigWithRefresh,
  initializeBrowserServices,
  warnIfClientSecretInBrowser,
} from "./data-client-init";
import * as permissionHelpers from "./data-client-permissions";
import * as roleHelpers from "./data-client-roles";
import { BrowserPermissionService } from "../services/browser-permission.service";
import { BrowserRoleService } from "../services/browser-role.service";
import { UserInfo } from "../types/config.types";

export class DataClient {
  private config: DataClientConfig;
  private misoClient: MisoClient | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<unknown>> = new Map();
  private failedRequests: Map<string, { timestamp: number; error: Error; count: number }> = new Map();
  private interceptors: InterceptorConfig = {};
  private metrics = {
    totalRequests: 0,
    totalFailures: 0,
    responseTimes: [] as number[],
    cacheHits: 0,
    cacheMisses: 0,
  };
  private permissionService: BrowserPermissionService | null = null;
  private roleService: BrowserRoleService | null = null;

  constructor(config: DataClientConfig) {
    this.config = createDefaultConfig(config);
    warnIfClientSecretInBrowser(this.config);

    // Initialize MisoClient if config provided
    const misoConfigWithRefresh = createMisoConfigWithRefresh(
      this.config,
      () => this.getEnvironmentToken(),
    );
    if (misoConfigWithRefresh) {
      this.misoClient = new MisoClient(misoConfigWithRefresh);
    }

    // Initialize DataMasker with config path if provided
    if (this.config.misoConfig?.sensitiveFieldsConfig) {
      DataMasker.setConfigPath(this.config.misoConfig.sensitiveFieldsConfig);
    }

    // Initialize browser services
    const services = initializeBrowserServices(this.misoClient, misoConfigWithRefresh);
    this.permissionService = services.permissionService;
    this.roleService = services.roleService;

    // Auto-handle OAuth callback on initialization (browser only)
    if (isBrowser()) {
      this.handleOAuthCallback();
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private getToken(): string | null {
    return getToken(this.config.tokenKeys);
  }

  private hasClientToken(): boolean {
    return hasClientToken(this.misoClient, this.config.misoConfig);
  }

  private hasAnyToken(): boolean {
    return hasAnyToken(this.config.tokenKeys, this.misoClient, this.config.misoConfig);
  }

  private async getClientToken(): Promise<string | null> {
    return getClientToken(this.config.misoConfig, this.config.baseUrl, () => this.getEnvironmentToken());
  }

  private getControllerUrl(): string | null {
    return getControllerUrl(this.config.misoConfig);
  }

  // ==================== PUBLIC AUTH METHODS ====================

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  handleOAuthCallback(): string | null {
    return handleOAuthCallback(this.config);
  }

  async redirectToLogin(redirectUrl?: string): Promise<void> {
    return redirectToLoginAuth(this.config, () => this.getClientToken(), redirectUrl);
  }

  async logout(redirectUrl?: string): Promise<void> {
    return logout(
      this.config,
      () => this.getToken(),
      () => this.getClientToken(),
      () => this.clearCache(),
      redirectUrl,
      this.misoClient,
    );
  }

  // ==================== CONFIGURATION ====================

  setInterceptors(config: InterceptorConfig): void {
    this.interceptors = { ...this.interceptors, ...config };
  }

  setAuditConfig(config: Partial<AuditConfig>): void {
    this.config.audit = { ...this.config.audit, ...config } as AuditConfig;
  }

  setLogLevel(level: "debug" | "info" | "warn" | "error"): void {
    if (this.misoClient && this.config.misoConfig) {
      (this.config.misoConfig as { logLevel?: string }).logLevel = level;
      try {
        const misoConfig = (this.misoClient as unknown as { config?: { logLevel?: string } }).config;
        if (misoConfig) misoConfig.logLevel = level;
      } catch {
        // Silently ignore if config is not accessible
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getMetrics(): RequestMetrics {
    const responseTimes = (this.metrics.responseTimes || []).sort((a, b) => a - b);
    const len = responseTimes.length;
    return {
      totalRequests: this.metrics.totalRequests,
      totalFailures: this.metrics.totalFailures,
      averageResponseTime: len > 0 ? responseTimes.reduce((a, b) => a + b, 0) / len : 0,
      responseTimeDistribution: {
        min: len > 0 ? responseTimes[0] : 0,
        max: len > 0 ? responseTimes[len - 1] : 0,
        p50: len > 0 ? responseTimes[Math.floor(len * 0.5)] : 0,
        p95: len > 0 ? responseTimes[Math.floor(len * 0.95)] : 0,
        p99: len > 0 ? responseTimes[Math.floor(len * 0.99)] : 0,
      },
      errorRate: this.metrics.totalRequests > 0 ? this.metrics.totalFailures / this.metrics.totalRequests : 0,
      cacheHitRate:
        this.metrics.cacheHits + this.metrics.cacheMisses > 0
          ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
          : 0,
    };
  }

  // ==================== HTTP REQUEST CORE ====================

  /** Check circuit breaker and throw if request should be blocked */
  private checkCircuitBreaker(cacheKey: string): void {
    const failedRequest = this.failedRequests.get(cacheKey);
    if (!failedRequest) return;
    const timeSinceFailure = Date.now() - failedRequest.timestamp;
    const failureCount = failedRequest.count || 1;
    const cooldownPeriod = failureCount === 1 ? 5000 : failureCount === 2 ? 15000 : 30000;
    if (timeSinceFailure < cooldownPeriod) throw failedRequest.error;
    this.failedRequests.delete(cacheKey);
  }

  /** Record failed request for circuit breaker */
  private recordFailure(cacheKey: string, error: Error): void {
    const existingFailure = this.failedRequests.get(cacheKey);
    const failureCount = existingFailure ? (existingFailure.count || 1) + 1 : 1;
    this.failedRequests.set(cacheKey, { timestamp: Date.now(), error, count: failureCount });
    const cleanupTimer = setTimeout(
      () => this.failedRequests.delete(cacheKey),
      30000,
    );
    if (typeof cleanupTimer.unref === "function") {
      cleanupTimer.unref();
    }
  }

  /** Execute HTTP request with all middleware */
  private executeRequest<T>(method: string, fullUrl: string, endpoint: string, cacheKey: string, cacheEnabled: boolean, startTime: number, options?: ApiRequestOptions): Promise<T> {
    return executeHttpRequest<T>(
      method, fullUrl, endpoint, this.config, this.cache, cacheKey, cacheEnabled, startTime,
      this.misoClient, () => this.hasAnyToken(), () => this.getToken(),
      () => this.handleAuthError(), () => this.refreshUserToken(), this.interceptors, this.metrics, options,
    );
  }

  private async request<T>(method: string, endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const startTime = Date.now();
    const fullUrl = `${this.config.baseUrl}${endpoint}`;
    const cacheKey = getCacheKeyForRequest(endpoint, { ...options, method: method.toUpperCase() });
    const isGetRequest = method.toUpperCase() === "GET";
    const cacheEnabled = isCacheEnabled(method, this.config.cache, options);

    this.checkCircuitBreaker(cacheKey);

    // Check cache and pending requests for GET
    if (cacheEnabled) { const cached = getCachedEntry<T>(this.cache, cacheKey, this.metrics); if (cached !== null) return cached; }
    if (isGetRequest) { const pending = this.pendingRequests.get(cacheKey); if (pending) return pending as Promise<T>; }

    // Execute request (with deduplication for GET)
    const requestPromise = isGetRequest
      ? (async () => { try { return await this.executeRequest<T>(method, fullUrl, endpoint, cacheKey, cacheEnabled, startTime, options); } finally { this.pendingRequests.delete(cacheKey); } })()
      : this.executeRequest<T>(method, fullUrl, endpoint, cacheKey, cacheEnabled, startTime, options);
    if (isGetRequest) this.pendingRequests.set(cacheKey, requestPromise);

    try { const result = await requestPromise; this.failedRequests.delete(cacheKey); return result; }
    catch (error) { this.recordFailure(cacheKey, error as Error); throw error; }
  }

  private async refreshUserToken(): Promise<{ token: string; expiresIn: number } | null> {
    if (!this.config.onTokenRefresh) return null;
    try {
      const result = await this.config.onTokenRefresh();
      if (isBrowser() && result.token) {
        const { setLocalStorage } = await import("./data-client-utils");
        for (const key of this.config.tokenKeys || ["token", "accessToken", "authToken"]) {
          setLocalStorage(key, result.token);
        }
      }
      return result;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return null;
    }
  }

  private handleAuthError(): void {
    if (isBrowser()) {
      this.redirectToLogin().catch((error) => console.error("Failed to redirect to login:", error));
    }
  }

  private async applyRequestInterceptor(url: string, options: ApiRequestOptions): Promise<ApiRequestOptions> {
    return this.interceptors.onRequest ? await this.interceptors.onRequest(url, options) : options;
  }

  // ==================== HTTP METHODS ====================

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, { ...options, method: "GET" });
    return this.request<T>("GET", endpoint, finalOptions);
  }

  async post<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options, method: "POST", body: data ? JSON.stringify(data) : undefined,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return this.request<T>("POST", endpoint, finalOptions);
  }

  async put<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options, method: "PUT", body: data ? JSON.stringify(data) : undefined,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return this.request<T>("PUT", endpoint, finalOptions);
  }

  async patch<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options, method: "PATCH", body: data ? JSON.stringify(data) : undefined,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return this.request<T>("PATCH", endpoint, finalOptions);
  }

  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, { ...options, method: "DELETE" });
    return this.request<T>("DELETE", endpoint, finalOptions);
  }

  // ==================== PERMISSION METHODS ====================

  async getPermissions(token?: string): Promise<string[]> {
    return permissionHelpers.getPermissions(this.permissionService, this.misoClient, () => this.getToken(), token);
  }

  async hasPermission(permission: string, token?: string): Promise<boolean> {
    return permissionHelpers.hasPermission(this.permissionService, this.misoClient, () => this.getToken(), permission, token);
  }

  async hasAnyPermission(permissions: string[], token?: string): Promise<boolean> {
    return permissionHelpers.hasAnyPermission(this.permissionService, this.misoClient, () => this.getToken(), permissions, token);
  }

  async hasAllPermissions(permissions: string[], token?: string): Promise<boolean> {
    return permissionHelpers.hasAllPermissions(this.permissionService, this.misoClient, () => this.getToken(), permissions, token);
  }

  async refreshPermissions(token?: string): Promise<string[]> {
    return permissionHelpers.refreshPermissions(this.permissionService, this.misoClient, () => this.getToken(), token);
  }

  async clearPermissionsCache(token?: string): Promise<void> {
    return permissionHelpers.clearPermissionsCache(this.permissionService, this.misoClient, () => this.getToken(), token);
  }

  // ==================== ROLE METHODS ====================

  async getRoles(token?: string): Promise<string[]> {
    return roleHelpers.getRoles(this.roleService, this.misoClient, () => this.getToken(), token);
  }

  async hasRole(role: string, token?: string): Promise<boolean> {
    return roleHelpers.hasRole(this.roleService, this.misoClient, () => this.getToken(), role, token);
  }

  async hasAnyRole(roles: string[], token?: string): Promise<boolean> {
    return roleHelpers.hasAnyRole(this.roleService, this.misoClient, () => this.getToken(), roles, token);
  }

  async hasAllRoles(roles: string[], token?: string): Promise<boolean> {
    return roleHelpers.hasAllRoles(this.roleService, this.misoClient, () => this.getToken(), roles, token);
  }

  async refreshRoles(token?: string): Promise<string[]> {
    return roleHelpers.refreshRoles(this.roleService, this.misoClient, () => this.getToken(), token);
  }

  async clearRolesCache(token?: string): Promise<void> {
    return roleHelpers.clearRolesCache(this.roleService, this.misoClient, () => this.getToken(), token);
  }

  // ==================== AUTHENTICATION METHODS ====================

  async validateToken(token?: string): Promise<boolean> {
    if (!this.misoClient) return false;
    const userToken = token || this.getToken();
    return userToken ? this.misoClient.validateToken(userToken) : false;
  }

  async getUser(token?: string): Promise<UserInfo | null> {
    if (!this.misoClient) return null;
    const userToken = token || this.getToken();
    return userToken ? this.misoClient.getUser(userToken) : null;
  }

  async getUserInfo(token?: string): Promise<UserInfo | null> {
    if (!this.misoClient) return null;
    const userToken = token || this.getToken();
    return userToken ? this.misoClient.getUserInfo(userToken) : null;
  }

  async isAuthenticatedAsync(token?: string): Promise<boolean> {
    return this.validateToken(token);
  }

  async getEnvironmentToken(): Promise<string> {
    return getEnvironmentToken(this.config, this.misoClient);
  }

  getClientTokenInfo(): ClientTokenInfo | null {
    return getClientTokenInfo(this.config.misoConfig);
  }
}

// ==================== SINGLETON FACTORY ====================

let defaultDataClient: DataClient | null = null;

export function dataClient(config?: DataClientConfig): DataClient {
  if (!defaultDataClient && config) {
    defaultDataClient = new DataClient(config);
  }
  if (!defaultDataClient) {
    throw new Error("DataClient not initialized. Call dataClient(config) first.");
  }
  return defaultDataClient;
}
