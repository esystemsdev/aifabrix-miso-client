/**
 * Authentication service for token validation and user management
 */

import { HttpClient } from "../utils/http-client";
import { RedisService } from "./redis.service";
import {
  MisoClientConfig,
  UserInfo,
  AuthResult,
  AuthStrategy,
  LoginResponse,
  LogoutResponse,
} from "../types/config.types";
import { MisoClientError } from "../utils/errors";

export class AuthService {
  private httpClient: HttpClient;
  private redis: RedisService;
  private config: MisoClientConfig;

  constructor(httpClient: HttpClient, redis: RedisService) {
    this.config = httpClient.config;
    this.redis = redis;
    this.httpClient = httpClient;
  }

  /**
   * Check if token matches configured API key for testing
   * @private
   */
  private isApiKeyToken(token: string): boolean {
    return this.config.apiKey !== undefined && token === this.config.apiKey;
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
   * Get environment token using client credentials
   * This is called automatically by HttpClient, but can be called manually if needed
   */
  async getEnvironmentToken(): Promise<string> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;

    try {
      // Use a temporary axios instance to avoid interceptor recursion
      const axios = (await import("axios")).default;
      const tempAxios = axios.create({
        baseURL: this.config.controllerUrl,
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": this.config.clientId,
          "X-Client-Secret": this.config.clientSecret,
        },
      });

      const response =
        await tempAxios.post<
          import("../types/config.types").ClientTokenResponse
        >("/api/v1/auth/token");

      // Handle both nested (new) and flat (old) response formats
      const token = response.data.data?.token || response.data.token;
      if (response.data.success && token) {
        return token;
      }

      // Invalid response format - include full response details
      const responseDetails = JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });
      throw new Error(
        `Failed to get environment token: Invalid response format. Expected {success: true, token: string}. ` +
          `Full response: ${responseDetails} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    } catch (error) {
      // Check if it's an AxiosError to extract full response details
      if (
        error &&
        typeof error === "object" &&
        "isAxiosError" in error &&
        error.isAxiosError
      ) {
        const axiosError = error as import("axios").AxiosError;
        const responseDetails: string[] = [];

        if (axiosError.response) {
          responseDetails.push(`status: ${axiosError.response.status}`);
          responseDetails.push(`statusText: ${axiosError.response.statusText}`);
          responseDetails.push(
            `data: ${JSON.stringify(axiosError.response.data)}`,
          );
          if (axiosError.response.headers) {
            responseDetails.push(
              `headers: ${JSON.stringify(axiosError.response.headers)}`,
            );
          }
        } else if (axiosError.request) {
          responseDetails.push(
            `request: ${JSON.stringify(axiosError.request)}`,
          );
          responseDetails.push(`message: ${axiosError.message}`);
        } else {
          responseDetails.push(`message: ${axiosError.message}`);
        }

        throw new Error(
          `Failed to get environment token: ${axiosError.message}. ` +
            `Full response: {${responseDetails.join(", ")}} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
      }

      // Non-Axios error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Failed to get environment token: ${errorMessage} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    }
  }

  /**
   * Initiate login flow by calling controller
   * Returns the login URL and state for browser redirect or manual navigation
   * 
   * Important: Your application only needs to know about your own app URLs and the miso-controller.
   * The miso-controller manages all authentication flows internally, including OAuth callbacks with Keycloak.
   * You don't need to handle OAuth callbacks in your application.
   * 
   * @param params - Login parameters
   * @param params.redirect - Required final destination URL in your application where the user should be redirected after successful authentication. This is a URL in your app (e.g., 'https://myapp.com/dashboard'). The miso-controller handles the OAuth callback internally and then redirects the user to this URL.
   * @param params.state - Optional CSRF protection token (auto-generated by controller if omitted)
   * @returns Login response with loginUrl (the Keycloak authentication URL) and state
   */
  async login(params: {
    redirect: string;
    state?: string;
  }): Promise<LoginResponse> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;

    try {
      // Build query parameters
      const queryParams: Record<string, string> = {
        redirect: params.redirect,
      };

      // Add state if provided
      if (params.state) {
        queryParams.state = params.state;
      }

      // Make GET request with query parameters
      const response = await this.httpClient.request<LoginResponse>(
        "GET",
        "/api/v1/auth/login",
        undefined,
        {
          params: queryParams,
        },
      );

      return response;
    } catch (error) {
      // Check if it's a MisoClientError (converted from AxiosError by HttpClient)
      if (error instanceof MisoClientError) {
        const errorDetails = {
          statusCode: error.statusCode,
          message: error.message,
          errorResponse: error.errorResponse,
          errorBody: error.errorBody,
        };
        throw new Error(
          `Login failed: ${error.message}. ` +
            `Full response: ${JSON.stringify(errorDetails)} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
      }

      // Check if it's an AxiosError (shouldn't happen after HttpClient, but handle just in case)
      if (
        error &&
        typeof error === "object" &&
        "isAxiosError" in error &&
        error.isAxiosError
      ) {
        const axiosError = error as import("axios").AxiosError;
        const responseDetails: string[] = [];

        if (axiosError.response) {
          responseDetails.push(`status: ${axiosError.response.status}`);
          responseDetails.push(`statusText: ${axiosError.response.statusText}`);
          responseDetails.push(
            `data: ${JSON.stringify(axiosError.response.data)}`,
          );
          if (axiosError.response.headers) {
            responseDetails.push(
              `headers: ${JSON.stringify(axiosError.response.headers)}`,
            );
          }
        } else if (axiosError.request) {
          responseDetails.push(
            `request: ${JSON.stringify(axiosError.request)}`,
          );
          responseDetails.push(`message: ${axiosError.message}`);
        } else {
          responseDetails.push(`message: ${axiosError.message}`);
        }

        throw new Error(
          `Login failed: ${axiosError.message}. ` +
            `Full response: {${responseDetails.join(", ")}} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
      }

      // Non-Axios/MisoClientError (network errors, timeouts, etc.)
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Login failed: ${errorMessage} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    }
  }

  /**
   * Validate token with controller
   * If API_KEY is configured and token matches, returns true without calling controller
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async validateToken(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    // Check API_KEY bypass for testing
    if (this.isApiKeyToken(token)) {
      return true;
    }

    try {
      const result = await this.httpClient.validateTokenRequest<AuthResult>(
        token,
        authStrategy,
      );
      return result.authenticated;
    } catch (error) {
      // Token validation failed, return false
      return false;
    }
  }

  /**
   * Get user information from token
   * If API_KEY is configured and token matches, returns null (by design for testing)
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getUser(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<UserInfo | null> {
    // Check API_KEY bypass for testing - return null by design
    if (this.isApiKeyToken(token)) {
      return null;
    }

    try {
      const result = await this.httpClient.validateTokenRequest<AuthResult>(
        token,
        authStrategy,
      );

      if (result.authenticated && result.user) {
        return result.user;
      }

      return null;
    } catch (error) {
      // Failed to get user info, return null
      return null;
    }
  }

  /**
   * Get user information from GET /api/v1/auth/user endpoint
   * If API_KEY is configured and token matches, returns null (by design for testing)
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async getUserInfo(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<UserInfo | null> {
    // Check API_KEY bypass for testing - return null by design
    if (this.isApiKeyToken(token)) {
      return null;
    }

    try {
      const user = await this.httpClient.authenticatedRequest<UserInfo>(
        "GET",
        "/api/v1/auth/user",
        token,
        undefined,
        undefined,
        authStrategy,
      );

      return user;
    } catch (error) {
      // Failed to get user info, return null
      return null;
    }
  }

  /**
   * Logout user
   * Gracefully handles cases where there's no active session (400 Bad Request)
   * Only throws errors for unexpected failures (network errors, 5xx errors, etc.)
   * @param params - Logout parameters
   * @param params.token - Access token to invalidate
   * @returns Logout response with success message
   */
  async logout(params: { token: string }): Promise<LogoutResponse> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;

    try {
      // Backend extracts app/env from client token
      const response = await this.httpClient.request<LogoutResponse>(
        "POST",
        "/api/v1/auth/logout",
        { token: params.token },
      );

      return response;
    } catch (error) {
      // Check if it's a MisoClientError (converted from AxiosError by HttpClient)
      if (error instanceof MisoClientError) {
        // Gracefully handle 400 Bad Request (no session, already logged out, etc.)
        if (error.statusCode === 400) {
          // Log the response for debugging but return a success response
          const errorDetails = {
            statusCode: error.statusCode,
            message: error.message,
            errorResponse: error.errorResponse,
            errorBody: error.errorBody,
          };
          console.warn(
            `Logout: No active session or invalid request (400). ` +
              `Response: ${JSON.stringify(errorDetails)} [correlationId: ${correlationId}, clientId: ${clientId}]`,
          );
          // Return a success response - logout is idempotent
          return {
            success: true,
            message: "Logout successful (no active session)",
            timestamp: new Date().toISOString(),
          };
        }

        // For other HTTP errors (401, 403, 500, etc.), include full details
        const errorDetails = {
          statusCode: error.statusCode,
          message: error.message,
          errorResponse: error.errorResponse,
          errorBody: error.errorBody,
        };
        throw new Error(
          `Logout failed: ${error.message}. ` +
            `Full response: ${JSON.stringify(errorDetails)} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
      }

      // Check if it's an AxiosError (shouldn't happen after HttpClient, but handle just in case)
      if (
        error &&
        typeof error === "object" &&
        "isAxiosError" in error &&
        error.isAxiosError
      ) {
        const axiosError = error as import("axios").AxiosError;

        // Gracefully handle 400 Bad Request
        if (axiosError.response?.status === 400) {
          const responseData = axiosError.response.data
            ? JSON.stringify(axiosError.response.data)
            : "No response data";
          console.warn(
            `Logout: No active session or invalid request (400). ` +
              `Response: ${responseData} [correlationId: ${correlationId}, clientId: ${clientId}]`,
          );
          // Return a success response - logout is idempotent
          return {
            success: true,
            message: "Logout successful (no active session)",
            timestamp: new Date().toISOString(),
          };
        }

        // For other HTTP errors, include full details
        const responseDetails: string[] = [];
        if (axiosError.response) {
          responseDetails.push(`status: ${axiosError.response.status}`);
          responseDetails.push(`statusText: ${axiosError.response.statusText}`);
          responseDetails.push(
            `data: ${JSON.stringify(axiosError.response.data)}`,
          );
          if (axiosError.response.headers) {
            responseDetails.push(
              `headers: ${JSON.stringify(axiosError.response.headers)}`,
            );
          }
        } else if (axiosError.request) {
          responseDetails.push(
            `request: ${JSON.stringify(axiosError.request)}`,
          );
          responseDetails.push(`message: ${axiosError.message}`);
        } else {
          responseDetails.push(`message: ${axiosError.message}`);
        }

        throw new Error(
          `Logout failed: ${axiosError.message}. ` +
            `Full response: {${responseDetails.join(", ")}} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
      }

      // Non-Axios/MisoClientError (network errors, timeouts, etc.) - these should throw
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Logout failed: ${errorMessage} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    }
  }

  /**
   * Check if user is authenticated (has valid token)
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   */
  async isAuthenticated(
    token: string,
    authStrategy?: AuthStrategy,
  ): Promise<boolean> {
    return this.validateToken(token, authStrategy);
  }
}
