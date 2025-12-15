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
  NetworkError,
  TimeoutError,
  AuthenticationError,
  ApiError,
} from "../types/data-client.types";
import { DataMasker } from "./data-masker";
import jwt from "jsonwebtoken";
import { extractClientTokenInfo, ClientTokenInfo } from "./token-utils";

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return (
    typeof (globalThis as { window?: unknown }).window !== "undefined" &&
    typeof (globalThis as { localStorage?: unknown }).localStorage !== "undefined" &&
    typeof (globalThis as { fetch?: unknown }).fetch !== "undefined"
  );
}

/**
 * Get value from localStorage (browser only)
 */
function getLocalStorage(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return (globalThis as unknown as { localStorage: { getItem: (key: string) => string | null } }).localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Set value in localStorage (browser only)
 */
function setLocalStorage(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    (globalThis as unknown as { localStorage: { setItem: (key: string, value: string) => void } }).localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage errors (SSR, private browsing, etc.)
  }
}

/**
 * Remove value from localStorage (browser only)
 */
function removeLocalStorage(key: string): void {
  if (!isBrowser()) return;
  try {
    (globalThis as unknown as { localStorage: { removeItem: (key: string) => void } }).localStorage.removeItem(key);
  } catch {
    // Ignore localStorage errors (SSR, private browsing, etc.)
  }
}

/**
 * Extract userId from JWT token
 */
function extractUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) return null;
    return (decoded.sub || decoded.userId || decoded.user_id || decoded.id) as
      | string
      | null;
  } catch {
    return null;
  }
}

/**
 * Calculate cache key from endpoint and options
 */
function generateCacheKey(endpoint: string, options?: ApiRequestOptions): string {
  const method = options?.method || "GET";
  const body = options?.body ? JSON.stringify(options.body) : "";
  return `data-client:${method}:${endpoint}:${body}`;
}

/**
 * Truncate large payloads before masking (performance optimization)
 */
function truncatePayload(
  data: unknown,
  maxSize: number,
): { data: unknown; truncated: boolean } {
  const json = JSON.stringify(data);
  if (json.length <= maxSize) {
    return { data, truncated: false };
  }
  return {
    data: { _message: "Payload truncated for performance", _size: json.length },
    truncated: true,
  };
}

/**
 * Calculate request/response sizes
 */
