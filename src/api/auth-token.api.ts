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
import { extractErrorInfo } from '../utils/error-extractor';
import { logErrorWithContext } from '../utils/console-logger';

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
          'POST',
          AuthTokenApi.CLIENT_TOKEN_ENDPOINT,
          authStrategy,
        );
      }
      // For frontend client-token endpoint, it uses origin validation (no client-secret needed)
      // But we still need to prevent interceptor from trying to add x-client-token
      // The interceptor will see x-client-id and skip adding x-client-token
      const response = await this.httpClient.request<Record<string, unknown>>(
        'POST',
        AuthTokenApi.CLIENT_TOKEN_ENDPOINT,
        undefined, // no body
        {
          headers: {
            // Set x-client-id so interceptor skips adding x-client-token
            // Frontend endpoint uses origin validation, not client-secret
            'x-client-id': this.httpClient.config.clientId || '',
          },
        },
      );

      // Transform response to match ClientTokenResponse format
      // Handle both formats: {success: true, data: {token: ...}} and {data: {token: ...}}
      if (response.success !== undefined) {
        // Already in expected format
        return response as unknown as ClientTokenResponse;
      } else if (response.data && typeof response.data === 'object') {
        const data = response.data as Record<string, unknown>;
        if (typeof data.token === 'string') {
          // New nested format without success field - add it
          return {
            success: true,
            data: {
              token: data.token,
              expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : 0,
              expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : new Date().toISOString(),
            },
            timestamp: typeof response.timestamp === 'string' ? response.timestamp : new Date().toISOString(),
          };
        }
      }

      // If we get here, response format is unexpected
      throw new Error(`Unexpected response format from client-token endpoint: ${JSON.stringify(response)}`);
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthTokenApi.CLIENT_TOKEN_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthTokenApi]');
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
      // For token endpoint, explicitly send x-client-id and x-client-secret headers
      // to prevent interceptor from trying to add x-client-token (which doesn't exist yet - chicken/egg problem)
      // The interceptor will see x-client-id and skip adding x-client-token
      const response = await this.httpClient.request<Record<string, unknown>>(
        'POST',
        AuthTokenApi.CLIENT_TOKEN_LEGACY_ENDPOINT,
        undefined, // no body
        {
          headers: {
            // Set both headers so interceptor skips adding x-client-token
            'x-client-id': this.httpClient.config.clientId || '',
            'x-client-secret': this.httpClient.config.clientSecret || '',
          },
        },
      );

      // Transform response to match ClientTokenLegacyResponse format
      // Handle both formats: {success: true, token: ...} and {data: {token: ...}}
      if (response.success !== undefined) {
        // Already in legacy format
        return response as unknown as ClientTokenLegacyResponse;
      } else if (response.data && typeof response.data === 'object') {
        const data = response.data as Record<string, unknown>;
        if (typeof data.token === 'string') {
          // New nested format - transform to legacy format
          return {
            success: true,
            token: data.token,
            expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : 0,
            expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : new Date().toISOString(),
            timestamp: typeof response.timestamp === 'string' ? response.timestamp : new Date().toISOString(),
          };
        }
      } else if (typeof response.token === 'string') {
        // Flat format without success field - add it
        return {
          success: true,
          token: response.token,
          expiresIn: typeof response.expiresIn === 'number' ? response.expiresIn : 0,
          expiresAt: typeof response.expiresAt === 'string' ? response.expiresAt : new Date().toISOString(),
          timestamp: typeof response.timestamp === 'string' ? response.timestamp : new Date().toISOString(),
        };
      }

      // If we get here, response format is unexpected
      throw new Error(`Unexpected response format from token endpoint: ${JSON.stringify(response)}`);
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthTokenApi.CLIENT_TOKEN_LEGACY_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthTokenApi]');
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
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthTokenApi.VALIDATE_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthTokenApi]');
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
      const errorInfo = extractErrorInfo(error, {
        endpoint: AuthTokenApi.REFRESH_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[AuthTokenApi]');
      throw error;
    }
  }
}

