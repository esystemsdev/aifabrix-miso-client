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
import { resolveControllerUrl } from "../utils/controller-url-resolver";
import jwt from "jsonwebtoken";
import { handleAuthError, handleAuthErrorSilent, isHttpStatus } from "./auth-error-handler";

/** Cache data structure for token validation results */
interface TokenCacheData { authenticated: boolean; timestamp: number; }

/** Cache data structure for user info */
interface UserInfoCacheData { user: UserInfo; timestamp: number; }

export class AuthService {
  private httpClient: HttpClient;
  private apiClient: ApiClient;
  private cache: CacheService;
  private config: MisoClientConfig;
  private tokenValidationTTL: number;
  private minValidationTTL: number;
  private userTTL: number;

  constructor(httpClient: HttpClient, apiClient: ApiClient, cache: CacheService) {
    this.config = httpClient.config;
    this.cache = cache;
    this.httpClient = httpClient;
    this.apiClient = apiClient;
    this.tokenValidationTTL = this.config.cache?.tokenValidationTTL || 900; // 15 minutes default
    this.minValidationTTL = this.config.cache?.minValidationTTL || 60; // 60 seconds default
    this.userTTL = this.config.cache?.userTTL || 300; // 5 minutes default
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

  /** Extract token from response (handles nested and flat formats) */
  private extractTokenFromEnvResponse(data: unknown): string | undefined {
    const rd = data as Record<string, unknown>;
    const dataObj = rd?.data as Record<string, unknown> | undefined;
    const nestedData = dataObj?.data as Record<string, unknown> | undefined;
    return (nestedData?.token || dataObj?.token || rd?.token) as string | undefined;
  }

  /** Get environment token using client credentials */
  async getEnvironmentToken(): Promise<string> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;
    const axiosTimeout = 4000;

    try {
      const axios = (await import("axios")).default;
      const http = await import("http");
      const https = await import("https");
      const controllerUrl = resolveControllerUrl(this.config);
      const isHttps = controllerUrl.startsWith("https://");
      const agentOpts = { family: 4, timeout: axiosTimeout };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), axiosTimeout);

      const tempAxios = axios.create({
        baseURL: controllerUrl, timeout: axiosTimeout, signal: controller.signal,
        httpAgent: !isHttps ? new http.Agent(agentOpts) : undefined,
        httpsAgent: isHttps ? new https.Agent(agentOpts) : undefined,
        headers: { "Content-Type": "application/json", "x-client-id": clientId, "x-client-secret": this.config.clientSecret },
      });

      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Request timeout after ${axiosTimeout}ms`)), axiosTimeout));
      let response;
      try {
        response = await Promise.race([tempAxios.post<import("../types/config.types").ClientTokenResponse>(this.config.clientTokenUri || "/api/v1/auth/token"), timeoutPromise]);
        clearTimeout(timeoutId);
      } catch (e) { clearTimeout(timeoutId); throw e; }

      const token = this.extractTokenFromEnvResponse(response.data);
      if (response.status >= 200 && response.status < 300 && token) return token;
      throw new Error(`Invalid response format. Status: ${response.status}`);
    } catch (error) {
      handleAuthError(error, "Get environment token", correlationId, clientId);
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
      handleAuthError(error, "Login", correlationId, clientId);
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
      const userId = this.extractUserIdFromToken(token);
      const cacheKey = userId ? `user:${userId}` : null;

      // Check cache first if we have userId
      if (cacheKey) {
        const cached = await this.cache.get<UserInfoCacheData>(cacheKey);
        if (cached) {
          return cached.user;
        }
      }

      // Cache miss - fetch from controller
      const authStrategyToUse = authStrategy || this.config.authStrategy;
      const authStrategyWithToken: AuthStrategy = authStrategyToUse 
        ? { ...authStrategyToUse, bearerToken: token }
        : { methods: ['bearer'], bearerToken: token };
      
      const result = await this.apiClient.auth.getUser(authStrategyWithToken);

      if (result.data?.authenticated && result.data.user) {
        const user: UserInfo = {
          id: result.data.user.id,
          username: result.data.user.username,
          email: result.data.user.email,
        };

        // Cache the result if we have userId
        if (cacheKey) {
          await this.cache.set<UserInfoCacheData>(
            cacheKey,
            { user, timestamp: Date.now() },
            this.userTTL,
          );
        }

        return user;
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
   * Clear cached user info
   * Uses userId extracted from token for cache key
   * @param token - User authentication token
   */
  clearUserCache(token: string): void {
    try {
      const userId = this.extractUserIdFromToken(token);
      if (userId) {
        // Use void to ignore promise result - cache clearing should not block
        void this.cache.delete(`user:${userId}`);
      }
    } catch (error) {
      // Log but don't throw - cache clearing failures should not break flow
      console.warn("Failed to clear user cache:", error);
    }
  }

  /**
   * Logout user. Gracefully handles no active session (400). Clears token/user caches.
   * @param params - Logout parameters with token to invalidate
   * @returns Logout response with success message
   */
  async logout(params: { token: string }): Promise<LogoutResponse> {
    const correlationId = this.generateCorrelationId();
    const clientId = this.config.clientId;

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
        console.warn(`Logout: No active session (400) [correlationId: ${correlationId}]`);
        this.clearTokenCache(params.token);
        this.clearUserCache(params.token);
        return { success: true, message: "Logout successful (no active session)", timestamp: new Date().toISOString() };
      }
      handleAuthError(error, "Logout", correlationId, clientId);
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
