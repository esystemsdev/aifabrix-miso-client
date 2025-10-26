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

  constructor(config: MisoClientConfig, redis: RedisService) {
    this.config = config;
    this.redis = redis;
    this.httpClient = new HttpClient(config);
  }

  /**
   * Initiate login flow by redirecting to controller
   * Returns the login URL for browser redirect or manual navigation
   */
  login(redirectUri: string): string {
    const loginUrl =
      `${this.config.controllerUrl}/auth/login?` +
      `environment=${this.config.environment}&` +
      `application=${this.config.applicationKey}&` +
      `redirect=${encodeURIComponent(redirectUri)}`;

    // In a browser environment, application should redirect to this URL
    // In Node.js, application should handle URL appropriately
    return loginUrl;
  }

  /**
   * Validate token with controller
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const result = await this.httpClient.authenticatedRequest<AuthResult>(
        'POST',
        '/auth/validate',
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
        '/auth/validate',
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
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.httpClient.post('/auth/logout', {
        environment: this.config.environment,
        application: this.config.applicationKey
      });
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
