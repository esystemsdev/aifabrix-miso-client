/**
 * DataClient - Browser-compatible HTTP client wrapper around MisoClient
 * Provides enhanced HTTP capabilities with ISO 27001 compliance, caching, retry, and more
 */

import {
  DataClientConfig,
  ApiRequestOptions,
} from "../types/data-client.types";
import { ClientTokenInfo } from "./token-utils";
import * as permissionHelpers from "./data-client-permissions";
import * as roleHelpers from "./data-client-roles";
import { getEnvironmentToken } from "./data-client-auth";
import { DataClientCore } from "./data-client-core";
import { UserInfo } from "../types/config.types";

export class DataClient extends DataClientCore {
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "GET",
    });
    return this.request<T>("GET", endpoint, finalOptions);
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return this.request<T>("POST", endpoint, finalOptions);
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return this.request<T>("PUT", endpoint, finalOptions);
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return this.request<T>("PATCH", endpoint, finalOptions);
  }

  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const finalOptions = await this.applyRequestInterceptor(endpoint, {
      ...options,
      method: "DELETE",
    });
    return this.request<T>("DELETE", endpoint, finalOptions);
  }

  // ==================== PERMISSION METHODS ====================

  async getPermissions(token?: string): Promise<string[]> {
    return permissionHelpers.getPermissions(
      this.permissionService,
      this.misoClient,
      () => this.getToken(),
      token,
    );
  }

  async hasPermission(permission: string, token?: string): Promise<boolean> {
    return permissionHelpers.hasPermission(
      this.permissionService,
      this.misoClient,
      () => this.getToken(),
      permission,
      token,
    );
  }

  async hasAnyPermission(
    permissions: string[],
    token?: string,
  ): Promise<boolean> {
    return permissionHelpers.hasAnyPermission(
      this.permissionService,
      this.misoClient,
      () => this.getToken(),
      permissions,
      token,
    );
  }

  async hasAllPermissions(
    permissions: string[],
    token?: string,
  ): Promise<boolean> {
    return permissionHelpers.hasAllPermissions(
      this.permissionService,
      this.misoClient,
      () => this.getToken(),
      permissions,
      token,
    );
  }

  async refreshPermissions(token?: string): Promise<string[]> {
    return permissionHelpers.refreshPermissions(
      this.permissionService,
      this.misoClient,
      () => this.getToken(),
      token,
    );
  }

  async clearPermissionsCache(token?: string): Promise<void> {
    return permissionHelpers.clearPermissionsCache(
      this.permissionService,
      this.misoClient,
      () => this.getToken(),
      token,
    );
  }

  // ==================== ROLE METHODS ====================

  async getRoles(token?: string): Promise<string[]> {
    return roleHelpers.getRoles(
      this.roleService,
      this.misoClient,
      () => this.getToken(),
      token,
    );
  }

  async hasRole(role: string, token?: string): Promise<boolean> {
    return roleHelpers.hasRole(
      this.roleService,
      this.misoClient,
      () => this.getToken(),
      role,
      token,
    );
  }

  async hasAnyRole(roles: string[], token?: string): Promise<boolean> {
    return roleHelpers.hasAnyRole(
      this.roleService,
      this.misoClient,
      () => this.getToken(),
      roles,
      token,
    );
  }

  async hasAllRoles(roles: string[], token?: string): Promise<boolean> {
    return roleHelpers.hasAllRoles(
      this.roleService,
      this.misoClient,
      () => this.getToken(),
      roles,
      token,
    );
  }

  async refreshRoles(token?: string): Promise<string[]> {
    return roleHelpers.refreshRoles(
      this.roleService,
      this.misoClient,
      () => this.getToken(),
      token,
    );
  }

  async clearRolesCache(token?: string): Promise<void> {
    return roleHelpers.clearRolesCache(
      this.roleService,
      this.misoClient,
      () => this.getToken(),
      token,
    );
  }

  // ==================== AUTHENTICATION METHODS ====================

  async validateToken(token?: string): Promise<boolean> {
    if (!this.misoClient) return false;
    const userToken = token || this.getToken();
    return userToken ? this.misoClient.validateToken(userToken) : false;
  }

  async getUser(token?: string): Promise<UserInfo | null> {
    if (!this.misoClient) return null;
    const userToken = token || this.getToken();
    return userToken ? this.misoClient.getUser(userToken) : null;
  }

  async getUserInfo(token?: string): Promise<UserInfo | null> {
    if (!this.misoClient) return null;
    const userToken = token || this.getToken();
    return userToken ? this.misoClient.getUserInfo(userToken) : null;
  }

  async isAuthenticatedAsync(token?: string): Promise<boolean> {
    return this.validateToken(token);
  }

  async getEnvironmentToken(): Promise<string> {
    return getEnvironmentToken(this.config, this.misoClient);
  }

  getClientTokenInfo(): ClientTokenInfo | null {
    return this.getClientTokenInfoInternal();
  }
}

// ==================== SINGLETON FACTORY ====================

let defaultDataClient: DataClient | null = null;

export function dataClient(config?: DataClientConfig): DataClient {
  if (!defaultDataClient && config) {
    defaultDataClient = new DataClient(config);
  }
  if (!defaultDataClient) {
    throw new Error(
      "DataClient not initialized. Call dataClient(config) first.",
    );
  }
  return defaultDataClient;
}
