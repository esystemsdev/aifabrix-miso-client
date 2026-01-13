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

  /**
   * Fetch client token from controller using clientSecret (server-side only)
   */
  private async fetchClientToken(): Promise<string> {
    if (!this.config.clientSecret) {
      throw new Error(
        "Cannot fetch client token: clientSecret is required but not provided",
      );
    }

    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;

    try {
      // Use default timeout of 30 seconds
      const requestTimeout = 30000;
      
      // Create AbortController for connection timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, requestTimeout);

      // Force IPv4 to avoid IPv6 connection issues and set connection timeout
      const http = await import("http");
      const https = await import("https");
      const controllerUrl = resolveControllerUrl(this.config);
      const isHttps = controllerUrl.startsWith("https://");
      const httpAgent = isHttps
        ? new https.Agent({ family: 4, timeout: requestTimeout })
        : new http.Agent({ family: 4, timeout: requestTimeout });

      // Create a temporary axios instance without interceptors to avoid recursion
      const tempAxios = axios.create({
        baseURL: controllerUrl,
        timeout: requestTimeout,
        signal: controller.signal, // Abort signal for connection timeout
        httpAgent: !isHttps ? httpAgent : undefined,
        httpsAgent: isHttps ? httpAgent : undefined,
        headers: {
          "Content-Type": "application/json",
          "x-client-id": this.config.clientId,
          "x-client-secret": this.config.clientSecret,
        },
      });

      // Wrap in Promise.race to ensure timeout even if axios hangs
      const axiosPromise = tempAxios.post<ClientTokenResponse>("/api/v1/auth/token");
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${requestTimeout}ms`));
        }, requestTimeout);
      });
      
      let response;
      try {
        response = await Promise.race([axiosPromise, timeoutPromise]);
        clearTimeout(timeoutId); // Clear timeout on success
      } catch (requestError) {
        clearTimeout(timeoutId); // Clear timeout on error
        throw requestError; // Re-throw to be handled by outer catch
      }

      // Handle both nested (new) and flat (old) response formats
      const token = response.data.data?.token || response.data.token;
      const expiresIn =
        response.data.data?.expiresIn || response.data.expiresIn;

      // Accept response if:
      // 1. Has success: true AND token (old format)
      // 2. Has token AND status is 2xx (new format without success field)
      const hasSuccess = response.data.success === true;
      const hasValidStatus = response.status >= 200 && response.status < 300;
      
      if (token && (hasSuccess || hasValidStatus)) {
        this.clientToken = token;
        // Set expiration with 30 second buffer before actual expiration
        if (expiresIn) {
          const bufferExpiresIn = expiresIn - 30;
          this.tokenExpiresAt = new Date(Date.now() + bufferExpiresIn * 1000);
        }
        return this.clientToken;
      }

      // Invalid response format - include full response details
      const responseDetails = JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });
      throw new Error(
        `Failed to get client token: Invalid response format. Expected {success: true, token: string}. ` +
          `Full response: ${responseDetails} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const details = isAxiosError(error) && error.response
        ? `status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`
        : isAxiosError(error) && error.request
          ? `code: ${error.code || "N/A"}`
          : "";
      throw new Error(
        `Failed to get client token: ${errorMessage}${details ? `. ${details}` : ""} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    }
  }


  /**
   * Get access to internal axios instance (for interceptors)
   */
  getAxiosInstance(): AxiosInstance {
    return this.axios;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.get<T>(url, cfg), config);
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.post<T>(url, data, cfg), config);
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.put<T>(url, data, cfg), config);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithTimeout<T>((cfg) => this.axios.delete<T>(url, cfg), config);
  }

  // Generic method for all requests (uses client credentials)
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

  // For requests that need Bearer token (user auth)
  // IMPORTANT: Client token is sent as x-client-token header (via interceptor)
  // User token is sent as Authorization: Bearer header (this method parameter)
  // These are two separate tokens for different purposes
  async authenticatedRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    token: string, // User authentication token (sent as Bearer token)
    data?: unknown,
    config?: AxiosRequestConfig,
    authStrategy?: AuthStrategy, // Optional auth strategy override
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