function calculateSize(data: unknown): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(statusCode?: number, _error?: Error): boolean {
  if (!statusCode) return true; // Network errors are retryable
  if (statusCode >= 500) return true; // Server errors
  if (statusCode === 408) return true; // Timeout
  if (statusCode === 429) return true; // Rate limit
  if (statusCode === 401 || statusCode === 403) return false; // Auth errors
  if (statusCode >= 400 && statusCode < 500) return false; // Client errors
  return false;
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000; // Add jitter
}

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
      this.misoClient = new MisoClient(this.config.misoConfig);
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
    if (!isBrowser()) return null;
    const keys = this.config.tokenKeys || ["token", "accessToken", "authToken"];
    for (const key of keys) {
      const token = getLocalStorage(key);
      if (token) return token;
    }
    return null;
  }

  /**
   * Check if client token is available (from localStorage cache or config)
   */
  private hasClientToken(): boolean {
    if (!isBrowser()) {
      // Server-side: check if misoClient config has clientSecret
      if (this.misoClient && this.config.misoConfig?.clientSecret) {
        return true;
      }
      return false;
    }
    
    // Browser-side: check localStorage cache
    const cachedToken = getLocalStorage("miso:client-token");
    if (cachedToken) {
      const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
      if (expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (expiresAt > Date.now()) {
          return true; // Valid cached token
        }
      }
    }
    
    // Check config token
    if (this.config.misoConfig?.clientToken) {
      return true;
    }
    
    // Check if misoClient config has onClientTokenRefresh callback (browser pattern)
    if (this.config.misoConfig?.onClientTokenRefresh) {
      return true; // Has means to get client token
    }
    
    // Check if misoClient config has clientSecret (server-side fallback)
    if (this.config.misoConfig?.clientSecret) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if any authentication token is available (user token OR client token)
   */
  private hasAnyToken(): boolean {
    return this.getToken() !== null || this.hasClientToken();
  }

  /**
   * Get client token for requests
   * Checks localStorage cache first, then config, then calls getEnvironmentToken() if needed
   * @returns Client token string or null if unavailable
   */
  private async getClientToken(): Promise<string | null> {
    if (!isBrowser()) {
      // Server-side: return null (client token handled by MisoClient)
      return null;
    }

    // Check localStorage cache first
    const cachedToken = getLocalStorage("miso:client-token");
    const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
    
    if (cachedToken && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (expiresAt > Date.now()) {
        return cachedToken; // Valid cached token
      }
    }

    // Check config token
    if (this.config.misoConfig?.clientToken) {
      return this.config.misoConfig.clientToken;
    }

    // Try to get via getEnvironmentToken() (may throw if unavailable)
    try {
      return await this.getEnvironmentToken();
    } catch (error) {
      console.warn("Failed to get client token:", error);
      return null;
    }
  }

  /**
   * Build controller URL from configuration
   * Uses controllerPublicUrl (browser) or controllerUrl (fallback)
   * @returns Controller base URL or null if not configured
   */
  private getControllerUrl(): string | null {
    if (!this.config.misoConfig) {
      return null;
    }

    // Browser: prefer controllerPublicUrl, fallback to controllerUrl
    if (isBrowser()) {
      return this.config.misoConfig.controllerPublicUrl || 
             this.config.misoConfig.controllerUrl || 
             null;
    }

    // Server: prefer controllerPrivateUrl, fallback to controllerUrl
    return this.config.misoConfig.controllerPrivateUrl || 
           this.config.misoConfig.controllerUrl || 
           null;
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
    if (!isBrowser()) return;
    
    // Get redirect URL - use provided URL or current page URL
    const currentUrl = (globalThis as unknown as { window: { location: { href: string } } }).window.location.href;
    const finalRedirectUrl = redirectUrl || currentUrl;
    
    // Build controller URL
    const controllerUrl = this.getControllerUrl();
    if (!controllerUrl) {
      // Fallback to static loginUrl if controller URL not configured
      const loginUrl = this.config.loginUrl || "/login";
      const fullUrl = /^https?:\/\//i.test(loginUrl)
        ? loginUrl
        : `${(globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin}${loginUrl.startsWith("/") ? loginUrl : `/${loginUrl}`}`;
      (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = fullUrl;
      return;
    }

    try {
      // Get client token
      const clientToken = await this.getClientToken();
      
      // Build login endpoint URL with query parameters
      const loginEndpoint = `${controllerUrl}/api/v1/auth/login`;
      const url = new URL(loginEndpoint);
      url.searchParams.set("redirect", finalRedirectUrl);
      
      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // Add x-client-token header if available
      if (clientToken) {
        headers["x-client-token"] = clientToken;
      }
      
      // Make fetch request
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        credentials: "include", // Include cookies for CORS
      });

      if (!response.ok) {
        throw new Error(`Login request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: { loginUrl?: string; state?: string };
        loginUrl?: string; // Support flat format
      };

      // Extract loginUrl (support both nested and flat formats)
      const loginUrl = data.data?.loginUrl || data.loginUrl;

      if (loginUrl) {
        // Redirect to the login URL returned by controller
        (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = loginUrl;
      } else {
        // Fallback if loginUrl not in response
        const fallbackLoginUrl = this.config.loginUrl || "/login";
        const fullUrl = /^https?:\/\//i.test(fallbackLoginUrl)
          ? fallbackLoginUrl
          : `${(globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin}${fallbackLoginUrl.startsWith("/") ? fallbackLoginUrl : `/${fallbackLoginUrl}`}`;
        (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = fullUrl;
      }
    } catch (error) {
      // On error, fallback to static loginUrl
      console.error("Failed to get login URL from controller:", error);
      const loginUrl = this.config.loginUrl || "/login";
      const fullUrl = /^https?:\/\//i.test(loginUrl)
        ? loginUrl
        : `${(globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin}${loginUrl.startsWith("/") ? loginUrl : `/${loginUrl}`}`;
      (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = fullUrl;
    }
  }

  /**
   * Logout user and redirect
   * Calls logout API with x-client-token header, clears tokens from localStorage, clears cache, and redirects
   * @param redirectUrl - Optional redirect URL after logout (defaults to logoutUrl or loginUrl)
   */
  async logout(redirectUrl?: string): Promise<void> {
    if (!isBrowser()) return;
    
    const token = this.getToken();
    
    // Build controller URL
    const controllerUrl = this.getControllerUrl();
    
    // Call logout API if controller URL available and token exists
    if (controllerUrl && token) {
      try {
        // Get client token
        const clientToken = await this.getClientToken();
        
        // Build logout endpoint URL
        const logoutEndpoint = `${controllerUrl}/api/v1/auth/logout`;
        
        // Build headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        // Add x-client-token header if available
        if (clientToken) {
          headers["x-client-token"] = clientToken;
        }
        
        // Make fetch request
        const response = await fetch(logoutEndpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ token }),
          credentials: "include", // Include cookies for CORS
        });

        if (!response.ok) {
          // Log error but continue with cleanup (logout should always clear local state)
          const errorText = await response.text().catch(() => "Unknown error");
          console.error(`Logout API call failed: ${response.status} ${response.statusText}. ${errorText}`);
        }
      } catch (error) {
        // Log error but continue with cleanup (logout should always clear local state)
        console.error("Logout API call failed:", error);
      }
    }
    
    // Clear tokens from localStorage (always, even if API call failed)
    const keys = this.config.tokenKeys || ["token", "accessToken", "authToken"];
    keys.forEach(key => {
      try {
        const storage = (globalThis as unknown as { localStorage: { removeItem: (key: string) => void } }).localStorage;
        if (storage) {
          storage.removeItem(key);
        }
      } catch (e) {
        // Ignore localStorage errors (SSR, private browsing, etc.)
      }
    });
    
    // Clear HTTP cache
    this.clearCache();
    
    // Determine redirect URL: redirectUrl param > logoutUrl config > loginUrl config > '/login'
    const finalRedirectUrl = redirectUrl || 
      this.config.logoutUrl || 
      this.config.loginUrl || 
      "/login";
    
    // Construct full URL
    const fullUrl = /^https?:\/\//i.test(finalRedirectUrl)
      ? finalRedirectUrl
      : `${(globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin}${finalRedirectUrl.startsWith("/") ? finalRedirectUrl : `/${finalRedirectUrl}`}`;
    
    // Redirect
    (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = fullUrl;
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
   * Check if endpoint should skip audit logging
   */
  private shouldSkipAudit(endpoint: string): boolean {
    if (!this.config.audit?.enabled) return true;
    const skipEndpoints = this.config.audit.skipEndpoints || [];
    return skipEndpoints.some((skip) => endpoint.includes(skip));
  }

  /**
   * Log audit event (ISO 27001 compliance)
   * Skips audit logging if no authentication token is available (user token OR client token)
   */
  private async logAuditEvent(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number,
    error?: Error,
    requestHeaders?: Record<string, string>,
    responseHeaders?: Record<string, string>,
    requestBody?: unknown,
    responseBody?: unknown,
  ): Promise<void> {
    if (this.shouldSkipAudit(url) || !this.misoClient) return;

    // Skip audit logging if no authentication token is available
    // This prevents 401 errors when attempting to audit log unauthenticated requests
    if (!this.hasAnyToken()) {
      // Silently skip audit logging for unauthenticated requests
      // This is expected behavior and prevents 401 errors
      return;
    }

    try {
      const token = this.getToken();
      const userId = token ? extractUserIdFromToken(token) : undefined;
      const auditLevel = this.config.audit?.level || "standard";

      // Build audit context based on level
      const auditContext: Record<string, unknown> = {
        method,
        url,
        statusCode,
        duration,
      };

      if (userId) {
        auditContext.userId = userId;
      }

      // Minimal level: only basic info
      if (auditLevel === "minimal") {
        await this.misoClient.log.audit(
          `http.request.${method.toLowerCase()}`,
          url,
          auditContext,
          { token: token || undefined },
        );
        return;
      }

      // Standard/Detailed/Full levels: include headers and bodies (masked)
      const maxResponseSize = this.config.audit?.maxResponseSize || 10000;
      const maxMaskingSize = this.config.audit?.maxMaskingSize || 50000;

      // Truncate and mask request body
      let maskedRequestBody: unknown = undefined;
      if (requestBody !== undefined) {
        const truncated = truncatePayload(requestBody, maxMaskingSize);
        if (!truncated.truncated) {
          maskedRequestBody = DataMasker.maskSensitiveData(truncated.data);
        } else {
          maskedRequestBody = truncated.data;
        }
      }

      // Truncate and mask response body (for standard, detailed, full levels)
      let maskedResponseBody: unknown = undefined;
      if (responseBody !== undefined) {
        const truncated = truncatePayload(responseBody, maxResponseSize);
        if (!truncated.truncated) {
          maskedResponseBody = DataMasker.maskSensitiveData(truncated.data);
        } else {
          maskedResponseBody = truncated.data;
        }
      }

      // Mask headers
      const maskedRequestHeaders = requestHeaders
        ? (DataMasker.maskSensitiveData(requestHeaders) as Record<
            string,
            string
          >)
        : undefined;
      const maskedResponseHeaders = responseHeaders
        ? (DataMasker.maskSensitiveData(responseHeaders) as Record<
            string,
            string
          >)
        : undefined;

      // Add to context based on level (standard, detailed, full all include headers/bodies)
      if (maskedRequestHeaders) auditContext.requestHeaders = maskedRequestHeaders;
      if (maskedResponseHeaders) auditContext.responseHeaders = maskedResponseHeaders;
      if (maskedRequestBody !== undefined) auditContext.requestBody = maskedRequestBody;
      if (maskedResponseBody !== undefined) auditContext.responseBody = maskedResponseBody;

      // Add sizes for detailed/full levels
      if (auditLevel === "detailed" || auditLevel === "full") {
        if (requestSize !== undefined) auditContext.requestSize = requestSize;
        if (responseSize !== undefined) auditContext.responseSize = responseSize;
      }

      if (error) {
        const maskedError = DataMasker.maskSensitiveData({
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        auditContext.error = maskedError;
      }

      await this.misoClient.log.audit(
        `http.request.${method.toLowerCase()}`,
        url,
        auditContext,
        { token: token || undefined },
      );
    } catch (auditError) {
      // Handle audit logging errors gracefully
      // Don't fail main request if audit logging fails
      const error = auditError as Error & { statusCode?: number; response?: { status?: number } };
      const statusCode = error.statusCode || error.response?.status;
      
      if (statusCode === 401) {
        // User not authenticated - this is expected for unauthenticated requests
        // Silently skip to avoid noise (we already check hasAnyToken() before attempting)
        // This catch block handles edge cases where token becomes unavailable between check and audit call
      } else {
        // Other errors - log warning but don't fail request
        console.warn("Failed to log audit event:", auditError);
      }
    }
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
    const cacheKey = generateCacheKey(endpoint, options);
    const isGetRequest = method.toUpperCase() === "GET";
    const cacheEnabled =
      (this.config.cache?.enabled !== false) &&
      isGetRequest &&
      (options?.cache?.enabled !== false);

    // Check cache for GET requests
    if (cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.metrics.cacheHits++;
        return cached.data as T;
      }
      this.metrics.cacheMisses++;
    }

    // Check for duplicate concurrent requests (only for GET requests)
    if (isGetRequest) {
      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
        return pendingRequest as Promise<T>;
      }
    }

    // Create request promise
    const requestPromise = this.executeRequest<T>(
      method,
      fullUrl,
      endpoint,
      options,
      cacheKey,
      cacheEnabled,
      startTime,
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
   * Execute HTTP request with retry logic
   */
  private async executeRequest<T>(
    method: string,
    fullUrl: string,
    endpoint: string,
    options: ApiRequestOptions | undefined,
    cacheKey: string,
    cacheEnabled: boolean,
    startTime: number,
  ): Promise<T> {
    const maxRetries =
      options?.retries !== undefined
        ? options.retries
        : this.config.retry?.maxRetries || 3;
    const retryEnabled = this.config.retry?.enabled !== false;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.makeFetchRequest(method, fullUrl, options);
        const duration = Date.now() - startTime;

        // Update metrics
        this.metrics.totalRequests++;
        this.metrics.responseTimes.push(duration);

        // Parse response
        const data = await this.parseResponse<T>(response);

        // Cache successful GET responses
        if (cacheEnabled && response.ok) {
          const ttl = options?.cache?.ttl || this.config.cache?.defaultTTL || 300;
          this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + ttl * 1000,
            key: cacheKey,
          });

          // Enforce max cache size
          if (this.cache.size > (this.config.cache?.maxSize || 100)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
          }
        }

        // Apply response interceptor
        if (this.interceptors.onResponse) {
          return await this.interceptors.onResponse<T>(response, data);
        }

        // Audit logging
        if (!options?.skipAudit) {
          const requestSize = options?.body
            ? calculateSize(options.body)
            : undefined;
          const responseSize = calculateSize(data);
          await this.logAuditEvent(
            method,
            endpoint,
            response.status,
            duration,
            requestSize,
            responseSize,
            undefined,
            this.extractHeaders(options?.headers),
            this.extractHeaders(response.headers),
            options?.body,
            data,
          );
        }

        // Handle error responses
        if (!response.ok) {
          if (response.status === 401) {
            this.handleAuthError();
            throw new AuthenticationError(
              "Authentication required",
              response,
            );
          }
          throw new ApiError(
            `Request failed with status ${response.status}`,
            response.status,
            response,
          );
        }

        return data;
      } catch (error) {
        lastError = error as Error;
        const duration = Date.now() - startTime;

        // Extract statusCode from error (handle AuthenticationError and ApiError)
        const errorObj = error as ApiError;
        let statusCode = errorObj.statusCode;
        
        // Explicitly check for AuthenticationError (401) - don't retry auth errors
        if (errorObj.name === "AuthenticationError" || statusCode === 401) {
          statusCode = 401;
        }

        // Check if retryable - 401/403 errors should never retry
        const isRetryable =
          statusCode !== 401 &&
          statusCode !== 403 &&
          retryEnabled &&
          attempt < maxRetries &&
          isRetryableError(statusCode, error as Error);

        if (!isRetryable) {
          this.metrics.totalFailures++;

          // Audit log error
          if (!options?.skipAudit) {
            await this.logAuditEvent(
              method,
              endpoint,
              (error as ApiError).statusCode || 0,
              duration,
              options?.body ? calculateSize(options.body) : undefined,
              undefined,
              error as Error,
              this.extractHeaders(options?.headers),
              undefined,
              options?.body,
              undefined,
            );
          }

          // Apply error interceptor
          if (this.interceptors.onError) {
            throw await this.interceptors.onError(error as Error);
          }

          throw error;
        }

        // Calculate backoff delay
        const baseDelay = this.config.retry?.baseDelay || 1000;
        const maxDelay = this.config.retry?.maxDelay || 10000;
        const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    this.metrics.totalFailures++;
    if (lastError) {
      if (this.interceptors.onError) {
        throw await this.interceptors.onError(lastError);
      }
      throw lastError;
    }
    throw new Error("Request failed after retries");
  }

  /**
   * Make fetch request with timeout and authentication
   */
  private async makeFetchRequest(
    method: string,
    url: string,
    options?: ApiRequestOptions,
  ): Promise<Response> {
    // Build headers
    const headers = new Headers(this.config.defaultHeaders);
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => headers.set(key, value));
      } else {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers.set(key, String(value));
        });
      }
    }

    // Add authentication
    if (!options?.skipAuth) {
      const token = this.getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      // Note: MisoClient client-token is handled server-side, not in browser
    }

    // Create abort controller for timeout
    const timeout = options?.timeout || this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Merge signals
    const signal = options?.signal
      ? this.mergeSignals(controller.signal, options.signal)
      : controller.signal;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options?.body,
        signal,
        ...options,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(`Request timeout after ${timeout}ms`, timeout);
      }
      throw new NetworkError(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Merge AbortSignals
   */
  private mergeSignals(
    signal1: AbortSignal,
    signal2: AbortSignal,
  ): AbortSignal {
    const controller = new AbortController();
    
    const abort = () => {
      controller.abort();
      signal1.removeEventListener("abort", abort);
      signal2.removeEventListener("abort", abort);
    };

    if (signal1.aborted || signal2.aborted) {
      controller.abort();
      return controller.signal;
    }

    signal1.addEventListener("abort", abort);
    signal2.addEventListener("abort", abort);

    return controller.signal;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    if (contentType.includes("text/")) {
      return (await response.text()) as T;
    }
    return (await response.blob()) as unknown as T;
  }

  /**
   * Extract headers from Headers object or Record
   */
  private extractHeaders(
    headers?: Headers | Record<string, string> | string[][] | Record<string, string | readonly string[]>,
  ): Record<string, string> | undefined {
    if (!headers) return undefined;
    if (headers instanceof Headers) {
      const result: Record<string, string> = {};
      headers.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    if (Array.isArray(headers)) {
      const result: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        result[key] = String(value);
      });
      return result;
    }
    // Convert Record<string, string | readonly string[]> to Record<string, string>
    const result: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      result[key] = Array.isArray(value) ? value.join(", ") : String(value);
    });
    return result;
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
    if (!isBrowser()) {
      throw new Error("getEnvironmentToken() is only available in browser environment");
    }

    const cacheKey = "miso:client-token";
    const expiresAtKey = "miso:client-token-expires-at";

    // Check cache first
    const cachedToken = getLocalStorage(cacheKey);
    const expiresAtStr = getLocalStorage(expiresAtKey);

    if (cachedToken && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();

      // If token is still valid, return cached token
      if (expiresAt > now) {
        return cachedToken;
      }

      // Token expired, remove from cache
      removeLocalStorage(cacheKey);
      removeLocalStorage(expiresAtKey);
    }

    // Cache miss or expired - fetch from backend
    const clientTokenUri =
      this.config.misoConfig?.clientTokenUri || "/api/v1/auth/client-token";

    // Build full URL
    const fullUrl = /^https?:\/\//i.test(clientTokenUri)
      ? clientTokenUri
      : `${this.config.baseUrl}${clientTokenUri}`;

    try {
      // Make request to backend endpoint
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for CORS
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to get environment token: ${response.status} ${response.statusText}. ${errorText}`,
        );
      }

      const data = (await response.json()) as {
        data?: { token?: string; expiresIn?: number };
        token?: string;
        accessToken?: string;
        access_token?: string;
        expiresIn?: number;
        expires_in?: number;
      };

      // Extract token from response (support both nested and flat formats)
      const token =
        data.data?.token || data.token || data.accessToken || data.access_token;

      if (!token || typeof token !== "string") {
        throw new Error(
          "Invalid response format: token not found in response",
        );
      }

      // Calculate expiration time (default to 1 hour if not provided)
      const expiresIn =
        data.data?.expiresIn || data.expiresIn || data.expires_in || 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      // Cache token
      setLocalStorage(cacheKey, token);
      setLocalStorage(expiresAtKey, expiresAt.toString());

      // Log audit event if misoClient available
      if (this.misoClient && !this.shouldSkipAudit(clientTokenUri)) {
        try {
          await this.misoClient.log.audit(
            "client.token.request.success",
            clientTokenUri,
            {
              method: "POST",
              url: clientTokenUri,
              statusCode: response.status,
              cached: false,
            },
            {},
          );
        } catch (auditError) {
          // Silently fail audit logging to avoid breaking requests
          console.warn("Failed to log audit event:", auditError);
        }
      }

      return token;
    } catch (error) {
      // Log audit event for error if misoClient available
      if (this.misoClient && !this.shouldSkipAudit(clientTokenUri)) {
        try {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          await this.misoClient.log.audit(
            "client.token.request.failed",
            clientTokenUri,
            {
              method: "POST",
              url: clientTokenUri,
              statusCode: 0,
              error: errorMessage,
              cached: false,
            },
            {},
          );
        } catch (auditError) {
          // Silently fail audit logging to avoid breaking requests
          console.warn("Failed to log audit event:", auditError);
        }
      }

      throw error;
    }
  }

  /**
   * Get client token information (browser-side)
   * Extracts application and environment info from client token
   * 
   * @returns Client token info or null if token not available
   */
  getClientTokenInfo(): ClientTokenInfo | null {
    if (!isBrowser()) {
      return null;
    }

    // Try to get token from cache first
    const cachedToken = getLocalStorage("miso:client-token");
    if (cachedToken) {
      return extractClientTokenInfo(cachedToken);
    }

    // Try to get token from config (if provided)
    const configToken = this.config.misoConfig?.clientToken;
    if (configToken) {
      return extractClientTokenInfo(configToken);
    }

    // No token available
    return null;
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

