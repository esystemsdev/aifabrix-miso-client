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
import {
  getCachedEntry,
  isCacheEnabled,
  getCacheKeyForRequest,
} from "./data-client-cache";
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
import { writeErr } from "./console-logger";
import { BrowserPermissionService } from "../services/browser-permission.service";
import { BrowserRoleService } from "../services/browser-role.service";

export class DataClientCore {
  protected config: DataClientConfig;
  protected misoClient: MisoClient | null = null;
  protected cache: Map<string, CacheEntry> = new Map();
  protected pendingRequests: Map<string, Promise<unknown>> = new Map();
  protected failedRequests: Map<
    string,
    { timestamp: number; error: Error; count: number }
  > = new Map();
  protected interceptors: InterceptorConfig = {};
  protected metrics = {
    totalRequests: 0,
    totalFailures: 0,
    responseTimes: [] as number[],
    cacheHits: 0,
    cacheMisses: 0,
  };
  protected permissionService: BrowserPermissionService | null = null;
  protected roleService: BrowserRoleService | null = null;

  constructor(config: DataClientConfig) {
    this.config = createDefaultConfig(config);
    warnIfClientSecretInBrowser(this.config);

    const misoConfigWithRefresh = createMisoConfigWithRefresh(this.config, () =>
      this.getEnvironmentToken(),
    );
    if (misoConfigWithRefresh) {
      this.misoClient = new MisoClient(misoConfigWithRefresh);
    }

    if (this.config.misoConfig?.sensitiveFieldsConfig) {
      DataMasker.setConfigPath(this.config.misoConfig.sensitiveFieldsConfig);
    }

    const services = initializeBrowserServices(
      this.misoClient,
      misoConfigWithRefresh,
    );
    this.permissionService = services.permissionService;
    this.roleService = services.roleService;

    if (isBrowser()) {
      this.handleOAuthCallback();
    }
  }

  protected getToken(): string | null {
    return getToken(this.config.tokenKeys);
  }

  protected hasClientToken(): boolean {
    return hasClientToken(this.misoClient, this.config.misoConfig);
  }

  protected hasAnyToken(): boolean {
    return hasAnyToken(
      this.config.tokenKeys,
      this.misoClient,
      this.config.misoConfig,
    );
  }

  protected async getClientToken(): Promise<string | null> {
    return getClientToken(this.config.misoConfig, this.config.baseUrl, () =>
      this.getEnvironmentToken(),
    );
  }

