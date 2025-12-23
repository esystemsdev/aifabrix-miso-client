/**
 * Centralized API client
 * Provides typed interfaces for all controller API calls
 * Wraps HttpClient internally and organizes APIs by domain
 */

import { HttpClient } from '../utils/http-client';
import { AuthApi } from './auth.api';
import { RolesApi } from './roles.api';
import { PermissionsApi } from './permissions.api';
import { LogsApi } from './logs.api';

/**
 * API Client class
 * Wraps HttpClient and provides domain-specific API interfaces
 * Services can gradually migrate from direct HttpClient usage to ApiClient
 */
export class ApiClient {
  /**
   * Auth API - Authentication, token management, user info, roles, permissions, cache
   */
  readonly auth: AuthApi;

  /**
   * Roles API - User roles management
   */
  readonly roles: RolesApi;

  /**
   * Permissions API - User permissions management
   */
  readonly permissions: PermissionsApi;

  /**
   * Logs API - Logging and log management
   */
  readonly logs: LogsApi;

  /**
   * Create API client instance
   * @param httpClient - HttpClient instance to wrap
   */
  constructor(httpClient: HttpClient) {
    this.auth = new AuthApi(httpClient);
    this.roles = new RolesApi(httpClient);
    this.permissions = new PermissionsApi(httpClient);
    this.logs = new LogsApi(httpClient);
  }
}

