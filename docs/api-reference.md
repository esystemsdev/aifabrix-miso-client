# API Reference

Complete reference documentation for the AI Fabrix Miso Client SDK.

## Table of Contents

- [MisoClient](#misoclient)
- [Configuration Types](#configuration-types)
- [Authentication Methods](#authentication-methods)
- [Authorization Methods](#authorization-methods)
- [Logging Methods](#logging-methods)
- [Utility Methods](#utility-methods)
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
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app'
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
  environment: 'dev' | 'tst' | 'pro'; // Required: Environment
  applicationKey: string; // Required: Application identifier
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
