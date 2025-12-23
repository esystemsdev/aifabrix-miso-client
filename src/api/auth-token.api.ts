/**
 * Auth Token API client
 * Handles client tokens, token validation, and token refresh
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  ValidateTokenRequest,
  ValidateTokenResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ClientTokenResponse,
  ClientTokenLegacyResponse,
} from './types/auth.types';

/**
 * Auth Token API class
 * Handles token-related endpoints
 */
export class AuthTokenApi {
  // Centralize endpoint URLs as constants
  private static readonly CLIENT_TOKEN_ENDPOINT = '/api/v1/auth/client-token';
  private static readonly CLIENT_TOKEN_LEGACY_ENDPOINT = '/api/v1/auth/token';
  private static readonly VALIDATE_ENDPOINT = '/api/v1/auth/validate';
  private static readonly REFRESH_ENDPOINT = '/api/v1/auth/refresh';

  constructor(private httpClient: HttpClient) {}

  /**
   * Get client token (for frontend, origin validation)
   * @param authStrategy - Optional authentication strategy override
   * @returns Client token response with token and expiration
   */
  async getClientToken(
    authStrategy?: AuthStrategy,
  ): Promise<ClientTokenResponse> {
    try {
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<ClientTokenResponse>(
          'GET',
          AuthTokenApi.CLIENT_TOKEN_ENDPOINT,
          authStrategy,
        );
      }
      return await this.httpClient.request<ClientTokenResponse>(
        'GET',
        AuthTokenApi.CLIENT_TOKEN_ENDPOINT,
      );
    } catch (error) {
      console.error('Get client token API call failed:', error);
      throw error;
    }
  }

  /**
   * Generate client token (legacy endpoint, uses x-client-id/x-client-secret)
   * @param authStrategy - Optional authentication strategy override
   * @returns Client token legacy response with token and expiration
   */
  async generateClientToken(
    authStrategy?: AuthStrategy,
  ): Promise<ClientTokenLegacyResponse> {
    try {
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<ClientTokenLegacyResponse>(
          'POST',
          AuthTokenApi.CLIENT_TOKEN_LEGACY_ENDPOINT,
          authStrategy,
        );
      }
      return await this.httpClient.request<ClientTokenLegacyResponse>(
        'POST',
        AuthTokenApi.CLIENT_TOKEN_LEGACY_ENDPOINT,
      );
    } catch (error) {
      console.error('Generate client token API call failed:', error);
      throw error;
    }
  }

  /**
   * Validate user token
   * @param params - Validate token request parameters
   * @param authStrategy - Optional authentication strategy override
   * @returns Validation response with authenticated status and user info
   */
  async validateToken(
    params: ValidateTokenRequest,
    authStrategy?: AuthStrategy,
  ): Promise<ValidateTokenResponse> {
    try {
      return await this.httpClient.authenticatedRequest<ValidateTokenResponse>(
        'POST',
        AuthTokenApi.VALIDATE_ENDPOINT,
        params.token,
        params,
        undefined,
        authStrategy,
      );
    } catch (error) {
      console.error('Token validation API call failed:', error);
      throw error;
    }
  }

  /**
   * Refresh user access token
   * @param params - Refresh token request parameters
   * @param authStrategy - Optional authentication strategy override
   * @returns Refresh token response with new accessToken
   */
  async refreshToken(
    params: RefreshTokenRequest,
    authStrategy?: AuthStrategy,
  ): Promise<RefreshTokenResponse> {
    try {
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<RefreshTokenResponse>(
          'POST',
          AuthTokenApi.REFRESH_ENDPOINT,
          authStrategy,
          params,
        );
      }
      return await this.httpClient.request<RefreshTokenResponse>(
        'POST',
        AuthTokenApi.REFRESH_ENDPOINT,
        params,
      );
    } catch (error) {
      console.error('Refresh token API call failed:', error);
      throw error;
    }
  }
}

