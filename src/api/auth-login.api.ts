/**
 * Auth Login API client
 * Handles login, device code flow, and diagnostics
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import { logErrorWithContext } from '../utils/console-logger';
import { extractErrorInfo } from '../utils/error-extractor';
import {
  LoginRequest,
  LoginResponse,
  DeviceCodeRequest,
  DeviceCodeResponse,
  DeviceCodeTokenRequest,
  DeviceCodeTokenResponse,
  DeviceCodeRefreshRequest,
  DiagnosticsResponse,
} from './types/auth.types';

/**
 * Auth Login API class
 * Handles login-related endpoints
 */
export class AuthLoginApi {
  // Centralize endpoint URLs as constants
  private static readonly LOGIN_ENDPOINT = '/api/v1/auth/login';
  private static readonly DEVICE_CODE_TOKEN_ENDPOINT = '/api/v1/auth/login/device/token';
  private static readonly DEVICE_CODE_REFRESH_ENDPOINT = '/api/v1/auth/login/device/refresh';
  private static readonly LOGIN_DIAGNOSTICS_ENDPOINT = '/api/v1/auth/login/diagnostics';

  constructor(private httpClient: HttpClient) {}

  /**
   * Login user and get login URL (OAuth2 redirect flow)
   * @param params - Login request parameters
   * @param authStrategy - Optional authentication strategy override
   * @returns Login response with loginUrl and state
   */
  async login(
    params: LoginRequest,
    authStrategy?: AuthStrategy,
  ): Promise<LoginResponse> {
    try {
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<LoginResponse>(
          'GET',
          AuthLoginApi.LOGIN_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<LoginResponse>(
        'GET',
        AuthLoginApi.LOGIN_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthLoginApi.LOGIN_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[AuthLoginApi]');
      throw error;
    }
  }

  /**
   * Initiate device code flow
   * @param params - Device code request parameters
   * @param authStrategy - Optional authentication strategy override
   * @returns Device code response with deviceCode, userCode, and verificationUri
   */
  async initiateDeviceCode(
    params: DeviceCodeRequest,
    authStrategy?: AuthStrategy,
  ): Promise<DeviceCodeResponse> {
    try {
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<DeviceCodeResponse>(
          'POST',
          AuthLoginApi.LOGIN_ENDPOINT,
          authStrategy,
          params,
        );
      }
      return await this.httpClient.request<DeviceCodeResponse>(
        'POST',
        AuthLoginApi.LOGIN_ENDPOINT,
        params,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthLoginApi.LOGIN_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthLoginApi]');
      throw error;
    }
  }

  /**
   * Poll for device code token
   * @param params - Device code token request parameters
   * @returns Device code token response with accessToken
   */
  async pollDeviceCodeToken(
    params: DeviceCodeTokenRequest,
  ): Promise<DeviceCodeTokenResponse> {
    try {
      return await this.httpClient.request<DeviceCodeTokenResponse>(
        'POST',
        AuthLoginApi.DEVICE_CODE_TOKEN_ENDPOINT,
        params,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthLoginApi.DEVICE_CODE_TOKEN_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthLoginApi]');
      throw error;
    }
  }

  /**
   * Refresh device code token
   * @param params - Device code refresh request parameters
   * @returns Device code token response with accessToken
   */
  async refreshDeviceCodeToken(
    params: DeviceCodeRefreshRequest,
  ): Promise<DeviceCodeTokenResponse> {
    try {
      return await this.httpClient.request<DeviceCodeTokenResponse>(
        'POST',
        AuthLoginApi.DEVICE_CODE_REFRESH_ENDPOINT,
        params,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthLoginApi.DEVICE_CODE_REFRESH_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthLoginApi]');
      throw error;
    }
  }

  /**
   * Get login diagnostics
   * @param environment - Optional environment parameter
   * @returns Diagnostics response with database, controller, environment, and keycloak info
   */
  async getLoginDiagnostics(
    environment?: string,
  ): Promise<DiagnosticsResponse> {
    try {
      const params = environment ? { environment } : undefined;
      return await this.httpClient.request<DiagnosticsResponse>(
        'GET',
        AuthLoginApi.LOGIN_DIAGNOSTICS_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthLoginApi.LOGIN_DIAGNOSTICS_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[AuthLoginApi]');
      throw error;
    }
  }
}

