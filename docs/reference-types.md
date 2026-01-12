# Type Reference

Complete type definitions for the MisoClient SDK.

## Table of Contents

- [Configuration Types](#configuration-types)
- [Authentication Types](#authentication-types)
- [DataClient Types](#dataclient-types)
- [Utility Types](#utility-types)
- [Error Types](#error-types)
- [Type Exports](#type-exports)
- [See Also](#see-also)

## Configuration Types

### MisoClientConfig

Main configuration interface for the MisoClient.

```typescript
interface MisoClientConfig {
  // URL Configuration: At least one URL must be provided
  controllerUrl?: string; // Optional: Fallback URL for both environments (backward compatibility)
  controllerPublicUrl?: string; // Optional: Public URL for browser/Vite environments (accessible from internet)
  controllerPrivateUrl?: string; // Optional: Private URL for server environments (internal network access)
  
  clientId: string; // Required: Client ID (e.g., 'ctrl-dev-my-app')
  clientSecret: string; // Required: Client secret
  redis?: RedisConfig; // Optional: Redis configuration
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Optional: Log level
  emitEvents?: boolean; // Optional: Emit log events instead of HTTP/Redis (for direct SDK embedding)
  authStrategy?: AuthStrategy; // Optional: Default authentication strategy
  cache?: {
    // Optional: Cache configuration
    roleTTL?: number; // Role cache TTL in seconds (default: 900)
    permissionTTL?: number; // Permission cache TTL in seconds (default: 900)
    tokenValidationTTL?: number; // Token validation cache TTL in seconds (default: 900)
  };
  sensitiveFieldsConfig?: string; // Optional: Path to custom sensitive fields JSON configuration file
  audit?: AuditConfig; // Optional: Audit logging configuration
  allowedOrigins?: string[]; // Optional: Allowed origins for CORS validation
  keycloak?: {
    authServerUrl: string; // Required: Keycloak server URL (fallback for backward compatibility)
    authServerPrivateUrl?: string; // Optional: Private URL for server-side JWKS fetching (internal network)
    authServerPublicUrl?: string; // Optional: Public URL for browser-side and issuer validation (public network)
    realm: string; // Required: Keycloak realm name
    clientId?: string; // Optional: Client ID for audience validation
    clientSecret?: string; // Optional: Client secret for confidential clients
    verifyAudience?: boolean; // Optional: Enable audience validation (default: false)
  }; // Optional: Keycloak configuration for local token validation
}
```

**URL Configuration Priority:**

The SDK automatically detects the environment (browser vs server) and resolves URLs in the following priority order:

1. **Environment-specific URL**: `controllerPublicUrl` (browser) or `controllerPrivateUrl` (server)
2. **Fallback**: `controllerUrl` if environment-specific URL not provided
3. **Error**: Throws clear error if no URL available

### RedisConfig

Redis configuration interface.

```typescript
interface RedisConfig {
  host: string; // Required: Redis host
  port: number; // Required: Redis port
  password?: string; // Optional: Redis password
  db?: number; // Optional: Redis database number
  keyPrefix?: string; // Optional: Key prefix
}
```

### AuditConfig

Audit logging configuration interface.

```typescript
interface AuditConfig {
  enabled?: boolean; // Enable/disable audit logging (default: true)
  level?: 'minimal' | 'standard' | 'detailed' | 'full'; // Audit detail level (default: 'detailed')
  maxResponseSize?: number; // Truncate responses larger than this (default: 10000 bytes)
  maxMaskingSize?: number; // Skip masking for objects larger than this (default: 50000 bytes)
  batchSize?: number; // Batch size for queued logs (default: 10)
  batchInterval?: number; // Flush interval in ms (default: 100)
  skipEndpoints?: string[]; // Endpoints to skip audit logging
}
```

**Audit Levels:**

- `minimal`: Only metadata (method, URL, status, duration) - fastest, no masking
- `standard`: Light masking (headers only, selective body masking) - balanced performance
- `detailed`: Full masking with sizes (default) - optimized for compliance
- `full`: Everything including debug-level details - most detailed

→ [Complete Audit Configuration Guide](./configuration.md#audit-configuration)

## Authentication Types

### AuthStrategy

Interface for configuring authentication strategy.

```typescript
interface AuthStrategy {
  methods: AuthMethod[]; // Array of authentication methods in priority order
  bearerToken?: string;  // Optional bearer token for bearer authentication
  apiKey?: string;       // Optional API key for api-key authentication
}
```

### AuthMethod

Type for authentication method names.

```typescript
type AuthMethod = 'bearer' | 'client-token' | 'client-credentials' | 'api-key';
```

### UserInfo

User information interface.

```typescript
interface UserInfo {
  id: string; // User ID
  username: string; // Username
  email?: string; // Optional: Email address
  firstName?: string; // Optional: First name
  lastName?: string; // Optional: Last name
  roles?: string[]; // Optional: User roles
}
```

### LoginResponse

Login response interface returned by the `login()` method.

```typescript
interface LoginResponse {
  success: boolean; // Whether the login request was successful
  data: {
    loginUrl: string; // URL to redirect user to for authentication
    state: string; // CSRF protection token
  };
  timestamp: string; // ISO timestamp of the response
}
```

### LogoutResponse

Logout response interface returned by the `logout()` method.

```typescript
interface LogoutResponse {
  success: boolean; // Whether the logout was successful
  message: string; // Success message
  timestamp: string; // ISO timestamp of the response
}
```

### RefreshTokenResponse

Refresh token response interface returned by the `refreshToken()` method.

```typescript
interface RefreshTokenResponse {
  success: boolean; // Whether the refresh was successful
  accessToken: string; // New access token
  refreshToken: string; // New refresh token
  expiresIn: number; // Token expiration time in seconds
  expiresAt?: string; // ISO date string for expiration
  timestamp?: string; // ISO timestamp of the response
}
```

## Logging Types

### LogEntry

Log entry interface for structured logging. Includes indexed context fields for fast database queries.

```typescript
interface LogEntry {
  timestamp: string; // ISO timestamp
  level: 'error' | 'audit' | 'info' | 'debug'; // Log level
  environment: string; // Environment name
  application: string; // Application name
  applicationId: string; // Application ID
  userId?: string; // User ID (optional)
  message: string; // Log message
  context?: Record<string, unknown>; // Additional context data
  
  // ISO 27001 Security Metadata (auto-extracted)
  ipAddress?: string; // Client IP address
  userAgent?: string; // Browser/client user agent
  hostname?: string; // Server hostname
  requestId?: string; // Request identifier
  sessionId?: string; // Session identifier
  correlationId?: string; // Correlation identifier for request tracing
  stackTrace?: string; // Stack trace for errors
  
  // Indexed context fields (top-level for fast queries)
  sourceKey?: string; // Source identifier (e.g., datasource key)
  sourceDisplayName?: string; // Human-readable source name
  externalSystemKey?: string; // External system identifier
  externalSystemDisplayName?: string; // Human-readable external system name
  recordKey?: string; // Record identifier
  recordDisplayName?: string; // Human-readable record name
  
  // Credential context (optional)
  credentialId?: string; // Credential identifier
  credentialType?: string; // Credential type (e.g., 'oauth2', 'api-key')
  
  // Request/Response metrics
  requestSize?: number; // Request size in bytes
  responseSize?: number; // Response size in bytes
  durationMs?: number; // Request duration in milliseconds
  
  // Error classification
  errorCategory?: string; // Error category
  httpStatusCategory?: string; // HTTP status category
}
```

### IndexedLoggingContext

Indexed logging context fields for fast database queries.

```typescript
interface IndexedLoggingContext {
  sourceKey?: string; // Source identifier
  sourceDisplayName?: string; // Human-readable source name
  externalSystemKey?: string; // External system identifier
  externalSystemDisplayName?: string; // Human-readable external system name
  recordKey?: string; // Record identifier
  recordDisplayName?: string; // Human-readable record name
}
```

### RequestContext

Request context extracted from Express Request object.

```typescript
interface RequestContext {
  ipAddress?: string; // Client IP (handles proxy headers)
  method?: string; // HTTP method (GET, POST, etc.)
  path?: string; // Request path
  userAgent?: string; // Browser/client user agent
  correlationId?: string; // Correlation ID from headers
  referer?: string; // Referer header
  userId?: string; // User ID extracted from JWT
  sessionId?: string; // Session ID extracted from JWT
  requestId?: string; // Request ID from headers
  requestSize?: number; // Request size from content-length header
}
```

### HasKey

Interface for objects that have a key and optional display name.

```typescript
interface HasKey {
  key: string; // Object key/identifier
  displayName?: string; // Human-readable name
}
```

### HasExternalSystem

Interface for objects that have an external system reference.

```typescript
interface HasExternalSystem extends HasKey {
  externalSystem?: HasKey; // Optional external system reference
}
```

## DataClient Types

### DataClientConfig

Configuration for DataClient instance.

```typescript
interface DataClientConfig {
  baseUrl: string;
  misoConfig: MisoClientConfig;
  tokenKeys?: string[];
  loginUrl?: string;
  logoutUrl?: string;
  cache?: CacheConfig;
  retry?: RetryConfig;
  audit?: AuditConfig;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  onTokenRefresh?: () => Promise<{ token: string; expiresIn: number }>;
}
```

**onTokenRefresh Callback:**

Callback to refresh user token when expired (for browser usage). Called automatically when a request receives 401 Unauthorized. Should call backend endpoint that handles refresh token securely. Returns new access token and expiration time.

**Security:** Refresh tokens should NEVER be stored in browser localStorage. The callback should delegate to your backend endpoint which securely manages refresh tokens (typically in httpOnly cookies or server-side sessions).

### ApiRequestOptions

Extended RequestInit with DataClient-specific options.

```typescript
interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  retries?: number;
  signal?: AbortSignal;
  timeout?: number;
  cache?: {
    enabled?: boolean;
    ttl?: number;
    key?: string;
  };
  skipAudit?: boolean;
}
```

### InterceptorConfig

Configuration for request/response/error interceptors.

```typescript
interface InterceptorConfig {
  onRequest?: RequestInterceptor;
  onResponse?: ResponseInterceptor;
  onError?: ErrorInterceptor;
}
```

### RequestMetrics

Request metrics structure.

```typescript
interface RequestMetrics {
  totalRequests: number;
  totalFailures: number;
  averageResponseTime: number;
  responseTimeDistribution: {
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  cacheHitRate: number;
}
```

### CacheConfig

Cache configuration.

```typescript
interface CacheConfig {
  enabled?: boolean;
  defaultTTL?: number;
  maxSize?: number;
}
```

### RetryConfig

Retry configuration.

```typescript
interface RetryConfig {
  enabled?: boolean;
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}
```

### ClientTokenResponse

Client token endpoint response including token, expiration, and DataClient configuration.

```typescript
interface ClientTokenResponse {
  /** Client token string */
  token: string;
  
  /** Token expiration time in seconds */
  expiresIn: number;
  
  /** DataClient configuration (included when includeConfig is true) */
  config?: DataClientConfigResponse;
}
```

### DataClientConfigResponse

DataClient configuration returned by client-token endpoint.

```typescript
interface DataClientConfigResponse {
  /** API base URL (derived from request) */
  baseUrl: string;
  
  /** MISO Controller URL (from misoClient config) */
  controllerUrl: string;
  
  /** Public controller URL for browser environments (if set) */
  controllerPublicUrl?: string;
  
  /** Client ID (from misoClient config) */
  clientId: string;
  
  /** Client token endpoint URI */
  clientTokenUri: string;
}
```

### ClientTokenEndpointOptions

Options for `createClientTokenEndpoint`.

```typescript
interface ClientTokenEndpointOptions {
  /** Client token endpoint URI (default: '/api/v1/auth/client-token') */
  clientTokenUri?: string;
  
  /** Token expiration time in seconds (default: 1800) */
  expiresIn?: number;
  
  /** Whether to include DataClient config in response (default: true) */
  includeConfig?: boolean;
}
```

### AutoInitOptions

Options for `autoInitializeDataClient`.

```typescript
interface AutoInitOptions {
  /** Client token endpoint URI (default: '/api/v1/auth/client-token') */
  clientTokenUri?: string;
  
  /** Override baseUrl detection (auto-detected from window.location if not provided) */
  baseUrl?: string;
  
  /** Error callback */
  onError?: (error: Error) => void;
  
  /** Whether to cache config in localStorage (default: true) */
  cacheConfig?: boolean;
}
```

## Utility Types

### Meta

Pagination metadata returned in API responses.

```typescript
interface Meta {
  /** Total number of items available in full dataset. */
  totalItems: number;
  /** Current page index (1-based). Maps from `page` query parameter. */
  currentPage: number;
  /** Number of items per page. Maps from `page_size` query parameter. */
  pageSize: number;
  /** Logical resource type (e.g., "application", "environment"). */
  type: string;
}
```

### PaginatedListResponse

Standard paginated list response envelope.

```typescript
interface PaginatedListResponse<T> {
  /** Pagination metadata. */
  meta: Meta;
  /** Array of items for the current page. */
  data: T[];
}
```

### FilterOperator

Filter operators supported by the API.

```typescript
type FilterOperator =
  | 'eq'        // Equals
  | 'neq'       // Not equals
  | 'in'        // In array
  | 'nin'       // Not in array
  | 'gt'        // Greater than
  | 'lt'        // Less than
  | 'gte'       // Greater than or equal
  | 'lte'       // Less than or equal
  | 'contains'  // String contains
  | 'like';     // Pattern match
```

### FilterOption

Single filter option with field, operator, and value.

```typescript
interface FilterOption {
  /** Field name to filter on. */
  field: string;
  /** Filter operator. */
  op: FilterOperator;
  /** Filter value (supports arrays for `in` and `nin` operators). */
  value: string | number | boolean | Array<string | number>;
}
```

### FilterQuery

Complete filter query including filters, sorting, pagination, and field selection.

```typescript
interface FilterQuery {
  /** Array of filter options. */
  filters?: FilterOption[];
  /** Array of sort fields (e.g., `['-updated_at', 'name']` where `-` prefix means descending). */
  sort?: string[];
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** Array of field names to include in response (field projection). */
  fields?: string[];
}
```

### SortOption

Sort option specifying field and order.

```typescript
interface SortOption {
  /** Field name to sort by. */
  field: string;
  /** Sort order: ascending or descending. */
  order: 'asc' | 'desc';
}
```

## Error Types

### ErrorResponse

Structured error response interface (camelCase format).

```typescript
interface ErrorResponse {
  errors: string[];           // Array of error messages
  type: string;               // Error type URI (e.g., "/Errors/Bad Input")
  title: string;              // Human-readable title
  statusCode: number;         // HTTP status code (supports both camelCase and snake_case)
  instance?: string;          // Request instance URI (optional)
}
```

### MisoClientError

Base error class for SDK errors.

```typescript
class MisoClientError extends Error {
  readonly errorResponse?: ErrorResponse;        // Structured error response (if available)
  readonly errorBody?: Record<string, unknown>;  // Raw error body (for backward compatibility)
  readonly statusCode?: number;                  // HTTP status code
}
```

### ErrorResponseSnakeCase

Canonical error response using snake_case format.

```typescript
interface ErrorResponseSnakeCase {
  /** Human-readable list of error messages. */
  errors: string[];
  /** RFC 7807 type URI. */
  type?: string;
  /** Short, human-readable title. */
  title?: string;
  /** HTTP status code. */
  status_code: number;
  /** URI/path identifying the error instance. */
  instance?: string;
  /** Request correlation key for debugging/audit. */
  request_key?: string;
}
```

### ErrorEnvelope

Top-level error envelope used in API responses.

```typescript
interface ErrorEnvelope {
  /** Error response object. */
  error: ErrorResponseSnakeCase;
}
```

### ApiErrorException

Exception class for snake_case error responses.

```typescript
class ApiErrorException extends Error {
  /** HTTP status code (snake_case). */
  status_code: number;
  /** Request correlation key for debugging/audit. */
  request_key?: string;
  /** RFC 7807 type URI. */
  type?: string;
  /** URI/path identifying the error instance. */
  instance?: string;
  /** Array of error messages. */
  errors: string[];
}
```

## Type Exports

All types are exported from the main package:

```typescript
import {
  // Client classes
  MisoClient,
  DataClient,
  
  // Configuration types
  MisoClientConfig,
  RedisConfig,
  AuditConfig,
  DataClientConfig,
  ApiRequestOptions,
  InterceptorConfig,
  RequestMetrics,
  CacheConfig,
  RetryConfig,
  
  // Authentication types
  AuthStrategy,
  AuthMethod,
  UserInfo,
  LoginResponse,
  LogoutResponse,
  
  // Utility types
  Meta,
  PaginatedListResponse,
  FilterOperator,
  FilterOption,
  FilterQuery,
  FilterBuilder,
  SortOption,
  
  // Error types
  ErrorResponse,
  MisoClientError,
  ErrorResponseSnakeCase,
  ErrorEnvelope,
  ApiErrorException,
  
  // Service types
  LogEntry,
  
  // Express utility types
  ClientTokenResponse,
  DataClientConfigResponse,
  ClientTokenEndpointOptions,
  AutoInitOptions,
} from '@aifabrix/miso-client';
```

## See Also

- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [DataClient Reference](./reference-dataclient.md) - Browser client
- [Authentication Reference](./reference-authentication.md) - Authentication types
- [Error Reference](./reference-errors.md) - Error handling types
- [Configuration Guide](./configuration.md) - Configuration options
