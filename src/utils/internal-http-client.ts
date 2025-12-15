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
import {
  MisoClientConfig,
  ClientTokenResponse,
  ErrorResponse,
  isErrorResponse,
  AuthStrategy,
} from "../types/config.types";
import { MisoClientError } from "./errors";
import { AuthStrategyHandler } from "./auth-strategy";
import { resolveControllerUrl } from "./controller-url-resolver";

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

    this.axios = axios.create({
      baseURL: resolveControllerUrl(config),
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Interceptor adds client token (or fetches it if needed)
    // Note: This interceptor always adds client-token for backward compatibility
    // When using auth strategy, the strategy handler will override headers as needed
    this.axios.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        config.headers = config.headers || {};

        // Only add client token if not already set by auth strategy
        // Auth strategy will set headers appropriately
        if (
          !config.headers["x-client-token"] &&
          !config.headers["X-Client-Id"]
        ) {
          const token = await this.getClientToken();
          if (token) {
            config.headers["x-client-token"] = token;
          }
        }

        return config;
      },
      (error: AxiosError) => Promise.reject(error),
    );

    // Add response interceptor for error handling
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Enhance error with authentication context
          error.message = "Authentication failed - token may be invalid";
          // Clear token on 401 to force refresh
          this.clientToken = null;
          this.tokenExpiresAt = null;
        }
        // Note: Don't convert to MisoClientError here - let the method handlers do it
        // This preserves the original error for the try-catch blocks in each method
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
      // Create a temporary axios instance without interceptors to avoid recursion
      const tempAxios = axios.create({
        baseURL: resolveControllerUrl(this.config),
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": this.config.clientId,
          "X-Client-Secret": this.config.clientSecret,
        },
      });

      const response =
        await tempAxios.post<ClientTokenResponse>("/api/v1/auth/token");

      // Handle both nested (new) and flat (old) response formats
      const token = response.data.data?.token || response.data.token;
      const expiresIn =
        response.data.data?.expiresIn || response.data.expiresIn;

      if (response.data.success && token) {
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
      // Check if it's an AxiosError to extract full response details
      if (this.isAxiosError(error)) {
        const responseDetails: string[] = [];

        if (error.response) {
          responseDetails.push(`status: ${error.response.status}`);
          responseDetails.push(`statusText: ${error.response.statusText}`);
          responseDetails.push(`data: ${JSON.stringify(error.response.data)}`);
          if (error.response.headers) {
            responseDetails.push(
              `headers: ${JSON.stringify(error.response.headers)}`,
            );
          }
        } else if (error.request) {
          responseDetails.push(`request: ${JSON.stringify(error.request)}`);
          responseDetails.push(`message: ${error.message}`);
        } else {
          responseDetails.push(`message: ${error.message}`);
        }

        throw new Error(
          `Failed to get client token: ${error.message}. ` +
            `Full response: {${responseDetails.join(", ")}} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
      }

      // Non-Axios error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Failed to get client token: ${errorMessage} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    }
  }

  /**
   * Check if error is an AxiosError (supports both instanceof and isAxiosError property)
   */
  private isAxiosError(error: unknown): error is AxiosError {
    if (error instanceof AxiosError) {
      return true;
    }
    // Support for mocked errors in tests
    if (
      typeof error === "object" &&
      error !== null &&
      "isAxiosError" in error
    ) {
      return (error as AxiosError).isAxiosError === true;
    }
    return false;
  }

  /**
   * Parse error response from AxiosError
   * Attempts to parse structured ErrorResponse, falls back to null if parsing fails
   */
  private parseErrorResponse(
    error: AxiosError,
    requestUrl?: string,
  ): ErrorResponse | null {
    try {
      // Check if response data exists
      if (!error.response?.data) {
        return null;
      }

      const data = error.response.data;

      // If data is already an object, check if it matches ErrorResponse structure
      if (typeof data === "object" && data !== null) {
        // Validate using type guard
        if (isErrorResponse(data)) {
          const errorResponse: ErrorResponse = {
            errors: (data as ErrorResponse).errors,
            type: (data as ErrorResponse).type,
            title: (data as ErrorResponse).title,
            statusCode: (data as ErrorResponse).statusCode,
            instance: (data as ErrorResponse).instance || requestUrl,
          };
          return errorResponse;
        }
      }

      // If data is a string, try to parse as JSON
      if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data);
          if (isErrorResponse(parsed)) {
            const errorResponse: ErrorResponse = {
              errors: parsed.errors,
              type: parsed.type,
              title: parsed.title,
              statusCode: parsed.statusCode,
              instance: parsed.instance || requestUrl,
            };
            return errorResponse;
          }
        } catch {
          // JSON parse failed, return null
          return null;
        }
      }

      return null;
    } catch {
      // Any parsing error, return null
      return null;
    }
  }

  /**
   * Create MisoClientError from AxiosError
   * Parses structured error response if available, falls back to errorBody
   */
  private createMisoClientError(
    error: AxiosError,
    requestUrl?: string,
  ): MisoClientError {
    // Extract status code
    const statusCode = error.response?.status;

    // Try to parse structured error response
    const errorResponse = this.parseErrorResponse(error, requestUrl);

    // Extract errorBody for backward compatibility
    let errorBody: Record<string, unknown> | undefined;
    if (error.response?.data && typeof error.response.data === "object") {
      errorBody = error.response.data as Record<string, unknown>;
    }

    // Generate default message
    let message = error.message || "Request failed";
    if (error.response) {
      message =
        error.response.statusText ||
        `Request failed with status code ${statusCode}`;
    }

    // Create MisoClientError (convert null to undefined)
    return new MisoClientError(
      message,
      errorResponse || undefined,
      errorBody,
      statusCode,
    );
  }

  /**
   * Get access to internal axios instance (for interceptors)
   */
  getAxiosInstance(): AxiosInstance {
    return this.axios;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.get<T>(url, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await this.axios.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await this.axios.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.delete<T>(url, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
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
