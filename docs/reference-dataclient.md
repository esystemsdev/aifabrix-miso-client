# DataClient API Reference

Complete API reference for the DataClient class - a browser-compatible HTTP client wrapper around MisoClient that provides enhanced HTTP capabilities for React, Vue, Angular, and other front-end applications.

> **📖 For complete guide with examples and best practices, see [DataClient Documentation](./data-client.md)**

## Table of Contents

- [Constructor](#constructor)
- [HTTP Methods](#http-methods)
- [Authentication](#authentication)
- [Authorization Methods](#authorization-methods)
- [Authentication Methods](#authentication-methods)
- [Utility Methods](#utility-methods)
- [Configuration Types](#configuration-types)
- [Error Types](#error-types)
- [Examples](#examples)
- [See Also](#see-also)

## Constructor

```typescript
constructor(config: DataClientConfig)
```

Creates a new DataClient instance with the provided configuration.

**Parameters:**

- `config` - Configuration object (see [DataClient Configuration Types](#configuration-types))

**Zero-Config Browser Setup (Recommended):**

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - automatically fetches config and initializes DataClient
const dataClient = await autoInitializeDataClient();
```

**When to use zero-config:**

- ✅ Quick setup - Get started in seconds
- ✅ No environment variables needed in frontend build
- ✅ Single source of truth - All config from server
- ✅ Automatic caching - Config cached for faster page loads

**Manual Browser Setup:**

```typescript
import { DataClient } from '@aifabrix/miso-client';

// Create DataClient instance WITHOUT clientSecret
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ DO NOT include clientSecret in browser code
    
    // ✅ Use server-provided token endpoint (automatic token fetching)
    clientTokenUri: '/api/v1/auth/client-token', // Default if not specified
  },
  // Optional: Custom configuration
  cache: {
    enabled: true,
    defaultTTL: 600, // Custom cache TTL
  },
  retry: {
    enabled: true,
    maxRetries: 5, // Custom retry count
  },
});
```

**When to use manual setup:**

- ✅ Custom configuration - Need specific cache, retry, or audit settings
- ✅ Environment variables - Want to use build-time env vars
- ✅ Multiple instances - Need different configs for different endpoints
- ✅ Testing - Easier to mock with explicit configuration
- ✅ Legacy code - Migrating existing manual configuration

**Server-Side Only Example:**

```typescript
// ✅ SAFE: Server-side only (Node.js/Express)
import { DataClient } from '@aifabrix/miso-client';

const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientSecret: process.env.MISO_CLIENTSECRET, // ✅ Safe in server environment
  },
});
```

### ⚠️ Security Warning: Browser Usage

**IMPORTANT:** Never expose `clientSecret` in browser/client-side code. Client secrets are sensitive credentials that should only be used in server-side environments.

For browser applications, use the **Server-Provided Client Token Pattern** (see [DataClient Documentation - Authentication](./data-client.md#step-2-browser-setup) for details).

## HTTP Methods

### `get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>`

Make a GET request with caching support.

**Parameters:**

- `endpoint` - API endpoint path
- `options` - Optional request options (see [ApiRequestOptions](#apirequestoptions))

**Returns:** Promise resolving to response data

**Example:**

```typescript
const users = await dataClient.get<User[]>('/api/users');
```

### `post<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`

Make a POST request.

**Parameters:**

- `endpoint` - API endpoint path
- `data` - Request body data (will be JSON stringified)
- `options` - Optional request options

**Returns:** Promise resolving to response data

**Example:**

```typescript
const newUser = await dataClient.post<User>('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});
```

### `put<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`

Make a PUT request.

**Example:**

```typescript
const updatedUser = await dataClient.put<User>('/api/users/123', {
  name: 'Jane Doe',
});
```

### `patch<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`

Make a PATCH request.

**Example:**

```typescript
const patchedUser = await dataClient.patch<User>('/api/users/123', {
  email: 'newemail@example.com',
});
```

### `delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>`

Make a DELETE request.

**Example:**

```typescript
await dataClient.delete('/api/users/123');
```

## Authentication

### ⚠️ Security: Client Token Pattern for Browser

For browser applications, use the **Server-Provided Client Token Pattern** to avoid exposing `clientSecret`:

**Zero-Config Setup (Recommended):**

**Server-Side: One Line**

```typescript
// Server: Express.js example
import express from 'express';
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const app = express();

// Initialize MisoClient on server
const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// One line - automatically includes DataClient config in response
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
```

**Browser-Side: One Line**

```typescript
// Browser: Zero-config initialization
import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - automatically fetches config and initializes DataClient
const dataClient = await autoInitializeDataClient();
```

**Manual Setup (Alternative):**

**Server-Side: Manual Token Endpoint**

```typescript
// Server: Express.js example
import express from 'express';
import { MisoClient, getEnvironmentToken, loadConfig } from '@aifabrix/miso-client';

const app = express();

// Initialize MisoClient on server
const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// Manual token endpoint (if not using createClientTokenEndpoint)
app.post('/api/v1/auth/client-token', 
  authenticateUser,           // ✅ User must be authenticated
  rateLimit({ window: '15m', max: 10 }), // ✅ Rate limiting
  async (req, res) => {
    try {
      // getEnvironmentToken validates origin and logs audit events
      const token = await getEnvironmentToken(misoClient, req);
      
      // Return token with short expiration for browser
      res.json({
        token: token,
        expiresIn: 1800, // 30 minutes (shorter than server-side)
      });
    } catch (error) {
      res.status(403).json({
        error: 'Origin validation failed or token fetch failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
```

**Browser-Side: Manual Configuration**

```typescript
// Browser: Manual DataClient setup
import { DataClient } from '@aifabrix/miso-client';

const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ NO clientSecret
    
    // ✅ Use server-provided token endpoint
    clientTokenUri: '/api/v1/auth/client-token', // Default if not specified
  },
});

// Get environment token (handles caching automatically)
const token = await dataClient.getEnvironmentToken();
```

**Client Token Expiration:**

The SDK automatically checks token expiration using multiple methods:

1. **Expiration timestamp**: Checks `miso:client-token-expires-at` from localStorage
2. **JWT expiration claim**: If expiration timestamp is missing, decodes JWT to extract `exp` claim
3. **Automatic cleanup**: Expired tokens are automatically removed from cache

This ensures tokens are always validated before use, preventing authentication errors from expired tokens.

### User Token Management

DataClient automatically retrieves user authentication tokens from `localStorage` using configurable keys:

```typescript
// Default token keys: ['token', 'accessToken', 'authToken']
// DataClient checks these keys in order

// Store token in localStorage
localStorage.setItem('token', 'your-jwt-token');

// DataClient automatically uses the token for authenticated requests
const users = await dataClient.get('/api/users');
```

### Custom Token Keys

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  tokenKeys: ['myAppToken', 'authToken'], // Custom token keys
});
```

### Skip Authentication

```typescript
// Make unauthenticated request
const publicData = await dataClient.get('/api/public', {
  skipAuth: true,
});
```

## Authorization Methods

DataClient provides convenient methods for checking user permissions and roles. All methods automatically retrieve the token from localStorage if not provided.

### Permission Methods

#### `getPermissions(token?: string): Promise<string[]>`

Get all user permissions.

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to array of permission strings

**Example:**

```typescript
const permissions = await dataClient.getPermissions();
console.log('User permissions:', permissions); // ['read:users', 'write:posts']
```

#### `hasPermission(permission: string, token?: string): Promise<boolean>`

Check if user has specific permission.

**Parameters:**

- `permission` - Permission string to check
- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if user has the permission, `false` otherwise

**Example:**

```typescript
const canReadUsers = await dataClient.hasPermission('read:users');
if (canReadUsers) {
  // Show user list
}
```

#### `hasAnyPermission(permissions: string[], token?: string): Promise<boolean>`

Check if user has any of the specified permissions.

**Parameters:**

- `permissions` - Array of permission strings to check
- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if user has any of the permissions, `false` otherwise

**Example:**

```typescript
const canModify = await dataClient.hasAnyPermission(['write:posts', 'delete:posts']);
if (canModify) {
  // Show edit/delete buttons
}
```

#### `hasAllPermissions(permissions: string[], token?: string): Promise<boolean>`

Check if user has all of the specified permissions.

**Parameters:**

- `permissions` - Array of permission strings to check
- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if user has all of the permissions, `false` otherwise

**Example:**

```typescript
const canManage = await dataClient.hasAllPermissions(['read:users', 'write:users', 'delete:users']);
if (canManage) {
  // Show full user management UI
}
```

#### `refreshPermissions(token?: string): Promise<string[]>`

Force refresh permissions from controller (bypass cache).

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to array of permission strings

**Example:**

```typescript
const freshPermissions = await dataClient.refreshPermissions();
```

#### `clearPermissionsCache(token?: string): Promise<void>`

Clear cached permissions for a user.

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Example:**

```typescript
await dataClient.clearPermissionsCache();
```

### Role Methods

#### `getRoles(token?: string): Promise<string[]>`

Get all user roles.

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to array of role strings

**Example:**

```typescript
const roles = await dataClient.getRoles();
console.log('User roles:', roles); // ['admin', 'user']
```

#### `hasRole(role: string, token?: string): Promise<boolean>`

Check if user has specific role.

**Parameters:**

- `role` - Role string to check
- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if user has the role, `false` otherwise

**Example:**

```typescript
const isAdmin = await dataClient.hasRole('admin');
if (isAdmin) {
  // Show admin panel
}
```

#### `hasAnyRole(roles: string[], token?: string): Promise<boolean>`

Check if user has any of the specified roles.

**Parameters:**

- `roles` - Array of role strings to check
- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if user has any of the roles, `false` otherwise

**Example:**

```typescript
const isModerator = await dataClient.hasAnyRole(['admin', 'moderator']);
if (isModerator) {
  // Show moderation tools
}
```

#### `hasAllRoles(roles: string[], token?: string): Promise<boolean>`

Check if user has all of the specified roles.

**Parameters:**

- `roles` - Array of role strings to check
- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if user has all of the roles, `false` otherwise

**Example:**

```typescript
const isSuperAdmin = await dataClient.hasAllRoles(['admin', 'super-admin']);
if (isSuperAdmin) {
  // Show super admin features
}
```

#### `refreshRoles(token?: string): Promise<string[]>`

Force refresh roles from controller (bypass cache).

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to array of role strings

**Example:**

```typescript
const freshRoles = await dataClient.refreshRoles();
```

#### `clearRolesCache(token?: string): Promise<void>`

Clear cached roles for a user.

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Example:**

```typescript
await dataClient.clearRolesCache();
```

**Note:** All authorization methods return empty arrays `[]` or `false` if MisoClient is not initialized or token is not available. Permissions and roles are cached in-memory with a 15-minute TTL by default.

## Authentication Methods

DataClient provides methods for validating tokens and getting user information.

### `validateToken(token?: string): Promise<boolean>`

Validate token with controller.

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if token is valid, `false` otherwise

**Example:**

```typescript
const isValid = await dataClient.validateToken();
if (isValid) {
  // Token is valid
}
```

### `getUser(token?: string): Promise<UserInfo | null>`

Get user information from token.

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to user info object or `null` if not authenticated

**Example:**

```typescript
const user = await dataClient.getUser();
if (user) {
  console.log('User ID:', user.id);
  console.log('Username:', user.username);
  console.log('Email:', user.email);
}
```

### `getUserInfo(token?: string): Promise<UserInfo | null>`

Get user information from API endpoint.

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to user info object or `null` if not authenticated

**Example:**

```typescript
const userInfo = await dataClient.getUserInfo();
if (userInfo) {
  console.log('User:', userInfo);
}
```

### `isAuthenticatedAsync(token?: string): Promise<boolean>`

Check if authenticated (async version, alias for validateToken).

**Parameters:**

- `token` - Optional user authentication token (auto-retrieved from localStorage if not provided)

**Returns:** Promise that resolves to `true` if authenticated, `false` otherwise

**Example:**

```typescript
const isAuthenticated = await dataClient.isAuthenticatedAsync();
if (isAuthenticated) {
  // User is authenticated
}
```

**Note:** All authentication methods return `null` or `false` if MisoClient is not initialized or token is not available.

## Utility Methods

### `isAuthenticated(): boolean`

Check if user is authenticated (token exists in localStorage).

**Returns:** `true` if authenticated, `false` otherwise

**Example:**

```typescript
if (dataClient.isAuthenticated()) {
  const users = await dataClient.get('/api/users');
}
```

### `handleOAuthCallback(): string | null`

Handle OAuth callback from authentication redirect. Extracts token from URL hash fragment (`#token=...`), validates it, stores it securely, and immediately cleans up the URL hash to prevent token exposure. ISO 27001 compliant with immediate cleanup and validation.

**Returns:** Extracted token string or `null` if not found/invalid

**Security Features:**

- **Immediate hash cleanup**: Removes token from URL within < 100ms to prevent exposure
- **Token format validation**: Verifies JWT format (3 parts separated by dots) before storage
- **HTTPS enforcement**: Validates HTTPS in production environments (rejects HTTP tokens)
- **Synchronous extraction**: Extracts hash before any async operations
- **Secure error handling**: Fails silently without exposing tokens in errors

**Auto-call on Initialization:**

This method is automatically called when DataClient is initialized in a browser environment, ensuring tokens are extracted immediately when the page loads.

**Example:**

```typescript
// Auto-called on initialization
const dataClient = new DataClient(config);
// Token is automatically extracted if present in URL hash

// Or manually call
const token = dataClient.handleOAuthCallback();
if (token) {
  console.log('Token extracted and stored');
}
```

**OAuth Flow:**

1. User calls `redirectToLogin()` → redirects to controller login page
2. Controller handles OAuth flow with Keycloak
3. Controller redirects back to your app: `https://myapp.com/dashboard#token=eyJhbGc...`
4. `handleOAuthCallback()` extracts token from hash fragment
5. Token is validated and stored in localStorage
6. Hash fragment is immediately removed from URL (< 100ms)
7. User sees clean URL: `https://myapp.com/dashboard`

**Note:** Hash fragments (`#token=...`) are more secure than query parameters because:

- Not sent to server (not in access logs)
- Not stored in browser history
- Not included in referrer headers
- Only accessible via JavaScript

### `redirectToLogin(redirectUrl?: string): Promise<void>`

Redirect to login page via controller. Makes a direct fetch request to the controller's login endpoint with `x-client-token` header, then redirects to the controller's login URL for proper OAuth flow handling.

**Parameters:**

- `redirectUrl` - Optional redirect URL to return to after login (defaults to current page URL: `window.location.href`)

**How it works:**

1. Builds controller URL dynamically from configuration (`controllerPublicUrl` → `controllerUrl` → fallback to static `loginUrl`)
2. Gets client token (from cache, config, or `getEnvironmentToken()`)
3. Makes direct fetch request to `/api/v1/auth/login` with `x-client-token` header and redirect query parameter
4. Redirects browser to the controller's login URL returned in response
5. Controller handles OAuth flow and redirects back to the specified URL after authentication with token in hash fragment (`#token=...`)
6. Falls back to static `loginUrl` config if controller URL is not configured or controller call fails

**OAuth Callback Flow:**

After authentication, the controller redirects back to your application with the token in the URL hash fragment:

```bash
https://myapp.com/dashboard#token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The token is automatically extracted by `handleOAuthCallback()` (called on DataClient initialization) or can be called manually. The hash fragment is immediately removed from the URL for security.

**Security:**

- Uses `x-client-token` header (lowercase) for authentication
- Never exposes `clientId` or `clientSecret` in browser code
- Token passed in hash fragment (`#token=...`) not query parameter (hash fragments are not sent to server, not in logs, not in browser history)
- Token is immediately removed from URL after extraction (< 100ms)
- Supports both nested (`data.loginUrl`) and flat (`loginUrl`) response formats

**Example:**

```typescript
// Redirect with current page as redirect (default)
if (!dataClient.isAuthenticated()) {
  await dataClient.redirectToLogin();
}

// Redirect with custom redirect URL
await dataClient.redirectToLogin('https://myapp.com/dashboard');

// After authentication, controller redirects to: https://myapp.com/dashboard#token=...
// Token is automatically extracted and stored securely
```

### `logout(redirectUrl?: string): Promise<void>`

Logout user, clear authentication state, and redirect. Makes a direct fetch request to the controller logout API with `x-client-token` header (if available), clears tokens from localStorage, clears HTTP cache, and redirects to logout URL or login page.

**Parameters:**

- `redirectUrl` - Optional redirect URL after logout (defaults to `logoutUrl` config, then `loginUrl` config, then `/login`)

**How it works:**

1. Gets current user token from localStorage
2. Builds controller URL dynamically from configuration (`controllerPublicUrl` → `controllerUrl`)
3. Gets client token (from cache, config, or `getEnvironmentToken()`)
4. Makes direct fetch request to `/api/v1/auth/logout` with `x-client-token` header and user token in request body
5. Clears all configured token keys from localStorage (always, even if API call fails)
6. Clears HTTP response cache
7. Redirects to logout URL (redirectUrl param > logoutUrl config > loginUrl config > '/login')

**Note:** Logout always clears local state (tokens, cache) even if the API call fails. This ensures users are logged out locally regardless of network issues.

**Security:**

- Uses `x-client-token` header (lowercase) for authentication
- Never exposes `clientId` or `clientSecret` in browser code
- User token is sent in request body, not headers

**Example:**

```typescript
// Basic logout - redirects to loginUrl or '/login'
await dataClient.logout();

// Logout and redirect to home page
await dataClient.logout('/home');

// Logout and redirect to custom URL
await dataClient.logout('https://myapp.com/goodbye');

// Configure logoutUrl in config
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  logoutUrl: '/goodbye', // Custom logout page
});

await dataClient.logout(); // Redirects to /goodbye
```

### `setInterceptors(config: InterceptorConfig): void`

Configure request/response/error interceptors.

**Parameters:**

- `config` - Interceptor configuration (see [InterceptorConfig](#interceptorconfig))

**Example:**

```typescript
dataClient.setInterceptors({
  onRequest: async (url, options) => {
    return { ...options, headers: { ...options.headers, 'X-Custom': 'value' } };
  },
  onResponse: async (response, data) => {
    return { ...data, timestamp: Date.now() };
  },
  onError: async (error) => {
    console.error('Request failed:', error);
    return error;
  },
});
```

### `setAuditConfig(config: Partial<AuditConfig>): void`

Update audit logging configuration.

**Parameters:**

- `config` - Partial audit configuration

**Example:**

```typescript
dataClient.setAuditConfig({
  level: 'detailed',
  maxResponseSize: 20000,
});
```

### `clearCache(): void`

Clear all cached responses.

**Example:**

```typescript
dataClient.clearCache();
```

### `getMetrics(): RequestMetrics`

Get request metrics.

**Returns:** Request metrics object (see [RequestMetrics](#requestmetrics))

**Example:**

```typescript
const metrics = dataClient.getMetrics();
console.log('Total requests:', metrics.totalRequests);
console.log('Error rate:', metrics.errorRate);
console.log('Cache hit rate:', metrics.cacheHitRate);
```

## Configuration Types

### `DataClientConfig`

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

**Security Notes:**

- **Browser Applications:** Use `clientToken` and `onClientTokenRefresh` in `misoConfig` instead of `clientSecret`
- **Server Applications:** Can safely use `clientSecret` in `misoConfig` (stored in environment variables)
- See [Authentication](#authentication) section for the Client Token Pattern

**Token Refresh Callback:**

The `onTokenRefresh` callback is called automatically when a request receives a 401 Unauthorized response. It should call your backend endpoint that handles refresh token securely (refresh tokens should NEVER be stored in browser localStorage).

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  onTokenRefresh: async () => {
    // Call your backend endpoint that handles refresh token securely
    const response = await fetch('/api/refresh-token', {
      credentials: 'include', // Include cookies for auth
    });
    return await response.json(); // { token: string, expiresIn: number }
  }
});
```

**Automatic Token Refresh:**

When `onTokenRefresh` is configured, DataClient automatically:

1. Detects 401 Unauthorized errors
2. Calls `onTokenRefresh` callback to get new token
3. Updates token in localStorage
4. Retries the original request with new token
5. Redirects to login if refresh fails

**Security:** Refresh tokens are handled server-side only. The frontend callback delegates to your backend endpoint which securely manages refresh tokens (typically in httpOnly cookies or server-side sessions).

**MisoClientConfig Browser-Safe Fields:**

```typescript
interface MisoClientConfig {
  controllerUrl: string;
  clientId: string;
  // ❌ DO NOT use clientSecret in browser code
  clientSecret?: string; // Server-side only
  
  // ✅ Browser-safe: Server-provided client token
  clientToken?: string;
  clientTokenExpiresAt?: Date | number;
  onClientTokenRefresh?: () => Promise<{ token: string; expiresIn: number }>;
  
  // ... other fields
}
```

### `ApiRequestOptions`

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

### `InterceptorConfig`

Configuration for request/response/error interceptors.

```typescript
interface InterceptorConfig {
  onRequest?: RequestInterceptor;
  onResponse?: ResponseInterceptor;
  onError?: ErrorInterceptor;
}
```

### `RequestMetrics`

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

### `CacheConfig`

Cache configuration.

```typescript
interface CacheConfig {
  enabled?: boolean;
  defaultTTL?: number;
  maxSize?: number;
}
```

### `RetryConfig`

Retry configuration.

```typescript
interface RetryConfig {
  enabled?: boolean;
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}
```

For complete type definitions, see [Type Reference](./reference-types.md).

## Error Types

### `NetworkError`

Thrown on network failures (connection errors, CORS issues, etc.).

```typescript
class NetworkError extends ApiError {
  constructor(message: string, originalError?: Error);
}
```

### `TimeoutError`

Thrown when a request exceeds the timeout.

```typescript
class TimeoutError extends ApiError {
  constructor(message: string, timeout: number);
}
```

### `AuthenticationError`

Thrown on 401 Unauthorized responses.

```typescript
class AuthenticationError extends ApiError {
  constructor(message: string, response?: Response);
}
```

### `ApiError`

Base error class for API errors.

```typescript
class ApiError extends Error {
  statusCode?: number;
  response?: Response;
  originalError?: Error;
}
```

For complete error handling documentation, see [Error Reference](./reference-errors.md).

## Examples

### HTTP Request Examples

```typescript
import { DataClient } from '@aifabrix/miso-client';

const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientTokenUri: '/api/v1/auth/client-token',
  },
});

// GET request
const users = await dataClient.get<User[]>('/api/users');

// POST request
const newUser = await dataClient.post<User>('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// PUT request
const updatedUser = await dataClient.put<User>('/api/users/123', {
  name: 'Jane Doe',
});

// PATCH request
const patchedUser = await dataClient.patch<User>('/api/users/123', {
  email: 'newemail@example.com',
});

// DELETE request
await dataClient.delete('/api/users/123');
```

### Authentication Flow Examples

```typescript
// Check authentication status
if (!dataClient.isAuthenticated()) {
  await dataClient.redirectToLogin();
}

// Validate token
const isValid = await dataClient.validateToken();
if (isValid) {
  const user = await dataClient.getUser();
  console.log('User:', user);
}

// Logout
await dataClient.logout('/home');
```

### Authorization Examples

```typescript
// Check permissions
const canReadUsers = await dataClient.hasPermission('read:users');
const canModify = await dataClient.hasAnyPermission(['write:posts', 'delete:posts']);
const canManage = await dataClient.hasAllPermissions(['read:users', 'write:users', 'delete:users']);

// Check roles
const isAdmin = await dataClient.hasRole('admin');
const isModerator = await dataClient.hasAnyRole(['admin', 'moderator']);
const isSuperAdmin = await dataClient.hasAllRoles(['admin', 'super-admin']);

// Refresh permissions/roles
const freshPermissions = await dataClient.refreshPermissions();
const freshRoles = await dataClient.refreshRoles();
```

## See Also

- [DataClient Documentation](./data-client.md) - Complete DataClient guide with examples and security best practices
- [DataClient Examples](./data-client.md#examples) - Code examples in the guide
- [Authentication Reference](./reference-authentication.md) - Detailed authentication API reference
- [Authorization Reference](./reference-authorization.md) - Detailed authorization API reference
- [Type Reference](./reference-types.md) - Complete type definitions
- [Error Reference](./reference-errors.md) - Error handling documentation
- [Examples Guide](./examples.md) - Framework-specific examples
