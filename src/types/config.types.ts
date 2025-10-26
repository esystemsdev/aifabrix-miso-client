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
  controllerUrl: string;
  environment: 'dev' | 'tst' | 'pro';
  applicationKey: string;
  applicationId: string; // NEW: Application GUID
  apiKey?: string; // NEW: API key for logging
  redis?: RedisConfig; // Optional - if not provided, uses controller for everything
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
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
