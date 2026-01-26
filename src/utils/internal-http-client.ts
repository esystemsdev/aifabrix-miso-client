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
import { MisoClientConfig, ClientTokenResponse, AuthStrategy } from "../types/config.types";
import { AuthStrategyHandler } from "./auth-strategy";
import { resolveControllerUrl } from "./controller-url-resolver";
import { validateHttpResponse } from "./http-response-validator";
import { createMisoClientError, isAxiosError } from "./http-error-handler";

export class InternalHttpClient {
  private axios: AxiosInstance;
  public readonly config: MisoClientConfig;
  private clientToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(config: MisoClientConfig) {
    this.config = config;

    // Initialize client token from config if provided
    if (config.clientToken) {
      this.clientToken = config.clientToken;
      if (config.clientTokenExpiresAt) {
        this.tokenExpiresAt =
          typeof config.clientTokenExpiresAt === "string"
            ? new Date(config.clientTokenExpiresAt)
            : config.clientTokenExpiresAt;
      }
    }

    // Force IPv4 and set connection timeout for main axios instance
    const controllerUrl = resolveControllerUrl(config);
    const isHttps = controllerUrl.startsWith("https://");
    let httpAgent: import("http").Agent | undefined;
    let httpsAgent: import("https").Agent | undefined;
    
    if (typeof (globalThis as { window?: unknown }).window === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const http = require("http");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const https = require("https");
      const agentOpts = { family: 4, timeout: 30000, keepAlive: false };
      httpAgent = !isHttps ? new http.Agent(agentOpts) : undefined;
      httpsAgent = isHttps ? new https.Agent(agentOpts) : undefined;
    }

    this.axios = axios.create({
      baseURL: controllerUrl,
      timeout: 30000, // Default timeout
      httpAgent,
      httpsAgent,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor: adds client token
    this.axios.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        config.headers = config.headers || {};
        if (!config.headers["x-client-token"] && !config.headers["x-client-id"]) {
          const token = await this.getClientToken();
          if (token) {
            config.headers["x-client-token"] = token;
          } else {
            console.warn("Client token is not available. Ensure clientSecret or onClientTokenRefresh is configured.");
          }
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error),
    );

    // Response interceptor: handle 401 errors
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          error.message = "Authentication failed - token may be invalid";
          this.clientToken = null;
          this.tokenExpiresAt = null;
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Get client token, fetching if needed
   * Proactively refreshes if token will expire within 60 seconds
   * Supports client token refresh callback pattern for browser usage
   */
  private async getClientToken(): Promise<string | null> {
    const now = new Date();

    // If token exists and not expired (with 60s buffer for proactive refresh), return it
    if (
      this.clientToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt > new Date(now.getTime() + 60000)
    ) {
      return this.clientToken;
    }

    // If refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Check if we have a refresh callback (browser pattern)
    if (this.config.onClientTokenRefresh) {
      this.tokenRefreshPromise = this.refreshClientTokenFromCallback();
      try {
        const token = await this.tokenRefreshPromise;
        return token;
      } finally {
        this.tokenRefreshPromise = null;
      }
    }

    // Fallback: Fetch new token using clientSecret (server-side only)
    if (this.config.clientSecret) {
      this.tokenRefreshPromise = this.fetchClientToken();
      try {
        const token = await this.tokenRefreshPromise;
        return token;
      } finally {
        this.tokenRefreshPromise = null;
      }
    }

    // No clientSecret and no refresh callback - return null
    return null;
  }

  /**
   * Refresh client token using callback (for browser usage)
   */
  private async refreshClientTokenFromCallback(): Promise<string> {
    if (!this.config.onClientTokenRefresh) {
      throw new Error(
        "Client token expired and no refresh callback provided",
      );
    }

    try {
      const result = await this.config.onClientTokenRefresh();

      // Update token and expiration
      this.clientToken = result.token;

      if (result.expiresIn) {
        // Set expiration with 30 second buffer before actual expiration
        const bufferExpiresIn = result.expiresIn - 30;
        this.tokenExpiresAt = new Date(
          Date.now() + bufferExpiresIn * 1000,
        );
      }

      return this.clientToken;
    } catch (error) {
      // Clear token on refresh failure
      this.clientToken = null;
      this.tokenExpiresAt = null;
      throw error;
    }
  }

  /**
   * Merge two AbortSignals into one
   */
  private mergeAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal1.addEventListener("abort", abort);
    signal2.addEventListener("abort", abort);
    return controller.signal;
  }

  /**
   * Execute axios request with timeout wrapper
   */
  private async executeWithTimeout<T>(
    axiosFn: (config: AxiosRequestConfig) => Promise<AxiosResponse<T>>,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const timeout = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const requestConfig: AxiosRequestConfig = {
      ...config,
      signal: config?.signal
        ? this.mergeAbortSignals(controller.signal, config.signal as AbortSignal)
        : controller.signal,
    };

    try {
      const response = await Promise.race([
        axiosFn(requestConfig),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout),
        ),
      ]);
      clearTimeout(timeoutId);
      const url = response.config?.url || "";
      validateHttpResponse(response.data, url, this.config);
      return response.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (isAxiosError(error)) {
        throw createMisoClientError(error, error.config?.url);
      }
      throw error;
    }
  }

  /**
   * Generate unique correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const clientPrefix = this.config.clientId.substring(0, 10);
    return `${clientPrefix}-${timestamp}-${random}`;
  }

  /** Create HTTP agent for IPv4 with timeout */
  private async createHttpAgent(isHttps: boolean, timeout: number): Promise<import("http").Agent> {
    const http = await import("http");
    const https = await import("https");
    return isHttps ? new https.Agent({ family: 4, timeout }) : new http.Agent({ family: 4, timeout });
  }

  /** Extract token from response (handles nested and flat formats) */
  private extractTokenFromResponse(response: { data: ClientTokenResponse; status: number }): string | null {
    const token = response.data.data?.token || response.data.token;
    const expiresIn = response.data.data?.expiresIn || response.data.expiresIn;
    const hasSuccess = response.data.success === true;
    const hasValidStatus = response.status >= 200 && response.status < 300;

    if (token && (hasSuccess || hasValidStatus)) {
      this.clientToken = token;
      if (expiresIn) this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 30) * 1000);
      return this.clientToken;
    }
    return null;
  }

  /** Format error for client token fetch failure */
  private formatTokenFetchError(error: unknown, correlationId: string, clientId: string): Error {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const details = isAxiosError(error) && error.response
      ? `status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`
      : isAxiosError(error) && error.request ? `code: ${error.code || "N/A"}` : "";
    return new Error(`Failed to get client token: ${errorMessage}${details ? `. ${details}` : ""} [correlationId: ${correlationId}, clientId: ${clientId}]`);
  }

  /**
   * Fetch client token from controller using clientSecret (server-side only)
   */
  private async fetchClientToken(): Promise<string> {
    if (!this.config.clientSecret) throw new Error("Cannot fetch client token: clientSecret is required but not provided");

    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;
    const requestTimeout = 30000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
      const controllerUrl = resolveControllerUrl(this.config);
      const isHttps = controllerUrl.startsWith("https://");
      const httpAgent = await this.createHttpAgent(isHttps, requestTimeout);

      const tempAxios = axios.create({
        baseURL: controllerUrl, timeout: requestTimeout, signal: controller.signal,
        httpAgent: !isHttps ? httpAgent : undefined, httpsAgent: isHttps ? httpAgent : undefined,
        headers: { "Content-Type": "application/json", "x-client-id": this.config.clientId, "x-client-secret": this.config.clientSecret },
      });

      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Request timeout after ${requestTimeout}ms`)), requestTimeout));
      let response;
      try {
        response = await Promise.race([tempAxios.post<ClientTokenResponse>("/api/v1/auth/token"), timeoutPromise]);
        clearTimeout(timeoutId);
      } catch (requestError) {
        clearTimeout(timeoutId);
        throw requestError;
      }

      const token = this.extractTokenFromResponse(response);
      if (token) return token;

      throw new Error(`Failed to get client token: Invalid response format. Full response: ${JSON.stringify({ status: response.status, data: response.data })} [correlationId: ${correlationId}, clientId: ${clientId}]`);
    } catch (error) {
      throw this.formatTokenFetchError(error, correlationId, clientId);
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
   * Send POST request using client credentials
   * @param url - Request URL
   * @param data - Optional request body data
   * @param config - Optional Axios request configuration
   * @returns Response data of type T
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.post<T>(url, data, cfg), config);
  }

  /**
   * Send PUT request using client credentials
   * @param url - Request URL
   * @param data - Optional request body data
   * @param config - Optional Axios request configuration
   * @returns Response data of type T
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.put<T>(url, data, cfg), config);
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
    // Use auth strategy if provided, otherwise use default bearer token behavior
    let requestConfig: AxiosRequestConfig;

    if (authStrategy) {
      // Build headers based on auth strategy
      const clientToken = await this.getClientToken();
      const authHeaders = AuthStrategyHandler.buildAuthHeaders(
        authStrategy,
        clientToken,
        this.config.clientId,
        this.config.clientSecret,
      );

      requestConfig = {
        ...config,
        headers: {
          ...config?.headers,
          ...authHeaders,
        },
      };
    } else {
      // Default behavior: Bearer token + client token
      requestConfig = {
        ...config,
        headers: {
          ...config?.headers,
          // Add Bearer token for user authentication
          // x-client-token is automatically added by interceptor (not a Bearer token)
          Authorization: `Bearer ${token}`,
        },
      };
    }

    switch (method) {
      case "GET":
        return this.get<T>(url, requestConfig);
      case "POST":
        return this.post<T>(url, data, requestConfig);
      case "PUT":
        return this.put<T>(url, data, requestConfig);
      case "DELETE":
        return this.delete<T>(url, requestConfig);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
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
    // Build headers based on auth strategy
    const clientToken = await this.getClientToken();
    const authHeaders = AuthStrategyHandler.buildAuthHeaders(
      authStrategy,
      clientToken,
      this.config.clientId,
      this.config.clientSecret,
    );

    const requestConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        ...authHeaders,
      },
    };

    switch (method) {
      case "GET":
        return this.get<T>(url, requestConfig);
      case "POST":
        return this.post<T>(url, data, requestConfig);
      case "PUT":
        return this.put<T>(url, data, requestConfig);
      case "DELETE":
        return this.delete<T>(url, requestConfig);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }
}
