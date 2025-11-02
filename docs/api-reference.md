# API Reference

Complete reference documentation for the AI Fabrix Miso Client SDK.

## Table of Contents

- [MisoClient](#misoclient)
- [Configuration Types](#configuration-types)
- [Authentication Methods](#authentication-methods)
- [Authorization Methods](#authorization-methods)
- [Logging Methods](#logging-methods)
- [Utility Methods](#utility-methods)
- [Encryption Methods](#encryption-methods)
- [Cache Methods](#cache-methods)
- [Service Classes](#service-classes)
- [Error Handling](#error-handling)
- [Pagination Utilities](#pagination-utilities)
- [Filter Utilities](#filter-utilities)
- [Sort Utilities](#sort-utilities)

## MisoClient

The main client class that provides access to all SDK functionality.

### Constructor

```typescript
constructor(config: MisoClientConfig)
```

Creates a new MisoClient instance with the provided configuration.

**Parameters:**

- `config` - Configuration object (see [Configuration Types](#configuration-types))

**Example:**

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Recommended: Use loadConfig() to load from .env
const client = new MisoClient(loadConfig());

// Or manually:
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret'
});
```

### Methods

#### `initialize(): Promise<void>`

Initializes the client and establishes connections (Redis if configured).

**Returns:** Promise that resolves when initialization is complete

**Example:**

```typescript
await client.initialize();
console.log('Client ready');
```

#### `disconnect(): Promise<void>`

Disconnects from Redis and cleans up resources.

**Returns:** Promise that resolves when disconnection is complete

**Example:**

```typescript
await client.disconnect();
```

#### `isInitialized(): boolean`

Checks if the client has been initialized.

**Returns:** `true` if initialized, `false` otherwise

**Example:**

```typescript
if (client.isInitialized()) {
  // Client is ready to use
}
```

## Configuration Types

### MisoClientConfig

Main configuration interface for the MisoClient.

```typescript
interface MisoClientConfig {
  controllerUrl: string; // Required: AI Fabrix controller URL
  clientId: string; // Required: Client ID (e.g., 'ctrl-dev-my-app')
  clientSecret: string; // Required: Client secret
  redis?: RedisConfig; // Optional: Redis configuration
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Optional: Log level
  emitEvents?: boolean; // Optional: Emit log events instead of HTTP/Redis (for direct SDK embedding)
  cache?: {
    // Optional: Cache configuration
    roleTTL?: number; // Role cache TTL in seconds
    permissionTTL?: number; // Permission cache TTL in seconds
  };
  sensitiveFieldsConfig?: string; // Optional: Path to custom sensitive fields JSON configuration file
  audit?: AuditConfig; // Optional: Audit logging configuration
}
```

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

**Performance Impact:**
The SDK automatically optimizes audit logging performance:
- Small requests (< 10KB): < 1ms to ~15ms CPU overhead depending on level
- Medium requests (10KB-100KB): ~5ms to ~50ms CPU overhead depending on level
- Large requests (> 100KB): ~10ms to ~100ms CPU overhead depending on level
- Batch logging automatically reduces network overhead by 70-90%

→ [Complete Audit Configuration Guide](configuration.md#audit-configuration)

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

## Authentication Methods

### `login(redirectUri: string): void`

Initiates the login flow by redirecting to the controller.

**Parameters:**

- `redirectUri` - URL to redirect to after successful login

**Example:**

```typescript
// In browser environment
client.login(window.location.href);

// In Node.js environment (logs URL for manual navigation)
client.login('https://myapp.com/callback');
```

### `validateToken(token: string): Promise<boolean>`

Validates a JWT token with the controller.

**Parameters:**

- `token` - JWT token to validate

**Returns:** Promise resolving to `true` if token is valid, `false` otherwise

**Example:**

```typescript
const isValid = await client.validateToken(userToken);
if (isValid) {
  console.log('Token is valid');
}
```

### `getUser(token: string): Promise<UserInfo | null>`

Retrieves user information from a valid token.

**Parameters:**

- `token` - JWT token

**Returns:** Promise resolving to user information or `null` if invalid

**Example:**

```typescript
const user = await client.getUser(token);
if (user) {
  console.log(`Welcome, ${user.username}!`);
}
```

### `isAuthenticated(token: string): Promise<boolean>`

Checks if a user is authenticated (alias for `validateToken`).

**Parameters:**

- `token` - JWT token

**Returns:** Promise resolving to `true` if authenticated, `false` otherwise

**Example:**

```typescript
const isAuth = await client.isAuthenticated(token);
```

### `logout(): Promise<void>`

Logs out the current user.

**Returns:** Promise that resolves when logout is complete

**Example:**

```typescript
await client.logout();
console.log('User logged out');
```

## Authorization Methods

### Role Methods

#### `getRoles(token: string): Promise<string[]>`

Gets all roles for a user (cached in Redis if available).

**Parameters:**

- `token` - JWT token

**Returns:** Promise resolving to array of role names

**Example:**

```typescript
const roles = await client.getRoles(token);
console.log('User roles:', roles); // ['admin', 'user', 'editor']
```

#### `hasRole(token: string, role: string): Promise<boolean>`

Checks if user has a specific role.

**Parameters:**

- `token` - JWT token
- `role` - Role name to check

**Returns:** Promise resolving to `true` if user has the role

**Example:**

```typescript
const isAdmin = await client.hasRole(token, 'admin');
if (isAdmin) {
  console.log('User is an admin');
}
```

#### `hasAnyRole(token: string, roles: string[]): Promise<boolean>`

Checks if user has any of the specified roles.

**Parameters:**

- `token` - JWT token
- `roles` - Array of role names

**Returns:** Promise resolving to `true` if user has any of the roles

**Example:**

```typescript
const canEdit = await client.hasAnyRole(token, ['admin', 'editor']);
if (canEdit) {
  console.log('User can edit content');
}
```

#### `hasAllRoles(token: string, roles: string[]): Promise<boolean>`

Checks if user has all of the specified roles.

**Parameters:**

- `token` - JWT token
- `roles` - Array of role names

**Returns:** Promise resolving to `true` if user has all roles

**Example:**

```typescript
const isSuperAdmin = await client.hasAllRoles(token, ['admin', 'superuser']);
if (isSuperAdmin) {
  console.log('User is a super admin');
}
```

#### `refreshRoles(token: string): Promise<string[]>`

Force refreshes roles from controller (bypasses cache).

**Parameters:**

- `token` - JWT token

**Returns:** Promise resolving to fresh array of role names

**Example:**

```typescript
const freshRoles = await client.refreshRoles(token);
console.log('Fresh roles:', freshRoles);
```

### Permission Methods

#### `getPermissions(token: string): Promise<string[]>`

Gets all permissions for a user (cached in Redis if available).

**Parameters:**

- `token` - JWT token

**Returns:** Promise resolving to array of permission names

**Example:**

```typescript
const permissions = await client.getPermissions(token);
console.log('User permissions:', permissions);
```

#### `hasPermission(token: string, permission: string): Promise<boolean>`

Checks if user has a specific permission.

**Parameters:**

- `token` - JWT token
- `permission` - Permission name to check

**Returns:** Promise resolving to `true` if user has the permission

**Example:**

```typescript
const canDelete = await client.hasPermission(token, 'delete:posts');
if (canDelete) {
  console.log('User can delete posts');
}
```

#### `hasAnyPermission(token: string, permissions: string[]): Promise<boolean>`

Checks if user has any of the specified permissions.

**Parameters:**

- `token` - JWT token
- `permissions` - Array of permission names

**Returns:** Promise resolving to `true` if user has any permission

**Example:**

```typescript
const canModify = await client.hasAnyPermission(token, ['edit:posts', 'delete:posts']);
if (canModify) {
  console.log('User can modify posts');
}
```

#### `hasAllPermissions(token: string, permissions: string[]): Promise<boolean>`

Checks if user has all of the specified permissions.

**Parameters:**

- `token` - JWT token
- `permissions` - Array of permission names

**Returns:** Promise resolving to `true` if user has all permissions

**Example:**

```typescript
const canManage = await client.hasAllPermissions(token, [
  'create:posts',
  'edit:posts',
  'delete:posts'
]);
if (canManage) {
  console.log('User can fully manage posts');
}
```

#### `refreshPermissions(token: string): Promise<string[]>`

Force refreshes permissions from controller (bypasses cache).

**Parameters:**

- `token` - JWT token

**Returns:** Promise resolving to fresh array of permission names

**Example:**

```typescript
const freshPermissions = await client.refreshPermissions(token);
console.log('Fresh permissions:', freshPermissions);
```

#### `clearPermissionsCache(token: string): Promise<void>`

Clears cached permissions for a user.

**Parameters:**

- `token` - JWT token

**Returns:** Promise that resolves when cache is cleared

**Example:**

```typescript
await client.clearPermissionsCache(token);
console.log('Permissions cache cleared');
```

## Logging Methods

The SDK provides a logger service accessible via `client.log`. The logger extends `EventEmitter` and supports event emission mode for direct SDK embedding in your own application.

**Event Emission Mode:**
When `emitEvents = true` in config, logs are emitted as Node.js events instead of being sent via HTTP/Redis. See [Event Emission Mode Guide](configuration.md#event-emission-mode) for details.

### `log.error(message: string, context?: object): Promise<void>`

Logs an error message.

**Parameters:**

- `message` - Error message
- `context` - Optional context object

**Example:**

```typescript
await client.log.error('Database connection failed', {
  error: 'Connection timeout',
  host: 'db.example.com',
  port: 5432
});
```

### `log.audit(action: string, resource: string, context?: object): Promise<void>`

Logs an audit event.

**Parameters:**

- `action` - Action performed
- `resource` - Resource affected
- `context` - Optional context object

**Example:**

```typescript
await client.log.audit('user.login', 'authentication', {
  userId: user.id,
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

### `log.info(message: string, context?: object): Promise<void>`

Logs an info message.

**Parameters:**

- `message` - Info message
- `context` - Optional context object

**Example:**

```typescript
await client.log.info('User accessed dashboard', {
  userId: user.id,
  timestamp: new Date().toISOString()
});
```

### `log.debug(message: string, context?: object): Promise<void>`

Logs a debug message (only if log level is set to 'debug').

**Parameters:**

- `message` - Debug message
- `context` - Optional context object

**Example:**

```typescript
await client.log.debug('Processing user request', {
  userId: user.id,
  requestId: 'req-123',
  processingTime: '150ms'
});
```

## Utility Methods

### `getConfig(): MisoClientConfig`

Gets the current configuration (returns a copy).

**Returns:** Configuration object

**Example:**

```typescript
const config = client.getConfig();
console.log('Controller URL:', config.controllerUrl);
```

### `isRedisConnected(): boolean`

Checks if Redis is connected.

**Returns:** `true` if Redis is connected, `false` otherwise

**Example:**

```typescript
if (client.isRedisConnected()) {
  console.log('Using Redis caching');
} else {
  console.log('Using controller fallback');
}
```

## Encryption Methods

### `encryption: EncryptionService | undefined`

Gets the encryption service for data encryption/decryption. Returns `undefined` if encryption key is not configured.

**Note:** Encryption service requires an encryption key to be configured via `ENCRYPTION_KEY` environment variable or `encryptionKey` in config.

**Example:**

```typescript
if (client.encryption) {
  const encrypted = client.encryption.encrypt('sensitive-data');
  const decrypted = client.encryption.decrypt(encrypted);
  console.log('Decrypted:', decrypted);
}
```

### `encryption.encrypt(plaintext: string): string`

Encrypts plaintext using AES-256-GCM encryption.

**Parameters:**

- `plaintext` - The plaintext string to encrypt

**Returns:** Base64-encoded encrypted string

**Example:**

```typescript
const encrypted = client.encryption!.encrypt('my-secret-data');
console.log('Encrypted:', encrypted);
```

### `encryption.decrypt(encryptedText: string): string`

Decrypts a base64-encoded encrypted string.

**Parameters:**

- `encryptedText` - Base64-encoded encrypted string

**Returns:** Decrypted plaintext string

**Example:**

```typescript
const decrypted = client.encryption!.decrypt(encrypted);
console.log('Decrypted:', decrypted);
```

## Cache Methods

### `cache: CacheService`

Gets the cache service for generic caching with Redis support and in-memory fallback.

**Example:**

```typescript
// Store value in cache
await client.cache.set('my-key', { data: 'value' }, 300); // 300 seconds TTL

// Retrieve from cache
const value = await client.cache.get<{ data: string }>('my-key');
```

### `cache.get<T>(key: string): Promise<T | null>`

Gets a cached value by key. Checks Redis first, then falls back to memory cache.

**Parameters:**

- `key` - Cache key

**Returns:** Promise resolving to cached value or `null` if not found or expired

**Example:**

```typescript
const value = await client.cache.get<string>('my-key');
if (value) {
  console.log('Cached value:', value);
}
```

### `cache.set<T>(key: string, value: T, ttl: number): Promise<boolean>`

Sets a value in cache with TTL. Stores in both Redis (if available) and memory cache.

**Parameters:**

- `key` - Cache key
- `value` - Value to cache (will be JSON serialized)
- `ttl` - Time to live in seconds

**Returns:** Promise resolving to `true` if successful, `false` otherwise

**Example:**

```typescript
await client.cache.set('user:123', { name: 'John', age: 30 }, 600); // 10 minutes
```

### `cache.delete(key: string): Promise<boolean>`

Deletes a value from cache. Removes from both Redis and memory cache.

**Parameters:**

- `key` - Cache key

**Returns:** Promise resolving to `true` if deleted from at least one cache, `false` otherwise

**Example:**

```typescript
await client.cache.delete('user:123');
```

### `cache.clear(): Promise<void>`

Clears all cache entries from memory cache. Note: Redis keys are not cleared (use RedisService directly for pattern-based deletion).

**Example:**

```typescript
await client.cache.clear();
```

## Service Classes

The SDK exports individual service classes for advanced usage:

### AuthService

```typescript
import { AuthService } from '@aifabrix/miso-client';

const authService = new AuthService(config, redisService);
```

### RoleService

```typescript
import { RoleService } from '@aifabrix/miso-client';

const roleService = new RoleService(config, redisService);
```

### LoggerService

`LoggerService` extends `EventEmitter` and provides structured logging with optional event emission mode.

```typescript
import { LoggerService, LogEntry } from '@aifabrix/miso-client';

const loggerService = new LoggerService(httpClient, redisService);
```

**Event Emission Mode:**

When `emitEvents = true` in config, `LoggerService` emits events instead of sending logs via HTTP/Redis:

```typescript
// Enable event emission mode
const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true
});

// Listen to log events
client.log.on('log', (logEntry: LogEntry) => {
  // Save directly to DB without HTTP
  db.saveLog(logEntry);
});

// Listen to batch events (for batched audit logs)
client.log.on('log:batch', (logEntries: LogEntry[]) => {
  // Save batch directly to DB
  db.saveLogs(logEntries);
});
```

**Event Names:**
- `'log'`: Emitted for all log entries (info, debug, error, audit) with `LogEntry` payload
- `'log:batch'`: Emitted for batched audit logs with `LogEntry[]` payload

**EventEmitter Methods:**
All EventEmitter methods are available (`on`, `once`, `off`, `removeListener`, etc.)

→ [Event Emission Mode Guide](configuration.md#event-emission-mode)

### RedisService

```typescript
import { RedisService } from '@aifabrix/miso-client';

const redisService = new RedisService(redisConfig);
```

### HttpClient

```typescript
import { HttpClient } from '@aifabrix/miso-client';

const httpClient = new HttpClient(config);
```

### EncryptionService

```typescript
import { EncryptionService } from '@aifabrix/miso-client';

const encryptionService = new EncryptionService('your-encryption-key');
const encrypted = encryptionService.encrypt('sensitive-data');
const decrypted = encryptionService.decrypt(encrypted);
```

**Methods:**

- `encrypt(plaintext: string): string` - Encrypts plaintext using AES-256-GCM
- `decrypt(encryptedText: string): string` - Decrypts encrypted text

**Key Formats Supported:**

- Raw string (will be hashed with SHA-256 to derive 32-byte key)
- Hex string (64 hex characters = 32 bytes)
- Base64 string (must decode to exactly 32 bytes)

### CacheService

```typescript
import { CacheService, RedisService } from '@aifabrix/miso-client';

const redisService = new RedisService(redisConfig);
await redisService.connect();

const cacheService = new CacheService(redisService);
await cacheService.set('key', { data: 'value' }, 300); // 300 seconds TTL
const value = await cacheService.get<{ data: string }>('key');
```

**Methods:**

- `get<T>(key: string): Promise<T | null>` - Get cached value
- `set<T>(key: string, value: T, ttl: number): Promise<boolean>` - Set value with TTL
- `delete(key: string): Promise<boolean>` - Delete from cache
- `clear(): Promise<void>` - Clear memory cache
- `destroy(): void` - Cleanup resources

## Error Handling

The SDK handles errors gracefully and provides fallback mechanisms:

### Common Error Scenarios

1. **Redis Connection Failure**: Automatically falls back to controller
2. **Token Validation Failure**: Returns `false` or `null` instead of throwing
3. **Network Issues**: Logs warnings and continues with cached data when possible

### Error Handling Best Practices

```typescript
try {
  const isValid = await client.validateToken(token);
  if (!isValid) {
    throw new Error('Invalid token');
  }

  const user = await client.getUser(token);
  // ... use user data
} catch (error) {
  // Log the error
  await client.log.error('Authentication failed', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });

  // Handle appropriately
  console.error('Authentication error:', error);
}
```

### Structured Error Responses

The SDK supports RFC 7807-style structured error responses. When the controller returns a structured error response, it is automatically parsed and made available through the `MisoClientError` class.

#### ErrorResponse Interface

```typescript
interface ErrorResponse {
  errors: string[];           // Array of error messages
  type: string;               // Error type URI (e.g., "/Errors/Bad Input")
  title: string;              // Human-readable title
  statusCode: number;         // HTTP status code (supports both camelCase and snake_case)
  instance?: string;          // Request instance URI (optional)
}
```

#### MisoClientError Class

All HTTP errors from the SDK are thrown as `MisoClientError`, which extends the standard `Error` class:

```typescript
class MisoClientError extends Error {
  readonly errorResponse?: ErrorResponse;        // Structured error response (if available)
  readonly errorBody?: Record<string, unknown>;  // Raw error body (for backward compatibility)
  readonly statusCode?: number;                  // HTTP status code
}
```

#### Accessing Structured Error Information

```typescript
try {
  await client.validateToken(token);
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    // Access structured error details
    console.error('Error type:', error.errorResponse.type);
    console.error('Error title:', error.errorResponse.title);
    console.error('Errors:', error.errorResponse.errors);
    console.error('Status code:', error.errorResponse.statusCode);
    console.error('Instance:', error.errorResponse.instance);
    
    // Error message is automatically set to title or first error
    console.error('Message:', error.message);
  } else if (error instanceof MisoClientError) {
    // Fallback to errorBody for non-structured errors (backward compatibility)
    console.error('Error body:', error.errorBody);
    console.error('Status code:', error.statusCode);
  }
}
```

#### Backward Compatibility

The SDK maintains full backward compatibility. If a response doesn't match the structured error format, the error is still wrapped in `MisoClientError` with the `errorBody` property containing the raw response data:

```typescript
try {
  await client.get('/api/endpoint');
} catch (error) {
  if (error instanceof MisoClientError) {
    // Structured error (new format)
    if (error.errorResponse) {
      console.log('Structured errors:', error.errorResponse.errors);
    }
    // Non-structured error (old format)
    else if (error.errorBody) {
      console.log('Error body:', error.errorBody);
    }
    
    // Status code is always available
    console.log('Status:', error.statusCode);
  }
}
```

#### Field Name Compatibility

The `statusCode` field supports both camelCase (`statusCode`) and snake_case (`status_code`) for compatibility with different response formats:

```typescript
// Both formats are supported:
{
  errors: ['Error message'],
  type: '/Errors/Test',
  title: 'Test Error',
  statusCode: 400  // camelCase
}

// OR

{
  errors: ['Error message'],
  type: '/Errors/Test',
  title: 'Test Error',
  status_code: 400  // snake_case
}
```

### Snake_case Error Handling

The SDK provides utilities for handling snake_case error responses following enterprise application best practices and industry standards (ISO 27001 compliant).

#### ErrorResponseSnakeCase Interface

Canonical error response using snake_case format following enterprise application best practices. Follows RFC 7807-style structured error format and ISO 27001 compliance standards.

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

#### ErrorEnvelope Interface

Top-level error envelope used in API responses.

```typescript
interface ErrorEnvelope {
  /** Error response object. */
  error: ErrorResponseSnakeCase;
}
```

#### ApiErrorException Class

Exception class for snake_case error responses. Used with snake_case ErrorResponse format.

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

**Example:**

```typescript
import { ApiErrorException, ErrorResponseSnakeCase } from '@aifabrix/miso-client';

try {
  // Some API call that throws ApiErrorException
} catch (error) {
  if (error instanceof ApiErrorException) {
    console.error('Status code:', error.status_code);
    console.error('Errors:', error.errors);
    console.error('Type:', error.type);
    console.error('Request key:', error.request_key);
  }
}
```

#### `transform_error_to_snake_case(err: unknown): ErrorResponseSnakeCase`

Transforms arbitrary error into standardized snake_case ErrorResponse. Handles both camelCase and snake_case error formats.

**Parameters:**

- `err` - Error object (AxiosError, network error, etc.)

**Returns:** Standardized snake_case ErrorResponse

**Example:**

```typescript
import { transform_error_to_snake_case } from '@aifabrix/miso-client';

try {
  // Some operation that might fail
} catch (error) {
  const standardizedError = transform_error_to_snake_case(error);
  console.error('Error status:', standardizedError.status_code);
  console.error('Error messages:', standardizedError.errors);
  console.error('Error type:', standardizedError.type);
}
```

#### `handle_api_error_snake_case(err: unknown): never`

Handles API error and throws snake_case ApiErrorException.

**Parameters:**

- `err` - Error object (AxiosError, network error, etc.)

**Throws:** ApiErrorException with snake_case error format

**Example:**

```typescript
import { handle_api_error_snake_case } from '@aifabrix/miso-client';

try {
  // Some API operation
} catch (error) {
  // Transform and throw as ApiErrorException
  handle_api_error_snake_case(error);
}
```

#### Compatibility Note

The SDK supports both error formats for maximum compatibility:

- **camelCase** (`ErrorResponse`) - Used with `MisoClientError` class
- **snake_case** (`ErrorResponseSnakeCase`) - Used with `ApiErrorException` class

Both formats are automatically handled by `transform_error_to_snake_case()` which normalizes errors from various sources into the snake_case format.

### HTTP Status Codes

The SDK handles common HTTP status codes:

- **200**: Success
- **401**: Unauthorized (invalid token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not found
- **500**: Internal server error

### Timeout Configuration

Default timeout is 30 seconds for HTTP requests. This can be configured in the HttpClient if needed.

## Type Definitions

All types are exported from the main package:

```typescript
import {
  MisoClient,
  MisoClientConfig,
  RedisConfig,
  UserInfo,
  AuthResult,
  LogEntry,
  RoleResult,
  PermissionResult,
  ErrorResponse,
  MisoClientError,
  // Pagination types
  Meta,
  PaginatedListResponse,
  // Filter types
  FilterOperator,
  FilterOption,
  FilterQuery,
  FilterBuilder,
  // Sort types
  SortOption,
  // Error types (snake_case)
  ErrorResponseSnakeCase,
  ErrorEnvelope,
  ApiErrorException
} from '@aifabrix/miso-client';
```

## Pagination Utilities

Utilities for parsing and constructing paginated responses. All functions use **snake_case** naming conventions following enterprise application best practices and industry standards (ISO 27001 compliant).

### Meta Interface

Pagination metadata returned in API responses.

```typescript
interface Meta {
  /** Total number of items available in full dataset. */
  total_items: number;
  /** Current page index (1-based). Maps from `page` query parameter. */
  current_page: number;
  /** Number of items per page. Maps from `page_size` query parameter. */
  page_size: number;
  /** Logical resource type (e.g., "application", "environment"). */
  type: string;
}
```

### PaginatedListResponse Interface

Standard paginated list response envelope.

```typescript
interface PaginatedListResponse<T> {
  /** Pagination metadata. */
  meta: Meta;
  /** Array of items for the current page. */
  data: T[];
}
```

### `parse_pagination_params(query: Record<string, unknown>): { current_page: number; page_size: number }`

Parses query parameters into pagination values. The `page` query parameter (1-based) is mapped to `current_page` in the result.

**Parameters:**

- `query` - Query parameters object (e.g., from URLSearchParams or request query)

**Returns:** Object with `current_page` (1-based) and `page_size`

**Example:**

```typescript
import { parse_pagination_params } from '@aifabrix/miso-client';

// From URL query: ?page=2&page_size=25
const { current_page, page_size } = parse_pagination_params({
  page: '2',
  page_size: '25'
});
// Returns: { current_page: 2, page_size: 25 }

// Defaults to page 1, page_size 20 if not provided
const defaults = parse_pagination_params({});
// Returns: { current_page: 1, page_size: 20 }
```

### `create_meta_object(total_items: number, current_page: number, page_size: number, type: string): Meta`

Constructs a Meta object for API responses.

**Parameters:**

- `total_items` - Total number of items available in full dataset
- `current_page` - Current page index (1-based)
- `page_size` - Number of items per page
- `type` - Logical resource type (e.g., "application", "environment")

**Returns:** Meta object

**Example:**

```typescript
import { create_meta_object } from '@aifabrix/miso-client';

const meta = create_meta_object(120, 1, 25, 'application');
// Returns: {
//   total_items: 120,
//   current_page: 1,
//   page_size: 25,
//   type: 'application'
// }
```

### `apply_pagination_to_array<T>(items: T[], current_page: number, page_size: number): T[]`

Applies pagination to an array (useful for mocks/tests).

**Parameters:**

- `items` - Array of items to paginate
- `current_page` - Current page index (1-based)
- `page_size` - Number of items per page

**Returns:** Paginated slice of the array

**Example:**

```typescript
import { apply_pagination_to_array } from '@aifabrix/miso-client';

const allItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const page1 = apply_pagination_to_array(allItems, 1, 5);
// Returns: [1, 2, 3, 4, 5]

const page2 = apply_pagination_to_array(allItems, 2, 5);
// Returns: [6, 7, 8, 9, 10]
```

### `create_paginated_list_response<T>(items: T[], total_items: number, current_page: number, page_size: number, type: string): PaginatedListResponse<T>`

Wraps an array and metadata into a standard paginated response.

**Parameters:**

- `items` - Array of items for the current page
- `total_items` - Total number of items available in full dataset
- `current_page` - Current page index (1-based)
- `page_size` - Number of items per page
- `type` - Logical resource type (e.g., "application", "environment")

**Returns:** PaginatedListResponse object

**Example:**

```typescript
import { create_paginated_list_response } from '@aifabrix/miso-client';

const items = [{ id: 1, name: 'App 1' }, { id: 2, name: 'App 2' }];
const response = create_paginated_list_response(items, 50, 1, 25, 'application');
// Returns: {
//   meta: {
//     total_items: 50,
//     current_page: 1,
//     page_size: 25,
//     type: 'application'
//   },
//   data: [{ id: 1, name: 'App 1' }, { id: 2, name: 'App 2' }]
// }
```

## Filter Utilities

Utilities for parsing and building filter queries. All functions use **snake_case** naming conventions following enterprise application best practices and industry standards (ISO 27001 compliant).

### FilterOperator Type

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

### FilterOption Interface

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

### FilterQuery Interface

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
  page_size?: number;
  /** Array of field names to include in response (field projection). */
  fields?: string[];
}
```

### FilterBuilder Class

Builder class for dynamic filter construction. Supports fluent API for building complex filter queries.

```typescript
class FilterBuilder {
  /**
   * Add a single filter to the builder.
   * @param field - Field name to filter on
   * @param op - Filter operator
   * @param value - Filter value (supports arrays for `in` and `nin`)
   * @returns FilterBuilder instance for method chaining
   */
  add(field: string, op: FilterOperator, value: string | number | boolean | Array<string | number>): FilterBuilder;

  /**
   * Add multiple filters at once.
   * @param filters - Array of filter options to add
   * @returns FilterBuilder instance for method chaining
   */
  addMany(filters: FilterOption[]): FilterBuilder;

  /**
   * Build and return the filter array.
   * @returns Array of filter options
   */
  build(): FilterOption[];

  /**
   * Convert filters to query string format.
   * @returns Query string with filter parameters (e.g., `?filter=field:op:value&filter=...`)
   */
  toQueryString(): string;
}
```

**Example:**

```typescript
import { FilterBuilder } from '@aifabrix/miso-client';

// Build filters dynamically
const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('region', 'in', ['eu', 'us'])
  .add('created_at', 'gte', '2024-01-01');

// Get filter array
const filters = filterBuilder.build();
// Returns: [
//   { field: 'status', op: 'eq', value: 'active' },
//   { field: 'region', op: 'in', value: ['eu', 'us'] },
//   { field: 'created_at', op: 'gte', value: '2024-01-01' }
// ]

// Convert to query string
const queryString = filterBuilder.toQueryString();
// Returns: "filter=status:eq:active&filter=region:in:eu,us&filter=created_at:gte:2024-01-01"
```

### `parse_filter_params(query: Record<string, unknown>): FilterOption[]`

Parses filter query parameters into structured FilterOption array. Supports format: `?filter=field:op:value` or `?filter[]=field:op:value&filter[]=...`

**Parameters:**

- `query` - Query parameters object (e.g., from URLSearchParams or request query)

**Returns:** Array of parsed filter options

**Example:**

```typescript
import { parse_filter_params } from '@aifabrix/miso-client';

// From URL query: ?filter=status:eq:active&filter=region:in:eu,us
const filters = parse_filter_params({
  filter: ['status:eq:active', 'region:in:eu,us']
});
// Returns: [
//   { field: 'status', op: 'eq', value: 'active' },
//   { field: 'region', op: 'in', value: ['eu', 'us'] }
// ]
```

### `build_query_string(options: FilterQuery): string`

Builds query string from FilterQuery object.

**Parameters:**

- `options` - FilterQuery object with filters, sort, pagination, and field selection

**Returns:** Query string (e.g., `?filter=status:eq:active&sort=-updated_at&page=1&page_size=25`)

**Example:**

```typescript
import { build_query_string, FilterBuilder } from '@aifabrix/miso-client';

const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active');

const queryString = build_query_string({
  filters: filterBuilder.build(),
  sort: ['-updated_at'],
  page: 1,
  page_size: 25
});
// Returns: "filter=status:eq:active&sort=-updated_at&page=1&page_size=25"
```

### `apply_filters<T extends Record<string, unknown>>(data: T[], filters: FilterOption[]): T[]`

Applies filters locally to an array (used for mocks/tests).

**Parameters:**

- `data` - Array of items to filter
- `filters` - Array of filter options to apply

**Returns:** Filtered array

**Example:**

```typescript
import { apply_filters } from '@aifabrix/miso-client';

const items = [
  { id: 1, status: 'active', region: 'eu' },
  { id: 2, status: 'inactive', region: 'us' },
  { id: 3, status: 'active', region: 'eu' }
];

const filters = [
  { field: 'status', op: 'eq', value: 'active' },
  { field: 'region', op: 'eq', value: 'eu' }
];

const filtered = apply_filters(items, filters);
// Returns: [
//   { id: 1, status: 'active', region: 'eu' },
//   { id: 3, status: 'active', region: 'eu' }
// ]
```

## Sort Utilities

Utilities for parsing and building sort query parameters. All functions use **snake_case** naming conventions following enterprise application best practices and industry standards (ISO 27001 compliant).

### SortOption Interface

Sort option specifying field and order.

```typescript
interface SortOption {
  /** Field name to sort by. */
  field: string;
  /** Sort order: ascending or descending. */
  order: 'asc' | 'desc';
}
```

### `parse_sort_params(query: Record<string, unknown>): SortOption[]`

Parses sort query parameters into structured SortOption array. Supports format: `?sort=-field` (descending) or `?sort=field` (ascending) or `?sort[]=-updated_at&sort[]=name` for multiple sorts.

**Parameters:**

- `query` - Query parameters object (e.g., from URLSearchParams or request query)

**Returns:** Array of parsed sort options

**Example:**

```typescript
import { parse_sort_params } from '@aifabrix/miso-client';

// From URL query: ?sort=-updated_at&sort=name
const sortOptions = parse_sort_params({
  sort: ['-updated_at', 'name']
});
// Returns: [
//   { field: 'updated_at', order: 'desc' },
//   { field: 'name', order: 'asc' }
// ]

// Single sort
const singleSort = parse_sort_params({ sort: '-created_at' });
// Returns: [{ field: 'created_at', order: 'desc' }]
```

### `build_sort_string(sortOptions: SortOption[]): string[]`

Converts SortOption array to query string format.

**Parameters:**

- `sortOptions` - Array of sort options

**Returns:** Array of sort strings (e.g., `['-updated_at', 'name']`)

**Example:**

```typescript
import { build_sort_string } from '@aifabrix/miso-client';

const sortOptions = [
  { field: 'updated_at', order: 'desc' },
  { field: 'name', order: 'asc' }
];

const sortStrings = build_sort_string(sortOptions);
// Returns: ['-updated_at', 'name']
```

## Browser vs Node.js

The SDK works in both environments with some differences:

### Browser

- `login()` method logs URL for manual navigation
- Uses browser's built-in fetch for HTTP requests
- Redis connection requires WebSocket support

### Node.js

- `login()` method logs URL to console
- Uses axios for HTTP requests
- Full Redis support with ioredis

## Performance Considerations

- **Caching**: Roles and permissions are cached for 15 minutes by default
- **Redis**: Significantly improves performance for high-traffic applications
- **Fallback**: Graceful degradation when Redis is unavailable
- **Connection Pooling**: Automatic connection management for Redis
- **Audit Logging**: Automatically optimized with intelligent processing, truncation, and batching
  - Size-based optimization (fast path for small requests, optimized processing for large requests)
  - Batch logging reduces network overhead by 70-90%
  - Configurable audit levels for performance tuning (`minimal`, `standard`, `detailed`, `full`)
