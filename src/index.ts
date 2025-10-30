/**
 * Main MisoClient SDK class
 */

import { AuthService } from './services/auth.service';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { LoggerService } from './services/logger.service';
import { RedisService } from './services/redis.service';
import { EncryptionService } from './services/encryption.service';
import { CacheService } from './services/cache.service';
import { HttpClient } from './utils/http-client';
import { MisoClientConfig, UserInfo } from './types/config.types';

export class MisoClient {
  private config: MisoClientConfig;
  private httpClient: HttpClient;
  private redis: RedisService;
  private auth: AuthService;
  private roles: RoleService;
  private permissions: PermissionService;
  private logger: LoggerService;
  private encryptionService?: EncryptionService;
  private cacheService: CacheService;
  private initialized = false;

  constructor(config: MisoClientConfig) {
    this.config = config;
    this.httpClient = new HttpClient(config);
    this.redis = new RedisService(config.redis);
    this.auth = new AuthService(this.httpClient, this.redis);
    this.logger = new LoggerService(this.httpClient, this.redis);
    
    // Initialize cache service with Redis support (used by roles and permissions)
    this.cacheService = new CacheService(this.redis);
    
    // Initialize services that use cache
    this.roles = new RoleService(this.httpClient, this.cacheService);
    this.permissions = new PermissionService(this.httpClient, this.cacheService);
    
    // Initialize encryption service if key is provided (optional)
    if (config.encryptionKey || process.env.ENCRYPTION_KEY) {
      try {
        this.encryptionService = new EncryptionService(config.encryptionKey);
      } catch (error) {
        // Encryption service not initialized if key is missing
        // This is okay - encryption is optional
      }
    }
  }

  /**
   * Initialize the client (connect to Redis if configured)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.redis.connect();
      this.initialized = true;
    } catch (error) {
      // Redis connection failed, continue with controller fallback mode
      this.initialized = true; // Still mark as initialized for fallback mode
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    this.initialized = false;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ==================== AUTHENTICATION METHODS ====================

  /**
   * Extract Bearer token from request headers
   * Supports common request object patterns (Express, Fastify, Next.js)
   */
  getToken(req: { headers: { authorization?: string } }): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return null;
    }

    // Support "Bearer <token>" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // If no Bearer prefix, assume the whole header is the token
    return authHeader;
  }

  /**
   * Get environment token using client credentials
   * This is called automatically by HttpClient but can be called manually
   */
  async getEnvironmentToken(): Promise<string> {
    return this.auth.getEnvironmentToken();
  }

  /**
   * Initiate login flow by redirecting to controller
   * Returns the login URL for browser redirect or manual navigation
   */
  login(redirectUri: string): string {
    return this.auth.login(redirectUri);
  }

  /**
   * Validate token with controller
   */
  async validateToken(token: string): Promise<boolean> {
    return this.auth.validateToken(token);
  }

  /**
   * Get user information from token
   */
  async getUser(token: string): Promise<UserInfo | null> {
    return this.auth.getUser(token);
  }

  /**
   * Get user information from GET /api/auth/user endpoint
   */
  async getUserInfo(token: string): Promise<UserInfo | null> {
    return this.auth.getUserInfo(token);
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(token: string): Promise<boolean> {
    return this.auth.isAuthenticated(token);
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    return this.auth.logout();
  }

  // ==================== AUTHORIZATION METHODS ====================

  /**
   * Get user roles (cached in Redis if available)
   */
  async getRoles(token: string): Promise<string[]> {
    return this.roles.getRoles(token);
  }

  /**
   * Check if user has specific role
   */
  async hasRole(token: string, role: string): Promise<boolean> {
    return this.roles.hasRole(token, role);
  }

  /**
   * Check if user has any of the specified roles
   */
  async hasAnyRole(token: string, roles: string[]): Promise<boolean> {
    return this.roles.hasAnyRole(token, roles);
  }

  /**
   * Check if user has all of the specified roles
   */
  async hasAllRoles(token: string, roles: string[]): Promise<boolean> {
    return this.roles.hasAllRoles(token, roles);
  }

  /**
   * Force refresh roles from controller (bypass cache)
   */
  async refreshRoles(token: string): Promise<string[]> {
    return this.roles.refreshRoles(token);
  }

  /**
   * Get user permissions (cached in Redis if available)
   */
  async getPermissions(token: string): Promise<string[]> {
    return this.permissions.getPermissions(token);
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(token: string, permission: string): Promise<boolean> {
    return this.permissions.hasPermission(token, permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(token: string, permissions: string[]): Promise<boolean> {
    return this.permissions.hasAnyPermission(token, permissions);
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(token: string, permissions: string[]): Promise<boolean> {
    return this.permissions.hasAllPermissions(token, permissions);
  }

  /**
   * Force refresh permissions from controller (bypass cache)
   */
  async refreshPermissions(token: string): Promise<string[]> {
    return this.permissions.refreshPermissions(token);
  }

  /**
   * Clear cached permissions for a user
   */
  async clearPermissionsCache(token: string): Promise<void> {
    return this.permissions.clearPermissionsCache(token);
  }

  // ==================== LOGGING METHODS ====================

  /**
   * Get logger service for application logging
   */
  get log(): LoggerService {
    return this.logger;
  }

  // ==================== ENCRYPTION METHODS ====================

  /**
   * Get encryption service for data encryption/decryption
   * Returns undefined if encryption key is not configured
   */
  get encryption(): EncryptionService | undefined {
    return this.encryptionService;
  }

  // ==================== CACHE METHODS ====================

  /**
   * Get cache service for generic caching
   */
  get cache(): CacheService {
    return this.cacheService;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get current configuration
   */
  getConfig(): MisoClientConfig {
    return { ...this.config };
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.redis.isConnected();
  }
}

// Export types
export * from './types/config.types';

// Export services for advanced usage
export { AuthService } from './services/auth.service';
export { RoleService } from './services/role.service';
export { LoggerService } from './services/logger.service';
export { RedisService } from './services/redis.service';
export { EncryptionService } from './services/encryption.service';
export { CacheService } from './services/cache.service';
export { HttpClient } from './utils/http-client';

// Export utilities
export { loadConfig } from './utils/config-loader';