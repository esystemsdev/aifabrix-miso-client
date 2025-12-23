/**
 * Roles API client
 * Provides typed interfaces for roles-related controller API calls
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  GetRolesQueryParams,
  GetRolesResponse,
  RefreshRolesResponse,
} from './types/roles.types';

/**
 * Roles API class
 * Centralizes all roles-related endpoint URLs and provides typed methods
 */
export class RolesApi {
  // Centralize endpoint URLs as constants
  private static readonly ROLES_ENDPOINT = '/api/v1/auth/roles';
  private static readonly ROLES_REFRESH_ENDPOINT = '/api/v1/auth/roles/refresh';

  constructor(private httpClient: HttpClient) {}

  /**
   * Get user roles
   * @param params - Optional query parameters (environment, application)
   * @param authStrategy - Optional authentication strategy override
   * @returns Roles response with user roles array
   */
  async getRoles(
    params?: GetRolesQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<GetRolesResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<GetRolesResponse>(
          'GET',
          RolesApi.ROLES_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<GetRolesResponse>(
          'GET',
          RolesApi.ROLES_ENDPOINT,
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

  /**
   * Refresh user roles
   * @param authStrategy - Optional authentication strategy override
   * @returns Refresh roles response with updated roles array
   */
  async refreshRoles(
    authStrategy?: AuthStrategy,
  ): Promise<RefreshRolesResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<RefreshRolesResponse>(
          'GET',
          RolesApi.ROLES_REFRESH_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<RefreshRolesResponse>(
          'GET',
          RolesApi.ROLES_REFRESH_ENDPOINT,
          authStrategy,
        );
      }
      throw new Error('refreshRoles requires authentication - provide authStrategy with bearerToken');
    } catch (error) {
      console.error('Refresh roles API call failed:', error);
      throw error;
    }
  }
}

