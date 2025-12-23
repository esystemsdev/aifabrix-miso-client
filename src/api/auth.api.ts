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
  GetRolesQueryParams,
  GetRolesResponse,
  RefreshRolesResponse,
  GetPermissionsQueryParams,
  GetPermissionsResponse,
  RefreshPermissionsResponse,
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
 */
export class AuthApi {
  // Centralize endpoint URLs as constants (for roles/permissions which are still here)
  private static readonly ROLES_ENDPOINT = '/api/v1/auth/roles';
  private static readonly ROLES_REFRESH_ENDPOINT = '/api/v1/auth/roles/refresh';
  private static readonly PERMISSIONS_ENDPOINT = '/api/v1/auth/permissions';
  private static readonly PERMISSIONS_REFRESH_ENDPOINT = '/api/v1/auth/permissions/refresh';

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

  // Roles and Permissions methods - kept here for now (could be moved to separate modules)
  async getRoles(
    params?: GetRolesQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<GetRolesResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<GetRolesResponse>(
          'GET',
          AuthApi.ROLES_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<GetRolesResponse>(
          'GET',
          AuthApi.ROLES_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      throw new Error('getRoles requires authentication - provide authStrategy with bearerToken');
    } catch (error) {
      console.error('Get roles API call failed:', error);
      throw error;
    }
  }

  async refreshRoles(
    authStrategy?: AuthStrategy,
  ): Promise<RefreshRolesResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<RefreshRolesResponse>(
          'GET',
          AuthApi.ROLES_REFRESH_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<RefreshRolesResponse>(
          'GET',
          AuthApi.ROLES_REFRESH_ENDPOINT,
          authStrategy,
        );
      }
      throw new Error('refreshRoles requires authentication - provide authStrategy with bearerToken');
    } catch (error) {
      console.error('Refresh roles API call failed:', error);
      throw error;
    }
  }

  async getPermissions(
    params?: GetPermissionsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<GetPermissionsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<GetPermissionsResponse>(
          'GET',
          AuthApi.PERMISSIONS_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<GetPermissionsResponse>(
          'GET',
          AuthApi.PERMISSIONS_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      throw new Error('getPermissions requires authentication - provide authStrategy with bearerToken');
    } catch (error) {
      console.error('Get permissions API call failed:', error);
      throw error;
    }
  }

  async refreshPermissions(
    authStrategy?: AuthStrategy,
  ): Promise<RefreshPermissionsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<RefreshPermissionsResponse>(
          'GET',
          AuthApi.PERMISSIONS_REFRESH_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<RefreshPermissionsResponse>(
          'GET',
          AuthApi.PERMISSIONS_REFRESH_ENDPOINT,
          authStrategy,
        );
      }
      throw new Error('refreshPermissions requires authentication - provide authStrategy with bearerToken');
    } catch (error) {
      console.error('Refresh permissions API call failed:', error);
      throw error;
    }
  }
}
