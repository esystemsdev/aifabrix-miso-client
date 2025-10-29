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