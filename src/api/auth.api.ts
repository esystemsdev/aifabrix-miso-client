/**
 * Auth API client
 * Provides typed interfaces for all authentication-related controller API calls
 * Composed from specialized sub-modules to keep file size manageable
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import { AuthLoginApi } from './auth-login.api';
import { AuthTokenApi } from './auth-token.api';
import { AuthUserApi } from './auth-user.api';
import { AuthCacheApi } from './auth-cache.api';
import {
  LoginRequest,
  LoginResponse,
  DeviceCodeRequest,
  DeviceCodeResponse,
  DeviceCodeTokenRequest,
  DeviceCodeTokenResponse,
  DeviceCodeRefreshRequest,
  ValidateTokenRequest,
  ValidateTokenResponse,
  GetUserResponse,
  LogoutResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ClientTokenResponse,
  ClientTokenLegacyResponse,
  CallbackRequest,
  CallbackResponse,
  CacheStatsResponse,
  CachePerformanceResponse,
  CacheEfficiencyResponse,
  ClearCacheResponse,
  InvalidateCacheRequest,
  InvalidateCacheResponse,
  DiagnosticsResponse,
} from './types/auth.types';

/**
 * Auth API class
 * Centralizes all authentication-related endpoint URLs and provides typed methods
 * Delegates to specialized sub-modules to keep file size manageable
 * Note: Roles and permissions endpoints are handled by RolesApi and PermissionsApi respectively
 */
export class AuthApi {
  // Sub-modules for different auth concerns
  private readonly loginApi: AuthLoginApi;
  private readonly tokenApi: AuthTokenApi;
  private readonly userApi: AuthUserApi;
  private readonly cacheApi: AuthCacheApi;

  constructor(private httpClient: HttpClient) {
    this.loginApi = new AuthLoginApi(httpClient);
    this.tokenApi = new AuthTokenApi(httpClient);
    this.userApi = new AuthUserApi(httpClient);
    this.cacheApi = new AuthCacheApi(httpClient);
  }

  // Login methods - delegate to AuthLoginApi
  async login(
    params: LoginRequest,
    authStrategy?: AuthStrategy,
  ): Promise<LoginResponse> {
    return this.loginApi.login(params, authStrategy);
  }

  async initiateDeviceCode(
    params: DeviceCodeRequest,
    authStrategy?: AuthStrategy,
  ): Promise<DeviceCodeResponse> {
    return this.loginApi.initiateDeviceCode(params, authStrategy);
  }

  async pollDeviceCodeToken(
    params: DeviceCodeTokenRequest,
  ): Promise<DeviceCodeTokenResponse> {
    return this.loginApi.pollDeviceCodeToken(params);
  }

  async refreshDeviceCodeToken(
    params: DeviceCodeRefreshRequest,
  ): Promise<DeviceCodeTokenResponse> {
    return this.loginApi.refreshDeviceCodeToken(params);
  }

  async getLoginDiagnostics(
    environment?: string,
  ): Promise<DiagnosticsResponse> {
    return this.loginApi.getLoginDiagnostics(environment);
  }

  // Token methods - delegate to AuthTokenApi
  async getClientToken(
    authStrategy?: AuthStrategy,
  ): Promise<ClientTokenResponse> {
    return this.tokenApi.getClientToken(authStrategy);
  }

  async generateClientToken(
    authStrategy?: AuthStrategy,
  ): Promise<ClientTokenLegacyResponse> {
    return this.tokenApi.generateClientToken(authStrategy);
  }

  async validateToken(
    params: ValidateTokenRequest,
    authStrategy?: AuthStrategy,
  ): Promise<ValidateTokenResponse> {
    return this.tokenApi.validateToken(params, authStrategy);
  }

  async refreshToken(
    params: RefreshTokenRequest,
    authStrategy?: AuthStrategy,
  ): Promise<RefreshTokenResponse> {
    return this.tokenApi.refreshToken(params, authStrategy);
  }

  // User methods - delegate to AuthUserApi
  async getUser(authStrategy?: AuthStrategy): Promise<GetUserResponse> {
    return this.userApi.getUser(authStrategy);
  }

  async logout(): Promise<LogoutResponse> {
    return this.userApi.logout();
  }

  async logoutWithToken(token: string): Promise<LogoutResponse> {
    return this.userApi.logoutWithToken(token);
  }

  async handleCallback(
    params: CallbackRequest,
    authStrategy?: AuthStrategy,
  ): Promise<CallbackResponse> {
    return this.userApi.handleCallback(params, authStrategy);
  }

  // Cache methods - delegate to AuthCacheApi
  async getCacheStats(
    authStrategy?: AuthStrategy,
  ): Promise<CacheStatsResponse> {
    return this.cacheApi.getCacheStats(authStrategy);
  }

  async getCachePerformance(
    authStrategy?: AuthStrategy,
  ): Promise<CachePerformanceResponse> {
    return this.cacheApi.getCachePerformance(authStrategy);
  }

  async getCacheEfficiency(
    authStrategy?: AuthStrategy,
  ): Promise<CacheEfficiencyResponse> {
    return this.cacheApi.getCacheEfficiency(authStrategy);
  }

  async clearCache(
    authStrategy?: AuthStrategy,
  ): Promise<ClearCacheResponse> {
    return this.cacheApi.clearCache(authStrategy);
  }

  async invalidateCache(
    params: InvalidateCacheRequest,
    authStrategy?: AuthStrategy,
  ): Promise<InvalidateCacheResponse> {
    return this.cacheApi.invalidateCache(params, authStrategy);
  }
}
