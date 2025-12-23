/**
 * Auth User API client
 * Handles user info, logout, and callback
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  GetUserResponse,
  LogoutResponse,
  CallbackRequest,
  CallbackResponse,
} from './types/auth.types';

/**
 * Auth User API class
 * Handles user-related endpoints
 */
export class AuthUserApi {
  // Centralize endpoint URLs as constants
  private static readonly USER_ENDPOINT = '/api/v1/auth/user';
  private static readonly LOGOUT_ENDPOINT = '/api/v1/auth/logout';
  private static readonly CALLBACK_ENDPOINT = '/api/v1/auth/callback';

  constructor(private httpClient: HttpClient) {}

  /**
   * Get current user information
   * @param authStrategy - Optional authentication strategy override
   * @returns User response with user info and authenticated status
   */
  async getUser(authStrategy?: AuthStrategy): Promise<GetUserResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<GetUserResponse>(
          'GET',
          AuthUserApi.USER_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<GetUserResponse>(
          'GET',
          AuthUserApi.USER_ENDPOINT,
          authStrategy,
        );
      }
      throw new Error('getUser requires authentication - provide authStrategy with bearerToken');
    } catch (error) {
      console.error('Get user API call failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   * @returns Logout response with success message
   */
  async logout(): Promise<LogoutResponse> {
    try {
      return await this.httpClient.request<LogoutResponse>(
        'POST',
        AuthUserApi.LOGOUT_ENDPOINT,
      );
    } catch (error) {
      console.error('Logout API call failed:', error);
      throw error;
    }
  }

  /**
   * Logout user with token
   * @param token - User access token to invalidate
   * @returns Logout response with success message
   */
  async logoutWithToken(token: string): Promise<LogoutResponse> {
    try {
      return await this.httpClient.request<LogoutResponse>(
        'POST',
        AuthUserApi.LOGOUT_ENDPOINT,
        { token },
      );
    } catch (error) {
      console.error('Logout with token API call failed:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth2 callback
   * @param params - Callback request parameters (query params)
   * @param authStrategy - Optional authentication strategy override
   * @returns Callback response with success message
   */
  async handleCallback(
    params: CallbackRequest,
    authStrategy?: AuthStrategy,
  ): Promise<CallbackResponse> {
    try {
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<CallbackResponse>(
          'GET',
          AuthUserApi.CALLBACK_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<CallbackResponse>(
        'GET',
        AuthUserApi.CALLBACK_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
      console.error('Handle callback API call failed:', error);
      throw error;
    }
  }
}

