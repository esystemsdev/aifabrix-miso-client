/**
 * Authentication strategy handler
 * Manages authentication methods and builds appropriate headers
 */

import { AuthStrategy, AuthMethod } from '../types/config.types';

export class AuthStrategyHandler {
  /**
   * Build authentication headers based on strategy
   * Returns headers for the first method in the strategy that has required data
   * @param strategy - Authentication strategy configuration
   * @param clientToken - Current client token (for client-token method)
   * @param clientId - Client ID (for client-credentials method)
   * @param clientSecret - Client secret (for client-credentials method)
   * @returns Headers object with appropriate authentication headers
   */
  static buildAuthHeaders(
    strategy: AuthStrategy,
    clientToken: string | null,
    clientId?: string,
    clientSecret?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Try methods in priority order
    for (const method of strategy.methods) {
      switch (method) {
        case 'bearer':
          if (strategy.bearerToken) {
            headers['Authorization'] = `Bearer ${strategy.bearerToken}`;
            return headers;
          }
          break;

        case 'client-token':
          if (clientToken) {
            headers['x-client-token'] = clientToken;
            return headers;
          }
          break;

        case 'client-credentials':
          if (clientId && clientSecret) {
            headers['X-Client-Id'] = clientId;
            headers['X-Client-Secret'] = clientSecret;
            return headers;
          }
          break;

        case 'api-key':
          if (strategy.apiKey) {
            headers['Authorization'] = `Bearer ${strategy.apiKey}`;
            return headers;
          }
          break;
      }
    }

    // If no method succeeded, return empty headers (will likely fail auth)
    return headers;
  }

  /**
   * Check if a specific method should be tried based on strategy
   * @param method - Authentication method to check
   * @param strategy - Authentication strategy configuration
   * @returns True if method is in strategy and has required data
   */
  static shouldTryMethod(method: AuthMethod, strategy: AuthStrategy): boolean {
    if (!strategy.methods.includes(method)) {
      return false;
    }

    switch (method) {
      case 'bearer':
        return !!strategy.bearerToken;
      case 'client-token':
        return true; // Client token is managed internally
      case 'client-credentials':
        return true; // Client credentials are from config
      case 'api-key':
        return !!strategy.apiKey;
      default:
        return false;
    }
  }

  /**
   * Get default authentication strategy
   * @param bearerToken - Optional bearer token
   * @returns Default strategy with bearer and client-token
   */
  static getDefaultStrategy(bearerToken?: string): AuthStrategy {
    return {
      methods: ['bearer', 'client-token'],
      bearerToken
    };
  }

  /**
   * Merge strategy with default, prioritizing provided strategy
   * @param strategy - Strategy to merge
   * @param defaultStrategy - Default strategy to fall back to
   * @returns Merged strategy
   */
  static mergeStrategy(
    strategy: AuthStrategy | undefined,
    defaultStrategy: AuthStrategy
  ): AuthStrategy {
    if (!strategy) {
      return defaultStrategy;
    }

    // Use provided strategy, but fill in missing required fields from default
    return {
      methods: strategy.methods.length > 0 ? strategy.methods : defaultStrategy.methods,
      bearerToken: strategy.bearerToken || defaultStrategy.bearerToken,
      apiKey: strategy.apiKey || defaultStrategy.apiKey
    };
  }
}

