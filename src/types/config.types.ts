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

/**
 * Authentication method types
 */
export type AuthMethod =
  | "bearer"
  | "client-token"
  | "client-credentials"
  | "api-key";

/**
 * Authentication strategy configuration
 * Defines which authentication methods to try and in what order
 */
export interface AuthStrategy {
  /**
   * Array of authentication methods in priority order
   * Methods are tried in sequence until one succeeds
   */
  methods: AuthMethod[];

  /**
   * Optional bearer token for bearer authentication
   * Required if 'bearer' is in methods array
   */
  bearerToken?: string;

  /**
   * Optional API key for api-key authentication
   * Required if 'api-key' is in methods array
   */
  apiKey?: string;
}

export interface MisoClientConfig {
  // REQUIRED: Only these 3 fields needed
  controllerUrl: string;
  clientId: string;
  clientSecret: string;

  // Optional: Redis for caching
  redis?: RedisConfig;

  // Optional: Logging
  logLevel?: "debug" | "info" | "warn" | "error";

  // Optional: Encryption key (for EncryptionService)
  encryptionKey?: string;

  // Optional: API key for testing (bypasses OAuth2 authentication)
  apiKey?: string;

  // Optional: Cache configuration
  cache?: {
    roleTTL?: number; // Default 15 minutes
    permissionTTL?: number; // Default 15 minutes
  };

  // Optional: Sensitive fields configuration file path
  sensitiveFieldsConfig?: string;

  // Optional: Audit logging configuration
  audit?: AuditConfig;

  // Optional: Emit log events instead of sending via HTTP/Redis
  // When true, LoggerService will emit events via EventEmitter that can be listened to
  // Useful for direct SDK embedding in your own application to save logs directly to DB
  emitEvents?: boolean; // Default: false (maintains backward compatibility)

  // Optional: Default authentication strategy
  // If not specified, defaults to ['bearer', 'client-token']
  authStrategy?: AuthStrategy;
}

export interface AuditConfig {
  enabled?: boolean; // Enable/disable audit logging (default: true)
  level?: "minimal" | "standard" | "detailed" | "full"; // Audit detail level (default: 'detailed')
  maxResponseSize?: number; // Truncate responses larger than this (default: 10000)
  maxMaskingSize?: number; // Skip masking for objects larger than this (default: 50000)
  batchSize?: number; // Batch size for queued logs (default: 10)
  batchInterval?: number; // Flush interval in ms (default: 100)
  skipEndpoints?: string[]; // Endpoints to skip audit logging
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
  level: "error" | "audit" | "info" | "debug";
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
  // Support both nested (new) and flat (old) response formats
  data?: {
    token: string;
    expiresIn: number;
    expiresAt: string; // ISO date string
  };
  token?: string; // For backward compatibility with flat format
  expiresIn?: number;
  expiresAt?: string; // ISO date string
  timestamp?: string;
}

/**
 * RFC 7807-style structured error response
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
 */
export function isErrorResponse(data: unknown): data is ErrorResponse {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (
    !Array.isArray(obj.errors) ||
    !obj.errors.every((e) => typeof e === "string")
  ) {
    return false;
  }

  if (typeof obj.type !== "string" || typeof obj.title !== "string") {
    return false;
  }

  // Check statusCode (camelCase only)
  if (typeof obj.statusCode !== "number") {
    return false;
  }

  // instance is optional
  if (obj.instance !== undefined && typeof obj.instance !== "string") {
    return false;
  }

  return true;
}
