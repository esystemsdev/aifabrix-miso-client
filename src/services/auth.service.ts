/**
 * Authentication service for token validation and user management
 */

import { HttpClient } from "../utils/http-client";
import { ApiClient } from "../api";
import { CacheService } from "./cache.service";
import {
  UserInfo,
  AuthStrategy,
  LoginResponse,
  LogoutResponse,
  RefreshTokenResponse,
} from "../types/config.types";
import { handleAuthErrorSilent, isHttpStatus } from "./auth-error-handler";
import {
  createEnvTokenClient,
  extractTokenFromEnvResponse,
  fetchEnvironmentTokenResponse,
} from "./auth-environment-token";
import {
  clearTokenCache as clearTokenCacheHelper,
  clearUserCache as clearUserCacheHelper,
  extractUserIdFromToken,
  getCacheTtlFromToken,
  getTokenCacheKey,
} from "./auth-cache-helpers";

/** Cache data structure for token validation results */
interface TokenCacheData { authenticated: boolean; timestamp: number; }

/** Cache data structure for user info */
interface UserInfoCacheData { user: UserInfo; timestamp: number; }

export class AuthService {
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private cache: CacheService;
  private tokenValidationTTL: number;
  private minValidationTTL: number;
  private userTTL: number;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    const config = this.httpClient.config;
    this.tokenValidationTTL = config.cache?.tokenValidationTTL || 900; // 15 minutes default
    this.minValidationTTL = config.cache?.minValidationTTL || 60; // 60 seconds default
    this.userTTL = config.cache?.userTTL || 300; // 5 minutes default
  }

  /**
   * Check if token matches configured API key for testing
   * @private
   */
  private isApiKeyToken(token: string): boolean {
    const config = this.httpClient.config;
    return config.apiKey !== undefined && token === config.apiKey;
  }

  private buildAuthStrategyWithToken(
    token: string,
    authStrategy?: AuthStrategy,
  ): AuthStrategy {
    const authStrategyToUse = authStrategy || this.httpClient.config.authStrategy;
    return authStrategyToUse
      ? { ...authStrategyToUse, bearerToken: token }
      : { methods: ["bearer"], bearerToken: token };
  }

  private async getCachedUserInfo(cacheKey: string | null): Promise<UserInfo | null> {
    if (!cacheKey) return null;
    const cached = await this.cache.get<UserInfoCacheData>(cacheKey);
    return cached ? cached.user : null;
  }

  private async cacheUserInfo(cacheKey: string | null, user: UserInfo): Promise<void> {
    if (!cacheKey) return;
    await this.cache.set<UserInfoCacheData>(
      cacheKey,
      { user, timestamp: Date.now() },
      this.userTTL,
    );
  }

  private async getCachedTokenValidation(cacheKey: string): Promise<boolean | null> {
    const cached = await this.cache.get<TokenCacheData>(cacheKey);
    return cached ? cached.authenticated : null;
  }

  private async cacheTokenValidation(cacheKey: string, token: string, authenticated: boolean): Promise<void> {
    const ttl = getCacheTtlFromToken(
      token,
      this.tokenValidationTTL,
      this.minValidationTTL,
    );
    await this.cache.set<TokenCacheData>(
      cacheKey,
      { authenticated, timestamp: Date.now() },
      ttl,
    );
  }

  private mapUserInfo(user: { id: string; username: string; email: string }): UserInfo {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  }

  /**
   * Generate unique correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const clientPrefix = this.httpClient.config.clientId.substring(0, 10);
    return `${clientPrefix}-${timestamp}-${random}`;
  }

  /**
   * Get environment token using client credentials.
   * @returns Environment token string or empty string on error.
   */
  async getEnvironmentToken(): Promise<string> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.httpClient.config.clientId;
    const axiosTimeout = 4000;

    try {
      const { tempAxios, timeoutId, controller } = await createEnvTokenClient(
        this.httpClient.config,
        axiosTimeout,
        clientId,
      );
      const response = await fetchEnvironmentTokenResponse(
        tempAxios,
        timeoutId,
        controller,
        this.httpClient.config.clientTokenUri || "/api/v1/auth/token",
        axiosTimeout,
      );
      const token = extractTokenFromEnvResponse(response.data);
      if (response.status >= 200 && response.status < 300 && token) {
        return token;
      }
      handleAuthErrorSilent(
        new Error(`Invalid response format. Status: ${response.status}`),
        "Get environment token",
        correlationId,
        clientId,
      );
      return "";
    } catch (error) {
      handleAuthErrorSilent(error, "Get environment token", correlationId, clientId);
      return "";
    }
  }

  /**
   * Initiate login flow by calling controller. Returns login URL and state for browser redirect.
   * Your app only needs to know your own URLs and miso-controller - it handles OAuth callbacks with Keycloak.
   * @param params - Login parameters
   * @param params.redirect - Final destination URL in your app after authentication (e.g., 'https://myapp.com/dashboard')
   * @param params.state - Optional CSRF protection token (auto-generated by controller if omitted)
   * @returns Login response with loginUrl and state
   */
  async login(params: {
    redirect: string;
    state?: string;
  }): Promise<LoginResponse> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.httpClient.config.clientId;

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
      const authStrategy = this.httpClient.config.authStrategy;
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
      handleAuthErrorSilent(error, "Login", correlationId, clientId);
      return {
        success: false,
        data: { loginUrl: "", state: params.state || "" },
        timestamp: new Date().toISOString(),
      };
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
      const cacheKey = getTokenCacheKey(token);

      const cached = await this.getCachedTokenValidation(cacheKey);
      if (cached !== null) return cached;

      // Cache miss - fetch from controller using ApiClient
      const authStrategyWithToken = this.buildAuthStrategyWithToken(token, authStrategy);

      const result = await this.apiClient.auth.validateToken(
        { token },
        authStrategyWithToken,
      );

      const authenticated = result.data?.authenticated || false;

      await this.cacheTokenValidation(cacheKey, token, authenticated);

      return authenticated;
    } catch (error) {
      this.logAuthServiceError("Validate token", error, token, "/api/auth/validate");
      return false;
    }
  }

  /**
   * Get user information from token.
   * If API_KEY is configured and token matches, returns null (by design for testing).
   * @param token - User authentication token.
   * @param authStrategy - Optional authentication strategy override.
   * @returns User info or null when not available.
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
      const authStrategyWithToken = this.buildAuthStrategyWithToken(token, authStrategy);

      const result = await this.apiClient.auth.validateToken(
        { token },
        authStrategyWithToken,
      );

      if (result.data?.authenticated && result.data.user) {
        return this.mapUserInfo(result.data.user);
      }

      return null;
    } catch (error) {
      this.logAuthServiceError("Get user", error, token, "/api/auth/validate");
      return null;
    }
  }

  private logAuthServiceError(
    operation: string,
    error: unknown,
    token: string,
    path: string,
    method: "GET" | "POST" = "POST",
  ): void {
    const userId = extractUserIdFromToken(token);
    const statusCode =
      (error as { statusCode?: number })?.statusCode ||
      (error as { response?: { status?: number } })?.response?.status;
    console.error(`${operation} failed`, {
      operation,
      path,
      method,
      ipAddress: "unknown",
      userId: userId || undefined,
      statusCode,
      correlationId: (error as { correlationId?: string })?.correlationId,
      errorMessage: error instanceof Error ? error.message : String(error),
      stackTrace: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Get user information from GET /api/v1/auth/user endpoint
   * Caches user info by userId with configurable TTL (default 5 minutes)
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
      // Extract userId from token to check cache first (avoids API call on cache hit)
      const userId = extractUserIdFromToken(token);
      const cacheKey = userId ? `user:${userId}` : null;
      const cached = await this.getCachedUserInfo(cacheKey);
      if (cached) return cached;

      // Cache miss - fetch from controller
      const authStrategyWithToken = this.buildAuthStrategyWithToken(token, authStrategy);

      const result = await this.apiClient.auth.getUser(authStrategyWithToken);

      if (result.data?.authenticated && result.data.user) {
        const user = this.mapUserInfo(result.data.user);
        await this.cacheUserInfo(cacheKey, user);
        return user;
      }

      return null;
    } catch (error) {
      this.logAuthServiceError("Get user info", error, token, "/api/auth/user", "GET");
      return null;
    }
  }

  /**
   * Clear cached token validation result
   * Uses token hash for cache key (always clears regardless of token structure)
   * @param token - User authentication token
   */
  clearTokenCache(token: string): void {
    clearTokenCacheHelper(this.cache, token);
  }

  /**
   * Clear cached user info
   * Uses userId extracted from token for cache key
   * @param token - User authentication token
   */
  clearUserCache(token: string): void {
    clearUserCacheHelper(this.cache, token);
  }

  /**
   * Logout user. Gracefully handles no active session (400). Clears token/user caches.
   * @param params - Logout parameters with token to invalidate
   * @returns Logout response with success message
   */
  async logout(params: { token: string }): Promise<LogoutResponse> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.httpClient.config.clientId;

    try {
      // Use ApiClient for typed API call
      const response = await this.apiClient.auth.logoutWithToken(params.token);

      // Clear caches after successful logout
      this.clearTokenCache(params.token);
      this.clearUserCache(params.token);

      return response;
    } catch (error) {
      // Gracefully handle 400 Bad Request (no session, already logged out, etc.)
      if (isHttpStatus(error, 400)) {
        console.warn("Logout: No active session (400)", {
          correlationId,
        });
        this.clearTokenCache(params.token);
        this.clearUserCache(params.token);
        return { success: true, message: "Logout successful (no active session)", timestamp: new Date().toISOString() };
      }
      handleAuthErrorSilent(error, "Logout", correlationId, clientId);
      return {
        success: false,
        message: "Logout failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Refresh user access token using refresh token
   * @param refreshToken - Refresh token to exchange for new tokens
   * @returns New access token, refresh token, and expiration info, or null on error
   */
  async refreshToken(
    refreshToken: string,
    authStrategy?: AuthStrategy,
  ): Promise<RefreshTokenResponse | null> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.httpClient.config.clientId;

    try {
      // Use ApiClient for typed API call
      const authStrategyToUse = authStrategy || this.httpClient.config.authStrategy;
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
      return handleAuthErrorSilent(error, "Refresh token", correlationId, clientId);
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
