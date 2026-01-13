/**
 * DataClient initialization helpers - extracted for code organization
 * Handles MisoClient and service initialization
 */

import { MisoClient } from "../index";
import { DataClientConfig } from "../types/data-client.types";
import { MisoClientConfig } from "../types/config.types";
import { BrowserPermissionService } from "../services/browser-permission.service";
import { BrowserRoleService } from "../services/browser-role.service";
import { CacheService } from "../services/cache.service";
import { HttpClient } from "./http-client";
import { InternalHttpClient } from "./internal-http-client";
import { ApiClient } from "../api";
import { LoggerService } from "../services/logger";
import { RedisService } from "../services/redis.service";
import { isBrowser, getLocalStorage } from "./data-client-utils";

/**
 * Result of DataClient initialization
 */
export interface DataClientInitResult {
  misoClient: MisoClient | null;
  permissionService: BrowserPermissionService | null;
  roleService: BrowserRoleService | null;
}

/**
 * Create MisoClient config with auto-bridged token refresh
 * @param config - DataClient configuration
 * @param getEnvironmentTokenFn - Function to get environment token
 * @returns MisoClient configuration with token refresh callback
 */
export function createMisoConfigWithRefresh(
  config: DataClientConfig,
  getEnvironmentTokenFn: () => Promise<string>,
): MisoClientConfig | undefined {
  if (!config.misoConfig) {
    return undefined;
  }

  return {
    ...config.misoConfig,
    onClientTokenRefresh:
      config.misoConfig.onClientTokenRefresh ||
      (isBrowser() && !config.misoConfig.clientSecret
        ? async () => {
            const token = await getEnvironmentTokenFn();
            if (!token) {
              throw new Error("Failed to get client token");
            }
            const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
            const expiresAt = expiresAtStr
              ? parseInt(expiresAtStr, 10)
              : Date.now() + 3600000;
            const expiresIn = Math.floor((expiresAt - Date.now()) / 1000);
            return {
              token,
              expiresIn: expiresIn > 0 ? expiresIn : 3600,
            };
          }
        : undefined),
  };
}

/**
 * Initialize browser services (permission and role services)
 * @param misoClient - MisoClient instance
 * @param misoConfig - MisoClient configuration
 * @returns Permission and role services
 */
export function initializeBrowserServices(
  misoClient: MisoClient | null,
  misoConfig: MisoClientConfig | undefined,
): { permissionService: BrowserPermissionService | null; roleService: BrowserRoleService | null } {
  if (!misoClient || !misoConfig) {
    return { permissionService: null, roleService: null };
  }

  // Create InternalHttpClient first (base HTTP functionality)
  const internalClient = new InternalHttpClient(misoConfig);

  // Create Redis service (will be undefined for browser, but needed for LoggerService)
  const redis = new RedisService(misoConfig.redis);

  // Create LoggerService with InternalHttpClient
  const logger = new LoggerService(
    internalClient as unknown as HttpClient,
    redis,
  );

  // Create HttpClient that wraps InternalHttpClient with logger
  const httpClient = new HttpClient(misoConfig, logger);

  // Update LoggerService to use the new HttpClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (logger as any).httpClient = httpClient;

  // Create ApiClient that wraps HttpClient
  const apiClient = new ApiClient(httpClient);

  // Set ApiClient in LoggerService (resolves circular dependency)
  logger.setApiClient(apiClient);

  // Create CacheService without Redis (in-memory only for browser)
  const cacheService = new CacheService(undefined);

  // Create browser-compatible services
  const permissionService = new BrowserPermissionService(
    httpClient,
    apiClient,
    cacheService,
  );
  const roleService = new BrowserRoleService(httpClient, apiClient, cacheService);

  return { permissionService, roleService };
}

/**
 * Log security warning if clientSecret is in browser environment
 * @param config - DataClient configuration
 */
export function warnIfClientSecretInBrowser(config: DataClientConfig): void {
  if (isBrowser() && config.misoConfig?.clientSecret) {
    console.warn(
      "⚠️ SECURITY WARNING: clientSecret detected in browser environment. " +
        "Client secrets should NEVER be exposed in client-side code. " +
        "Use the client token pattern instead (clientToken + onClientTokenRefresh). " +
        "See documentation for browser-safe configuration.",
    );
  }
}

/**
 * Create default DataClient configuration with merged user config
 * @param config - User-provided configuration
 * @returns Complete configuration with defaults
 */
export function createDefaultConfig(config: DataClientConfig): DataClientConfig {
  return {
    tokenKeys: ["token", "accessToken", "authToken"],
    loginUrl: "/login",
    timeout: 30000,
    cache: {
      enabled: true,
      defaultTTL: 300,
      maxSize: 100,
    },
    retry: {
      enabled: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    },
    audit: {
      enabled: true,
      level: "standard",
      batchSize: 10,
      maxResponseSize: 10000,
      maxMaskingSize: 50000,
      skipEndpoints: [],
    },
    ...config,
  };
}
