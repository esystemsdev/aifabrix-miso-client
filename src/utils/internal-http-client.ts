/**
 * Internal HTTP client utility for controller communication
 * This is the base HTTP client without audit/debug logging
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { MisoClientConfig, AuthStrategy } from "../types/config.types";
import { AuthStrategyHandler } from "./auth-strategy";
import { resolveControllerUrl } from "./controller-url-resolver";
import { validateHttpResponse } from "./http-response-validator";
import { createMisoClientError, isAxiosError } from "./http-error-handler";
import {
  TokenState,
  isTokenValid,
  fetchClientToken,
  refreshClientTokenFromCallback,
} from "./client-token-manager";
import { LoggerContextStorage } from "../services/logger/logger-context-storage";

export class InternalHttpClient {
  private axios: AxiosInstance;
  public readonly config: MisoClientConfig;
  private tokenState: TokenState = { token: null, expiresAt: null };
  private tokenRefreshPromise: Promise<string> | null = null;
  private loggerContextStorage = LoggerContextStorage.getInstance();

  constructor(config: MisoClientConfig) {
    this.config = config;
    this.initializeTokenFromConfig(config);
    this.axios = this.createAxiosInstance(config);
    this.setupInterceptors();
  }

  /** Initialize client token from config if provided */
  private initializeTokenFromConfig(config: MisoClientConfig): void {
    if (config.clientToken) {
      this.tokenState.token = config.clientToken;
      if (config.clientTokenExpiresAt) {
        this.tokenState.expiresAt =
          typeof config.clientTokenExpiresAt === "string"
            ? new Date(config.clientTokenExpiresAt)
            : config.clientTokenExpiresAt;
      }
    }
  }

  /** Create and configure axios instance */
  private createAxiosInstance(config: MisoClientConfig): AxiosInstance {
    const controllerUrl = resolveControllerUrl(config);
    const isHttps = controllerUrl.startsWith("https://");
    let httpAgent: import("http").Agent | undefined;
    let httpsAgent: import("https").Agent | undefined;

    const requestTimeout = config.timeout ?? 30000;
    // Force IPv4 and set connection timeout (Node.js only)
    if (typeof (globalThis as { window?: unknown }).window === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const http = require("http");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const https = require("https");
      const agentOpts = { family: 4, timeout: requestTimeout, keepAlive: false };
      httpAgent = !isHttps ? new http.Agent(agentOpts) : undefined;
      httpsAgent = isHttps ? new https.Agent(agentOpts) : undefined;
    }

    return axios.create({
      baseURL: controllerUrl,
      timeout: requestTimeout,
      httpAgent,
      httpsAgent,
      headers: { "Content-Type": "application/json" },
    });
  }

  /** Setup request and response interceptors */
  private setupInterceptors(): void {
    // Request interceptor: adds client token
    this.axios.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        config.headers = config.headers || {};
        this.attachTraceHeaders(config);
        if (!config.headers["x-client-token"] && !config.headers["x-client-id"]) {
          const token = await this.getClientToken();
          if (token) {
            config.headers["x-client-token"] = token;
          } else {
            // eslint-disable-next-line no-console -- Operational warning for missing client token configuration
            console.warn(
              "Client token is not available. Ensure clientSecret or onClientTokenRefresh is configured.",
            );
          }
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error),
    );

    // Response interceptor: handle 401 errors with auth-specific messages
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.handle401Error(error);
        }
        return Promise.reject(error);
      },
    );
  }

  /** Attach correlation headers from async logger context when available. */
  private attachTraceHeaders(config: InternalAxiosRequestConfig): void {
    const context = this.loggerContextStorage.getContext();
    if (!context) return;

    const correlationId = context.correlationId || context.requestId;
    if (correlationId && !config.headers["x-correlation-id"]) {
      config.headers["x-correlation-id"] = correlationId;
    }

    if (context.requestId && !config.headers["x-request-id"]) {
      config.headers["x-request-id"] = context.requestId;
    }
  }

  /** Handle 401 error by setting helpful message and clearing token */
  private handle401Error(error: AxiosError): void {
    const requestHeaders = error.config?.headers;
    const hasUserToken = !!requestHeaders?.["Authorization"];
    const hasClientToken = !!requestHeaders?.["x-client-token"];

    if (hasUserToken) {
      error.message = "Bearer token authentication failed - token may be invalid or expired";
    } else if (hasClientToken) {
      error.message = "Client token authentication failed - x-client-token may be invalid or expired";
    } else {
      error.message = "Authentication failed - token may be invalid";
    }

    // Clear client token on any 401
    this.tokenState.token = null;
    this.tokenState.expiresAt = null;
  }

  /**
   * Get client token, fetching if needed
   * Proactively refreshes if token will expire within 60 seconds
   */
  private async getClientToken(): Promise<string | null> {
    // If token exists and not expired (with 60s buffer), return it
    if (isTokenValid(this.tokenState)) {
      return this.tokenState.token;
    }

    // If refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Check if we have a refresh callback (browser pattern)
    if (this.config.onClientTokenRefresh) {
      return this.executeTokenRefresh(() =>
        refreshClientTokenFromCallback(this.config, this.tokenState),
      );
    }

    // Fallback: Fetch new token using clientSecret (server-side only)
    if (this.config.clientSecret) {
      return this.executeTokenRefresh(() =>
        fetchClientToken(this.config, this.tokenState),
      );
    }

    return null;
  }

  /** Execute token refresh with promise deduplication */
  private async executeTokenRefresh(refreshFn: () => Promise<string>): Promise<string> {
    this.tokenRefreshPromise = refreshFn();
    try {
      return await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /** Merge two AbortSignals into one */
  private mergeAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal1.addEventListener("abort", abort);
    signal2.addEventListener("abort", abort);
    return controller.signal;
  }

  /** Execute axios request with timeout wrapper */
  private async executeWithTimeout<T>(
    axiosFn: (config: AxiosRequestConfig) => Promise<AxiosResponse<T>>,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const timeout = this.config.timeout ?? 30000;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    });
    const requestConfig: AxiosRequestConfig = {
      ...config,
      signal: config?.signal
        ? this.mergeAbortSignals(controller.signal, config.signal as AbortSignal)
        : controller.signal,
    };

    try {
      const response = await Promise.race([axiosFn(requestConfig), timeoutPromise]);
      validateHttpResponse(response.data, response.config?.url || "", this.config);
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        throw createMisoClientError(error, error.config?.url);
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /** Build request config with auth strategy headers */
  private async buildAuthStrategyConfig(
    authStrategy: AuthStrategy,
    baseConfig?: AxiosRequestConfig,
  ): Promise<AxiosRequestConfig> {
    const clientToken = await this.getClientToken();
    const authHeaders = AuthStrategyHandler.buildAuthHeaders(
      authStrategy,
      clientToken,
      this.config.clientId,
      this.config.clientSecret,
    );
    return {
      ...baseConfig,
      headers: { ...baseConfig?.headers, ...authHeaders },
    };
  }

  /** Execute request based on HTTP method */
  private async executeMethod<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    data: unknown,
    config: AxiosRequestConfig,
  ): Promise<T> {
    switch (method) {
      case "GET":
        return this.get<T>(url, config);
      case "POST":
        return this.post<T>(url, data, config);
      case "PUT":
        return this.put<T>(url, data, config);
      case "DELETE":
        return this.delete<T>(url, config);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  /**
   * Get access to internal axios instance (for interceptors)
   * @returns The underlying Axios instance
   */
  getAxiosInstance(): AxiosInstance {
    return this.axios;
  }

  /**
   * Send GET request using client credentials
   * @param url - Request URL
   * @param config - Optional Axios request configuration
   * @returns Response data of type T
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.get<T>(url, cfg), config);
  }

  /**
   * Send POST request using client credentials.
   * Body is passed only as the second argument; any config.data is omitted to avoid
   * passing the body twice to axios (which would cause duplicate/conflicting body).
   * @param url - Request URL
   * @param data - Optional request body data
   * @param config - Optional Axios request configuration (data in config is ignored; use second arg)
   * @returns Response data of type T
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const { data: _omit, ...restConfig } = config ?? {};
    return this.executeWithTimeout<T>(
      (cfg) => this.axios.post<T>(url, data, cfg),
      restConfig as AxiosRequestConfig,
    );
  }

  /**
   * Send PUT request using client credentials.
   * Body is passed only as the second argument; any config.data is omitted to avoid
   * passing the body twice to axios (which would cause duplicate/conflicting body).
   * @param url - Request URL
   * @param data - Optional request body data
   * @param config - Optional Axios request configuration (data in config is ignored; use second arg)
   * @returns Response data of type T
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const { data: _omit, ...restConfig } = config ?? {};
    return this.executeWithTimeout<T>(
      (cfg) => this.axios.put<T>(url, data, cfg),
      restConfig as AxiosRequestConfig,
    );
  }

  /**
   * Send DELETE request using client credentials
   * @param url - Request URL
   * @param config - Optional Axios request configuration
   * @returns Response data of type T
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.delete<T>(url, cfg), config);
  }

  /**
   * Generic method for all HTTP requests using client credentials
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param url - Request URL
   * @param data - Optional request body data
   * @param config - Optional Axios request configuration
   * @returns Response data of type T
   */
  async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.executeMethod<T>(method, url, data, config || {});
  }

  /**
   * Send authenticated request with user Bearer token
   * Client token is sent as x-client-token header (via interceptor)
   * User token is sent as Authorization: Bearer header
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param url - Request URL
   * @param token - User authentication token (sent as Bearer token)
   * @param data - Optional request body data
   * @param config - Optional Axios request configuration
   * @param authStrategy - Optional authentication strategy override
   * @returns Response data of type T
   */
  async authenticatedRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    token: string,
    data?: unknown,
    config?: AxiosRequestConfig,
    authStrategy?: AuthStrategy,
  ): Promise<T> {
    const requestConfig = authStrategy
      ? await this.buildAuthStrategyConfig(authStrategy, config)
      : { ...config, headers: { ...config?.headers, Authorization: `Bearer ${token}` } };

    return this.executeMethod<T>(method, url, data, requestConfig);
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
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const requestConfig = await this.buildAuthStrategyConfig(authStrategy, config);
    return this.executeMethod<T>(method, url, data, requestConfig);
  }
}
