/**
 * Configuration types for MisoClient
 */

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface MisoClientConfig {
  // REQUIRED: Only these 3 fields needed
  controllerUrl: string;
  clientId: string;
  clientSecret: string;
  
  // Optional: Redis for caching
  redis?: RedisConfig;
  
  // Optional: Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Optional: Encryption key (for EncryptionService)
  encryptionKey?: string;
  
  // Optional: API key for testing (bypasses OAuth2 authentication)
  apiKey?: string;
  
  // Optional: Cache configuration
  cache?: {
    roleTTL?: number; // Default 15 minutes
    permissionTTL?: number; // Default 15 minutes
  };
}

export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}

export interface AuthResult {
  authenticated: boolean;
  user?: UserInfo;
  error?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'audit' | 'info' | 'debug';
  environment: string;
  application: string;
  applicationId: string;
  userId?: string;
  message: string;
  context?: Record<string, unknown>;

  // ISO 27001 Security Metadata (auto-extracted)
  ipAddress?: string;
  userAgent?: string;
  hostname?: string;
  requestId?: string;
  sessionId?: string;
  correlationId?: string;
  stackTrace?: string;
}

export interface RoleResult {
  userId: string;
  roles: string[];
  environment: string;
  application: string;
}

export interface PermissionResult {
  userId: string;
  permissions: string[];
  environment: string;
  application: string;
}

export interface ClientTokenResponse {
  success: boolean;
  token: string;
  expiresIn: number;
  expiresAt: string; // ISO date string
}

/**
 * RFC 7807-style structured error response
 * Supports both camelCase (statusCode) and snake_case (status_code) for compatibility
 */
export interface ErrorResponse {
  errors: string[];
  type: string;
  title: string;
  statusCode: number;
  instance?: string;
}

/**
 * Type guard to check if data matches ErrorResponse structure
 * Handles both camelCase (statusCode) and snake_case (status_code) field names
 */
export function isErrorResponse(data: unknown): data is ErrorResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (!Array.isArray(obj.errors) || !obj.errors.every(e => typeof e === 'string')) {
    return false;
  }

  if (typeof obj.type !== 'string' || typeof obj.title !== 'string') {
    return false;
  }

  // Support both camelCase and snake_case for statusCode
  const statusCode = obj.statusCode ?? obj.status_code;
  if (typeof statusCode !== 'number') {
    return false;
  }

  // instance is optional
  if (obj.instance !== undefined && typeof obj.instance !== 'string') {
    return false;
  }

  return true;
}