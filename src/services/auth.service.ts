/**
 * Authentication service for token validation and user management
 */

import { HttpClient } from '../utils/http-client';
import { RedisService } from './redis.service';
import { MisoClientConfig, UserInfo, AuthResult } from '../types/config.types';

export class AuthService {
  private httpClient: HttpClient;
  private redis: RedisService;
  private config: MisoClientConfig;

  constructor(httpClient: HttpClient, redis: RedisService) {
    this.config = httpClient.config;
    this.redis = redis;
    this.httpClient = httpClient;
  }

  /**
   * Get environment token using client credentials
   * This is called automatically by HttpClient, but can be called manually if needed
   */
  async getEnvironmentToken(): Promise<string> {
    try {
      // Use a temporary axios instance to avoid interceptor recursion
      const axios = (await import('axios')).default;
      const tempAxios = axios.create({
        baseURL: this.config.controllerUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': this.config.clientId,
          'X-Client-Secret': this.config.clientSecret
        }
      });

      const response = await tempAxios.post<import('../types/config.types').ClientTokenResponse>(
        '/api/auth/token'
      );

      if (response.data.success && response.data.token) {
        return response.data.token;
      }

      throw new Error('Failed to get environment token: Invalid response');
    } catch (error) {
      throw new Error(
        'Failed to get environment token: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * Initiate login flow by redirecting to controller
   * Returns the login URL for browser redirect or manual navigation
   */
  login(redirectUri: string): string {
    // Backend will extract environment and application from client token
    return `${this.config.controllerUrl}/api/auth/login?redirect=${encodeURIComponent(redirectUri)}`;
  }

  /**
   * Validate token with controller
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const result = await this.httpClient.authenticatedRequest<AuthResult>(
        'POST',
        '/api/auth/validate', // Backend knows app/env from client token
        token
      );

      return result.authenticated;
    } catch (error) {
      // Token validation failed, return false
      return false;
    }
  }

  /**
   * Get user information from token
   */
  async getUser(token: string): Promise<UserInfo | null> {
    try {
      const result = await this.httpClient.authenticatedRequest<AuthResult>(
        'POST',
        '/api/auth/validate',
        token
      );

      if (result.authenticated && result.user) {
        return result.user;
      }

      return null;
    } catch (error) {
      // Failed to get user info, return null
      return null;
    }
  }

  /**
   * Get user information from GET /api/auth/user endpoint
   */
  async getUserInfo(token: string): Promise<UserInfo | null> {
    try {
      const user = await this.httpClient.authenticatedRequest<UserInfo>(
        'GET',
        '/api/auth/user',
        token
      );

      return user;
    } catch (error) {
      // Failed to get user info, return null
      return null;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Backend extracts app/env from client token
      await this.httpClient.request('POST', '/api/auth/logout');
    } catch (error) {
      // Logout failed, re-throw error for application to handle
      throw new Error(
        'Logout failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  async isAuthenticated(token: string): Promise<boolean> {
    return this.validateToken(token);
  }
}