  protected getControllerUrl(): string | null {
    return getControllerUrl(this.config.misoConfig);
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  handleOAuthCallback(): string | null {
    return handleOAuthCallback(this.config);
  }

  async redirectToLogin(redirectUrl?: string): Promise<void> {
    return redirectToLoginAuth(
      this.config,
      () => this.getClientToken(),
      redirectUrl,
    );
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
        const misoConfig = (
          this.misoClient as unknown as { config?: { logLevel?: string } }
        ).config;
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
    const responseTimes = (this.metrics.responseTimes || []).sort(
      (a, b) => a - b,
    );
    const len = responseTimes.length;
    return {
      totalRequests: this.metrics.totalRequests,
      totalFailures: this.metrics.totalFailures,
      averageResponseTime:
        len > 0 ? responseTimes.reduce((a, b) => a + b, 0) / len : 0,
      responseTimeDistribution: {
        min: len > 0 ? responseTimes[0] : 0,
        max: len > 0 ? responseTimes[len - 1] : 0,
        p50: len > 0 ? responseTimes[Math.floor(len * 0.5)] : 0,
        p95: len > 0 ? responseTimes[Math.floor(len * 0.95)] : 0,
        p99: len > 0 ? responseTimes[Math.floor(len * 0.99)] : 0,
      },
      errorRate:
        this.metrics.totalRequests > 0
          ? this.metrics.totalFailures / this.metrics.totalRequests
          : 0,
      cacheHitRate:
        this.metrics.cacheHits + this.metrics.cacheMisses > 0
          ? this.metrics.cacheHits /
            (this.metrics.cacheHits + this.metrics.cacheMisses)
          : 0,
    };
  }

  protected checkCircuitBreaker(cacheKey: string): void {
    const failedRequest = this.failedRequests.get(cacheKey);
    if (!failedRequest) return;
    const timeSinceFailure = Date.now() - failedRequest.timestamp;
    const failureCount = failedRequest.count || 1;
    const cooldownPeriod =
      failureCount === 1 ? 5000 : failureCount === 2 ? 15000 : 30000;
    if (timeSinceFailure < cooldownPeriod) throw failedRequest.error;
    this.failedRequests.delete(cacheKey);
  }

  protected recordFailure(cacheKey: string, error: Error): void {
    const existingFailure = this.failedRequests.get(cacheKey);
    const failureCount = existingFailure ? (existingFailure.count || 1) + 1 : 1;
    this.failedRequests.set(cacheKey, {
      timestamp: Date.now(),
      error,
      count: failureCount,
    });
    const cleanupTimer = setTimeout(
      () => this.failedRequests.delete(cacheKey),
      30000,
    );
    if (typeof cleanupTimer.unref === "function") {
      cleanupTimer.unref();
    }
  }

  protected executeRequest<T>(req: {
    method: string;
    fullUrl: string;
    endpoint: string;
    cacheKey: string;
    cacheEnabled: boolean;
    startTime: number;
    options?: ApiRequestOptions;
  }): Promise<T> {
    return executeHttpRequest<T>({
      ...req,
      config: this.config,
      cache: this.cache,
      misoClient: this.misoClient,
      hasAnyToken: () => this.hasAnyToken(),
      getToken: () => this.getToken(),
      handleAuthError: () => this.handleAuthError(),
      refreshUserToken: () => this.refreshUserToken(),
      interceptors: this.interceptors,
      metrics: this.metrics,
    });
  }

  protected getCachedResponse<T>(
    cacheEnabled: boolean,
    cacheKey: string,
  ): T | null {
    if (!cacheEnabled) return null;
    return getCachedEntry<T>(this.cache, cacheKey, this.metrics);
  }

  protected getPendingGetRequest<T>(
    isGetRequest: boolean,
    cacheKey: string,
  ): Promise<T> | null {
    if (!isGetRequest) return null;
    const pending = this.pendingRequests.get(cacheKey);
    return pending ? (pending as Promise<T>) : null;
  }

  protected createRequestPromise<T>(
    isGetRequest: boolean,
    cacheKey: string,
    req: {
      method: string;
      fullUrl: string;
      endpoint: string;
      cacheKey: string;
      cacheEnabled: boolean;
      startTime: number;
      options?: ApiRequestOptions;
    },
  ): Promise<T> {
    const requestPromise = isGetRequest
      ? (async () => {
          try {
            return await this.executeRequest<T>(req);
          } finally {
            this.pendingRequests.delete(cacheKey);
          }
        })()
      : this.executeRequest<T>(req);
    if (isGetRequest) this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  protected async resolveRequestPromise<T>(
    requestPromise: Promise<T>,
    cacheKey: string,
  ): Promise<T> {
    try {
      const result = await requestPromise;
      this.failedRequests.delete(cacheKey);
      return result;
    } catch (error) {
      this.recordFailure(cacheKey, error as Error);
      throw error;
    }
  }

  protected async request<T>(
    method: string,
    endpoint: string,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const startTime = Date.now();
    const fullUrl = `${this.config.baseUrl}${endpoint}`;
    const cacheKey = getCacheKeyForRequest(endpoint, {
      ...options,
      method: method.toUpperCase(),
    });
    const isGetRequest = method.toUpperCase() === "GET";
    const cacheEnabled = isCacheEnabled(method, this.config.cache, options);

    this.checkCircuitBreaker(cacheKey);
    const cached = this.getCachedResponse<T>(cacheEnabled, cacheKey);
    if (cached !== null) return cached;

    const pending = this.getPendingGetRequest<T>(isGetRequest, cacheKey);
    if (pending) return pending;

    const req = {
      method,
      fullUrl,
      endpoint,
      cacheKey,
      cacheEnabled,
      startTime,
      options,
    };
    const requestPromise = this.createRequestPromise<T>(
      isGetRequest,
      cacheKey,
      req,
    );
    return this.resolveRequestPromise(requestPromise, cacheKey);
  }

  protected async refreshUserToken(): Promise<{
    token: string;
    expiresIn: number;
  } | null> {
    if (!this.config.onTokenRefresh) return null;
    try {
      const result = await this.config.onTokenRefresh();
      if (isBrowser() && result.token) {
        const { setLocalStorage } = await import("./data-client-utils");
        for (const key of this.config.tokenKeys || [
          "token",
          "accessToken",
          "authToken",
        ]) {
          setLocalStorage(key, result.token);
        }
      }
      return result;
    } catch (error) {
      writeErr(`Token refresh failed: ${String(error)}`);
      return null;
    }
  }

  protected handleAuthError(): void {
    if (isBrowser()) {
      this.redirectToLogin().catch((err) =>
        writeErr(`Failed to redirect to login: ${String(err)}`),
      );
    }
  }

  protected async applyRequestInterceptor(
    url: string,
    options: ApiRequestOptions,
  ): Promise<ApiRequestOptions> {
    return this.interceptors.onRequest
      ? await this.interceptors.onRequest(url, options)
      : options;
  }

  protected getClientTokenInfoInternal(): ClientTokenInfo | null {
    return getClientTokenInfo(this.config.misoConfig);
  }

  protected async getEnvironmentToken(): Promise<string> {
    return getEnvironmentToken(this.config, this.misoClient);
  }
}
