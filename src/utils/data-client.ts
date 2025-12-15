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
import { isBrowser, getLocalStorage } from "./data-client-utils";
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
  redirectToLogin as redirectToLoginAuth,
  logout,
  getEnvironmentToken,
  getClientTokenInfo,
} from "./data-client-auth";

export class DataClient {
  private config: DataClientConfig;
  private misoClient: MisoClient | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<unknown>> = new Map();
  private interceptors: InterceptorConfig = {};
  private metrics: {
    totalRequests: number;
    totalFailures: number;
    responseTimes: number[];
    cacheHits: number;
    cacheMisses: number;
  } = {
    totalRequests: 0,
    totalFailures: 0,
    responseTimes: [],
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(config: DataClientConfig) {
    this.config = {
      tokenKeys: ["token", "accessToken", "authToken"],
      loginUrl: "/login",
      timeout: 30000,
      cache: {
        enabled: true,
        defaultTTL: 300,
        maxSize: 100,
      },
      retry: {
        enabled: true,
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
      },
      audit: {
        enabled: true,
        level: "standard",
        batchSize: 10,
        maxResponseSize: 10000,
        maxMaskingSize: 50000,
        skipEndpoints: [],
      },
      ...config,
    };

    // Security: Warn if clientSecret is provided in browser environment
    // This is a security risk as clientSecret should never be exposed in client-side code
    if (isBrowser() && this.config.misoConfig?.clientSecret) {
      console.warn(
        "⚠️ SECURITY WARNING: clientSecret detected in browser environment. " +
          "Client secrets should NEVER be exposed in client-side code. " +
          "Use the client token pattern instead (clientToken + onClientTokenRefresh). " +
          "See documentation for browser-safe configuration.",
      );
    }

    // Initialize MisoClient if config provided
    if (this.config.misoConfig) {
      // Automatically bridge DataClient.getEnvironmentToken() to MisoClient
      // This allows MisoClient's logger service to get client tokens automatically
      // Users don't need to manually provide onClientTokenRefresh!
      const misoConfigWithRefresh = {
        ...this.config.misoConfig,
        // Only auto-bridge if:
        // 1. User hasn't provided onClientTokenRefresh (allow override)
        // 2. We're in browser (server-side uses clientSecret)
        // 3. No clientSecret provided (would use that instead)
        onClientTokenRefresh:
          this.config.misoConfig.onClientTokenRefresh ||
          (isBrowser() && !this.config.misoConfig.clientSecret
            ? async () => {
                const token = await this.getEnvironmentToken();
                if (!token) {
                  throw new Error("Failed to get client token");
                }
                // Get expiration from localStorage (set by getEnvironmentToken)
                const expiresAtStr = getLocalStorage(
                  "miso:client-token-expires-at",
                );
                const expiresAt = expiresAtStr
                  ? parseInt(expiresAtStr, 10)
                  : Date.now() + 3600000; // Default 1 hour
                const expiresIn = Math.floor(
                  (expiresAt - Date.now()) / 1000,
                );
                return {
                  token,
                  expiresIn: expiresIn > 0 ? expiresIn : 3600, // Default 1 hour if invalid
                };
              }
            : undefined),
      };
      this.misoClient = new MisoClient(misoConfigWithRefresh);
    }

    // Initialize DataMasker with config path if provided
    if (this.config.misoConfig?.sensitiveFieldsConfig) {
      DataMasker.setConfigPath(this.config.misoConfig.sensitiveFieldsConfig);
    }
  }

  /**
   * Get authentication token from localStorage
   */
  private getToken(): string | null {
    return getToken(this.config.tokenKeys);
  }

  /**
   * Check if client token is available (from localStorage cache or config)
   */
  private hasClientToken(): boolean {
    return hasClientToken(this.misoClient, this.config.misoConfig);
  }

  /**
   * Check if any authentication token is available (user token OR client token)
   */
  private hasAnyToken(): boolean {
    return hasAnyToken(
      this.config.tokenKeys,
      this.misoClient,
      this.config.misoConfig,
    );
  }

  /**
   * Get client token for requests
   * Checks localStorage cache first, then config, then calls getEnvironmentToken() if needed
   * @returns Client token string or null if unavailable
   */
  private async getClientToken(): Promise<string | null> {
    return getClientToken(
      this.config.misoConfig,
      this.config.baseUrl,
      () => this.getEnvironmentToken(),
    );
  }

  /**
   * Build controller URL from configuration
   * Uses controllerPublicUrl (browser) or controllerUrl (fallback)
   * @returns Controller base URL or null if not configured
   */
  private getControllerUrl(): string | null {
    return getControllerUrl(this.config.misoConfig);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Redirect to login page via controller
   * Calls the controller login endpoint with redirect parameter and x-client-token header
   * @param redirectUrl - Optional redirect URL to return to after login (defaults to current page URL)
   */
  async redirectToLogin(redirectUrl?: string): Promise<void> {
    return redirectToLoginAuth(this.config, () => this.getClientToken(), redirectUrl);
  }

  /**
   * Logout user and redirect
   * Calls logout API with x-client-token header, clears tokens from localStorage, clears cache, and redirects
   * @param redirectUrl - Optional redirect URL after logout (defaults to logoutUrl or loginUrl)
   */
  async logout(redirectUrl?: string): Promise<void> {
    return logout(
      this.config,
      () => this.getToken(),
      () => this.getClientToken(),
      () => this.clearCache(),
      redirectUrl,
    );
  }

  /**
   * Set interceptors
   */
  setInterceptors(config: InterceptorConfig): void {
    this.interceptors = { ...this.interceptors, ...config };
  }

  /**
   * Set audit configuration
   */
  setAuditConfig(config: Partial<AuditConfig>): void {
    this.config.audit = { ...this.config.audit, ...config } as AuditConfig;
  }

  /**
   * Set log level for MisoClient logger
   * Note: This updates the MisoClient config logLevel if MisoClient is initialized
   * @param level - Log level ('debug' | 'info' | 'warn' | 'error')
   */
  setLogLevel(level: "debug" | "info" | "warn" | "error"): void {
    if (this.misoClient && this.config.misoConfig) {
      // Update the config's logLevel
      // Note: TypeScript readonly doesn't prevent runtime updates
      (this.config.misoConfig as { logLevel?: string }).logLevel = level;
      
      // Also try to update MisoClient's internal config if accessible
      try {
        const misoConfig = (this.misoClient as unknown as { config?: { logLevel?: string } }).config;
        if (misoConfig) {
          misoConfig.logLevel = level;
        }
      } catch {
        // Silently ignore if config is not accessible
      }
    }
  }

  /**
   * Clear all cached responses
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get request metrics
   */
  getMetrics(): RequestMetrics {
    const responseTimes = this.metrics.responseTimes.sort((a, b) => a - b);
    const len = responseTimes.length;

    return {
      totalRequests: this.metrics.totalRequests,
      totalFailures: this.metrics.totalFailures,
      averageResponseTime:
        len > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / len
          : 0,
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

  /**
   * Make HTTP request with all features (caching, retry, deduplication, audit)
   */
  private async request<T>(
    method: string,
    endpoint: string,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const startTime = Date.now();
    const fullUrl = `${this.config.baseUrl}${endpoint}`;
    const cacheKey = getCacheKeyForRequest(endpoint, options);
    const isGetRequest = method.toUpperCase() === "GET";
    const cacheEnabled = isCacheEnabled(
      method,
      this.config.cache,
      options,
    );

    // Check cache for GET requests
    if (cacheEnabled) {
      const cached = getCachedEntry<T>(
        this.cache,
        cacheKey,
        this.metrics,
      );
      if (cached !== null) {
        return cached;
      }
    }

    // Check for duplicate concurrent requests (only for GET requests)
    if (isGetRequest) {
      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
        return pendingRequest as Promise<T>;
      }
    }

    // Create request promise
    const requestPromise = executeHttpRequest<T>(
      method,
      fullUrl,
      endpoint,
      this.config,
      this.cache,
      cacheKey,
      cacheEnabled,
      startTime,
      this.misoClient,
      () => this.hasAnyToken(),
      () => this.getToken(),
      () => this.handleAuthError(),
      this.interceptors,
      this.metrics,
      options,
    );

    // Store pending request (only for GET requests)
    if (isGetRequest) {
      this.pendingRequests.set(cacheKey, requestPromise);
    }

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Cleanup pending request
      if (isGetRequest) {
        this.pendingRequests.delete(cacheKey);
      }
    }
  }

  /**
   * Handle authentication error
   */
  private handleAuthError(): void {
    if (isBrowser()) {
      // Fire and forget - redirect doesn't need to complete before throwing error
      this.redirectToLogin().catch((error) => {
        console.error("Failed to redirect to login:", error);
      });
    }
  }

  /**
   * Apply request interceptor
   */
  private async applyRequestInterceptor(
    url: string,
    options: ApiRequestOptions,
  ): Promise<ApiRequestOptions> {
    if (this.interceptors.onRequest) {
      return await this.interceptors.onRequest(url, options);
    }
    return options;
  }

  // ==================== HTTP METHODS ====================

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "GET",
    });
    return this.request<T>("GET", endpoint, finalOptions);
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    return this.request<T>("POST", endpoint, finalOptions);
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    return this.request<T>("PUT", endpoint, finalOptions);
  }

  /**
   * PATCH request (uses fetch fallback since MisoClient doesn't support PATCH)
   */
  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    return this.request<T>("PATCH", endpoint, finalOptions);
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "DELETE",
    });
    return this.request<T>("DELETE", endpoint, finalOptions);
  }

  /**
   * Get environment token (browser-side)
   * Checks localStorage cache first, then calls backend endpoint if needed
   * Uses clientTokenUri from config or defaults to /api/v1/auth/client-token
   * 
   * @returns Client token string
   * @throws Error if token fetch fails
   */
  async getEnvironmentToken(): Promise<string> {
    return getEnvironmentToken(this.config, this.misoClient);
  }

  /**
   * Get client token information (browser-side)
   * Extracts application and environment info from client token
   * 
   * @returns Client token info or null if token not available
   */
  getClientTokenInfo(): ClientTokenInfo | null {
    return getClientTokenInfo(this.config.misoConfig);
  }
}

/**
 * Singleton instance factory
 */
let defaultDataClient: DataClient | null = null;

/**
 * Get or create default DataClient instance
 */
export function dataClient(config?: DataClientConfig): DataClient {
  if (!defaultDataClient && config) {
    defaultDataClient = new DataClient(config);
  }
  if (!defaultDataClient) {
    throw new Error(
      "DataClient not initialized. Call dataClient(config) first.",
    );
  }
  return defaultDataClient;
}
