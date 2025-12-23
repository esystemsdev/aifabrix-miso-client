/**
 * Permissions API client
 * Provides typed interfaces for permissions-related controller API calls
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  GetPermissionsQueryParams,
  GetPermissionsResponse,
  RefreshPermissionsResponse,
} from './types/permissions.types';

/**
 * Permissions API class
 * Centralizes all permissions-related endpoint URLs and provides typed methods
 */
export class PermissionsApi {
  // Centralize endpoint URLs as constants
  private static readonly PERMISSIONS_ENDPOINT = '/api/v1/auth/permissions';
  private static readonly PERMISSIONS_REFRESH_ENDPOINT = '/api/v1/auth/permissions/refresh';

  constructor(private httpClient: HttpClient) {}

  /**
   * Get user permissions
   * @param params - Optional query parameters (environment, application)
   * @param authStrategy - Optional authentication strategy override
   * @returns Permissions response with user permissions array
   */
  async getPermissions(
    params?: GetPermissionsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<GetPermissionsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<GetPermissionsResponse>(
          'GET',
          PermissionsApi.PERMISSIONS_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<GetPermissionsResponse>(
          'GET',
          PermissionsApi.PERMISSIONS_ENDPOINT,
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

  /**
   * Refresh user permissions
   * @param authStrategy - Optional authentication strategy override
   * @returns Refresh permissions response with updated permissions array
   */
  async refreshPermissions(
    authStrategy?: AuthStrategy,
  ): Promise<RefreshPermissionsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<RefreshPermissionsResponse>(
          'GET',
          PermissionsApi.PERMISSIONS_REFRESH_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<RefreshPermissionsResponse>(
          'GET',
          PermissionsApi.PERMISSIONS_REFRESH_ENDPOINT,
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

