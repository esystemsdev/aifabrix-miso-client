/**
 * Authentication service for token validation and user management
 */

import crypto from "crypto";
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
  private minValidationTTL: number;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.tokenValidationTTL = this.config.cache?.tokenValidationTTL || 900; // 15 minutes default
    this.minValidationTTL = this.config.cache?.minValidationTTL || 60; // 60 seconds default
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
   * Generate cache key using SHA-256 hash of token (security)
   * Uses token hash instead of userId to avoid exposing user information in cache keys
   * @param token - JWT token
   * @returns Cache key in format token_validation:{hash}
   */
  private getTokenCacheKey(token: string): string {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    return `token_validation:${hash}`;
  }

  /**
   * Calculate smart TTL based on token expiration
   * Uses min(token_exp - now - 30s buffer, tokenValidationTTL)
   * with minimum minValidationTTL (default 60s), maximum tokenValidationTTL
   * @param token - JWT token
   * @returns TTL in seconds
   */
  private getCacheTtlFromToken(token: string): number {
    const BUFFER_SECONDS = 30; // 30 second safety buffer

    try {
      const decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded || typeof decoded.exp !== "number") {
        return this.tokenValidationTTL; // Fallback to configured TTL
      }

      const now = Math.floor(Date.now() / 1000);
      const tokenTtl = decoded.exp - now - BUFFER_SECONDS;

      // Clamp between minValidationTTL and tokenValidationTTL
      return Math.max(
        this.minValidationTTL,
        Math.min(tokenTtl, this.tokenValidationTTL),
      );
    } catch {
      return this.tokenValidationTTL;
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
      // resolveControllerUrl already handles localhost -> 127.0.0.1 conversion
      const controllerUrl = resolveControllerUrl(this.config);
      const tokenUri = this.config.clientTokenUri || "/api/v1/auth/token";
      const fullUrl = `${controllerUrl}${tokenUri}`;
      
      // Use shorter timeout (4 seconds) to match handler timeout (5 seconds)
      // This ensures axios fails before the handler timeout wrapper
      // Wrap axios call in Promise.race to ensure it always times out
      const axiosTimeout = 4000; // 4 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, axiosTimeout);
      
      // Force IPv4 to avoid IPv6 connection issues (localhost resolves to both ::1 and 127.0.0.1)
      // Use http/https agent with family: 4 to force IPv4
      const http = await import("http");
      const https = await import("https");
      const isHttps = controllerUrl.startsWith("https://");
      const httpAgent = isHttps
        ? new https.Agent({ family: 4, timeout: axiosTimeout })
        : new http.Agent({ family: 4, timeout: axiosTimeout });
      
      const tempAxios = axios.create({
        baseURL: controllerUrl,
        timeout: axiosTimeout, // Request timeout
        signal: controller.signal, // Abort signal for connection timeout
        httpAgent: !isHttps ? httpAgent : undefined,
        httpsAgent: isHttps ? httpAgent : undefined,
        headers: {
          "Content-Type": "application/json",
          "x-client-id": this.config.clientId,
          "x-client-secret": this.config.clientSecret,
        },
      });

      console.log(`[getEnvironmentToken] Calling controller: ${fullUrl} [correlationId: ${correlationId}, clientId: ${clientId}]`);
      
      // Wrap in Promise.race to ensure timeout even if axios hangs
      const axiosPromise = tempAxios.post<
        import("../types/config.types").ClientTokenResponse
      >(tokenUri);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${axiosTimeout}ms`));
        }, axiosTimeout);
      });
      
      let response;
      try {
        response = await Promise.race([axiosPromise, timeoutPromise]);
        clearTimeout(timeoutId); // Clear timeout on success
        console.log(`[getEnvironmentToken] Successfully received response from controller [correlationId: ${correlationId}]`);
      } catch (requestError) {
        clearTimeout(timeoutId); // Clear timeout on error
        console.error(`[getEnvironmentToken] Request failed: ${requestError instanceof Error ? requestError.message : String(requestError)} [correlationId: ${correlationId}]`);
        throw requestError; // Re-throw to be handled by outer catch
      }

      // Handle multiple response formats:
      // 1. Nested format: { success: true, data: { data: { token: "...", expiresIn: 900 } } }
      // 2. Standard format: { success: true, data: { token: "...", expiresIn: 900 } }
      // 3. Flat format: { success: true, token: "...", expiresIn: 900 }
      // 4. Axios wrapped: { status: 200, data: { data: { token: "...", expiresIn: 900 } } }
      
      // Type assertion to handle various response formats
      const responseData = response.data as unknown as Record<string, unknown>;
      let token: string | undefined;
      
      // Try nested data.data.token first (controller response wrapped in axios)
      if (
        responseData?.data &&
        typeof responseData.data === "object" &&
        responseData.data !== null &&
        "data" in responseData.data &&
        typeof (responseData.data as Record<string, unknown>).data === "object" &&
        (responseData.data as Record<string, unknown>).data !== null &&
        "token" in ((responseData.data as Record<string, unknown>).data as Record<string, unknown>)
      ) {
        token = ((responseData.data as Record<string, unknown>).data as Record<string, unknown>).token as string;
      }
      // Try data.data.token (standard nested format)
      else if (
        responseData?.data &&
        typeof responseData.data === "object" &&
        responseData.data !== null &&
        "token" in (responseData.data as Record<string, unknown>)
      ) {
        token = (responseData.data as Record<string, unknown>).token as string;
      }
      // Try data.token (flat format)
      else if (responseData?.token && typeof responseData.token === "string") {
        token = responseData.token;
      }
      
      // Check if we have a token and response indicates success
      // Accept response if status is 2xx and we have a token, even without explicit success field
      // Controller may return 200 (OK) or 201 (Created) for token creation
      const hasSuccessField = 
        responseData?.success === true || 
        (responseData?.data &&
          typeof responseData.data === "object" &&
          responseData.data !== null &&
          "success" in (responseData.data as Record<string, unknown>) &&
          (responseData.data as Record<string, unknown>).success === true);
      
      // Accept any 2xx status code (200 OK, 201 Created, etc.)
      const isSuccess = response.status >= 200 && response.status < 300 && (hasSuccessField || token !== undefined);
      
      if (isSuccess && token) {
        console.log(`[getEnvironmentToken] Successfully received token from controller [correlationId: ${correlationId}]`);
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
        `Failed to get environment token: Invalid response format. Expected token in response. ` +
          `Full response: ${responseDetails} [correlationId: ${correlationId}, clientId: ${clientId}]`,
      );
    } catch (error) {
      // Check if it's an AbortError (timeout/abort signal) or ECONNABORTED
      const isAbortError = 
        (error && typeof error === "object" && "name" in error && error.name === "AbortError") ||
        (error && typeof error === "object" && "code" in error && error.code === "ECONNABORTED") ||
        (error instanceof Error && (error.message.includes("aborted") || error.message.includes("timeout")));
      
      if (isAbortError) {
        const controllerUrl = resolveControllerUrl(this.config);
        const tokenUri = this.config.clientTokenUri || "/api/v1/auth/token";
        console.error(
          `[getEnvironmentToken] Request aborted/timeout: ${controllerUrl}${tokenUri} [correlationId: ${correlationId}, clientId: ${clientId}]`,
          error instanceof Error ? error.message : String(error)
        );
        throw new Error(
          `Failed to get environment token: Request timeout or aborted. ` +
            `Controller: ${controllerUrl}${tokenUri} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
      }
      
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
          // HTTP error response (like 401, 403, etc.)
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
          // Network/timeout error - controller unreachable
          const controllerUrl = resolveControllerUrl(this.config);
          const tokenUri = this.config.clientTokenUri || "/api/v1/auth/token";
          console.error(
            `[getEnvironmentToken] Controller unreachable or timeout: ${controllerUrl}${tokenUri} [correlationId: ${correlationId}, clientId: ${clientId}]`,
            axiosError.message
          );
          responseDetails.push(
            `request: [Request object - not serializable]`,
          );
          responseDetails.push(`message: ${axiosError.message}`);
          responseDetails.push(`controllerUrl: ${controllerUrl}`);
        } else {
          responseDetails.push(`message: ${axiosError.message}`);
        }

        // Preserve axios error for proper error handling upstream
        const tokenError = new Error(
          `Failed to get environment token: ${axiosError.message}. ` +
            `Full response: {${responseDetails.join(", ")}} [correlationId: ${correlationId}, clientId: ${clientId}]`,
        );
        // Attach original axios error as cause for error chain traversal
        (tokenError as Error & { cause?: unknown }).cause = axiosError;
        throw tokenError;
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
   * Caches validation results by token hash with smart TTL based on token expiration
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
      // Generate cache key using token hash (security - no userId exposure)
      const cacheKey = this.getTokenCacheKey(token);

      // Check cache first
      const cached = await this.cache.get<TokenCacheData>(cacheKey);
      if (cached) {
        return cached.authenticated;
      }

      // Cache miss - fetch from controller using ApiClient
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken: AuthStrategy = authStrategyToUse
        ? { ...authStrategyToUse, bearerToken: token }
        : { methods: ["bearer"], bearerToken: token };

      const result = await this.apiClient.auth.validateToken(
        { token },
        authStrategyWithToken,
      );

      const authenticated = result.data?.authenticated || false;

      // Cache the result with smart TTL based on token expiration
      const ttl = this.getCacheTtlFromToken(token);
      await this.cache.set<TokenCacheData>(
        cacheKey,
        { authenticated, timestamp: Date.now() },
        ttl,
      );

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
   * Clear cached token validation result
   * Uses token hash for cache key (always clears regardless of token structure)
   * @param token - User authentication token
   */
  clearTokenCache(token: string): void {
    try {
      const cacheKey = this.getTokenCacheKey(token);
      // Use void to ignore promise result - cache clearing should not block
      void this.cache.delete(cacheKey);
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
