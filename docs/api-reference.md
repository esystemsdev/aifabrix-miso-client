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
  cache?: {
    // Optional: Cache configuration
    roleTTL?: number; // Role cache TTL in seconds
    permissionTTL?: number; // Permission cache TTL in seconds
  };
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

The SDK provides a logger service accessible via `client.log`.

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

```typescript
import { LoggerService } from '@aifabrix/miso-client';

const loggerService = new LoggerService(config, redisService);
```

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
  PermissionResult
} from '@aifabrix/miso-client';
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
