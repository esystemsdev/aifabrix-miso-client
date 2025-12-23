/**
 * Authentication service for token validation and user management
 */

import { HttpClient } from "../utils/http-client";
import { ApiClient } from "../api";
import { CacheService } from "./cache.service";
import {
  MisoClientConfig,
  UserInfo,
  AuthStrategy,
  LoginResponse,
  LogoutResponse,
  RefreshTokenResponse,
} from "../types/config.types";
import { MisoClientError } from "../utils/errors";
import { resolveControllerUrl } from "../utils/controller-url-resolver";
import jwt from "jsonwebtoken";

interface TokenCacheData {
  authenticated: boolean;
  timestamp: number;
}

export class AuthService {
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private cache: CacheService;
  private config: MisoClientConfig;
  private tokenValidationTTL: number;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.tokenValidationTTL = this.config.cache?.tokenValidationTTL || 900; // 15 minutes default
  }

  /**
   * Check if token matches configured API key for testing
   * @private
   */
  private isApiKeyToken(token: string): boolean {
    return this.config.apiKey !== undefined && token === this.config.apiKey;
  }

  /**
   * Extract userId from JWT token without making API call
   * @private
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded) return null;

      // Try common JWT claim fields for user ID
      return (decoded.sub ||
        decoded.userId ||
        decoded.user_id ||
        decoded.id) as string | null;
    } catch (error) {
      return null;
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
        baseURL: resolveControllerUrl(this.config),
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "x-client-id": this.config.clientId,
          "x-client-secret": this.config.clientSecret,
        },
      });

      const tokenUri = this.config.clientTokenUri || "/api/v1/auth/token";
      const response =
        await tempAxios.post<
          import("../types/config.types").ClientTokenResponse
        >(tokenUri);

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
            `request: [Request object - not serializable]`,
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

      // Use ApiClient for typed API call
      const authStrategy = this.config.authStrategy;
      const response = await this.apiClient.auth.login(
        { redirect: params.redirect, state: params.state },
        authStrategy,
      );

      // Convert ApiClient response format to service response format
      return {
        success: response.success,
        data: {
          loginUrl: response.data.loginUrl,
          state: response.data.state || '',
        },
        timestamp: response.timestamp,
      };
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
            `request: [Request object - not serializable]`,
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
   * Caches validation results by userId with configurable TTL (default 15 minutes)
   * If API_KEY is configured and token matches, returns true without calling controller
   * @param token - User authentication token
   * @param authStrategy - Optional authentication strategy override
   * @returns true if token is valid, false otherwise
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
      // Extract userId from token to check cache first (avoids API call on cache hit)
      const userId = this.extractUserIdFromToken(token);
      const cacheKey = userId ? `token:${userId}` : null;

      // Check cache first if we have userId
      if (cacheKey) {
        const cached = await this.cache.get<TokenCacheData>(cacheKey);
        if (cached) {
          return cached.authenticated;
        }
      }

      // Cache miss or no userId in token - fetch from controller using ApiClient
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken: AuthStrategy = authStrategyToUse 
        ? { ...authStrategyToUse, bearerToken: token }
        : { methods: ['bearer'], bearerToken: token };
      
      const result = await this.apiClient.auth.validateToken(
        { token },
        authStrategyWithToken,
      );

      const authenticated = result.data?.authenticated || false;

      // Cache the result if we have userId
      if (userId && cacheKey) {
        await this.cache.set<TokenCacheData>(
          cacheKey,
          { authenticated, timestamp: Date.now() },
          this.tokenValidationTTL,
        );
      }

      return authenticated;
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
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken: AuthStrategy = authStrategyToUse 
        ? { ...authStrategyToUse, bearerToken: token }
        : { methods: ['bearer'], bearerToken: token };
      
      const result = await this.apiClient.auth.validateToken(
        { token },
        authStrategyWithToken,
      );

      if (result.data?.authenticated && result.data.user) {
        return {
          id: result.data.user.id,
          username: result.data.user.username,
          email: result.data.user.email,
        };
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
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken: AuthStrategy = authStrategyToUse 
        ? { ...authStrategyToUse, bearerToken: token }
        : { methods: ['bearer'], bearerToken: token };
      
      const result = await this.apiClient.auth.getUser(authStrategyWithToken);

      if (result.data?.authenticated && result.data.user) {
        return {
          id: result.data.user.id,
          username: result.data.user.username,
          email: result.data.user.email,
        };
      }

      return null;
    } catch (error) {
      // Failed to get user info, return null
      return null;
    }
  }

  /**
   * Clear cached token validation result for a user
   * Extracts userId from JWT token directly (no API call)
   * @param token - User authentication token
   */
  clearTokenCache(token: string): void {
    try {
      const userId = this.extractUserIdFromToken(token);
      if (userId) {
        const cacheKey = `token:${userId}`;
        // Use void to ignore promise result - cache clearing should not block
        void this.cache.delete(cacheKey);
      }
    } catch (error) {
      // Log but don't throw - cache clearing failures should not break flow
      console.warn("Failed to clear token cache:", error);
    }
  }

  /**
   * Logout user
   * Gracefully handles cases where there's no active session (400 Bad Request)
   * Only throws errors for unexpected failures (network errors, 5xx errors, etc.)
   * Automatically clears token validation cache on logout
   * @param params - Logout parameters
   * @param params.token - Access token to invalidate
   * @returns Logout response with success message
   */
  async logout(params: { token: string }): Promise<LogoutResponse> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;

    try {
      // Use ApiClient for typed API call
      const response = await this.apiClient.auth.logoutWithToken(params.token);

      // Clear token cache after successful logout
      this.clearTokenCache(params.token);

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
          // Clear token cache even if logout returns 400 (idempotent behavior)
          this.clearTokenCache(params.token);
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
          // Clear token cache even if logout returns 400 (idempotent behavior)
          this.clearTokenCache(params.token);
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
            `request: [Request object - not serializable]`,
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
   * Refresh user access token using refresh token
   * @param refreshToken - Refresh token to exchange for new access token
   * @param authStrategy - Optional authentication strategy override
   * @returns New access token, refresh token, and expiration info, or null on error
   */
  async refreshToken(
    refreshToken: string,
    authStrategy?: AuthStrategy,
  ): Promise<RefreshTokenResponse | null> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;

    try {
      // Use ApiClient for typed API call
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const response = await this.apiClient.auth.refreshToken(
        { refreshToken },
        authStrategyToUse,
      );

      // Convert ApiClient response format to service response format
      if (response.data) {
        return {
          success: response.success,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken || refreshToken,
          expiresIn: response.data.expiresIn,
          expiresAt: response.timestamp,
          timestamp: response.timestamp,
        };
      }

      return null;
    } catch (error) {
      // Check if it's a MisoClientError (converted from AxiosError by HttpClient)
      if (error instanceof MisoClientError) {
        const errorDetails = {
          statusCode: error.statusCode,
          message: error.message,
          errorResponse: error.errorResponse,
          errorBody: error.errorBody,
        };
        console.error(
          `Refresh token failed: ${error.message}. ` +
            `Full response: ${JSON.stringify(errorDetails)} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
        return null;
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
            `request: [Request object - not serializable]`,
          );
          responseDetails.push(`message: ${axiosError.message}`);
        } else {
          responseDetails.push(`message: ${axiosError.message}`);
        }

        console.error(
          `Refresh token failed: ${axiosError.message}. ` +
            `Full response: {${responseDetails.join(", ")}} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
        return null;
      }

      // Non-Axios/MisoClientError (network errors, timeouts, etc.)
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Refresh token failed: ${errorMessage} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
      return null;
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
