# DataClient Browser Wrapper

The **DataClient** is a browser-compatible HTTP client wrapper around MisoClient that provides enhanced HTTP capabilities for React, Vue, and other front-end applications. It includes ISO 27001 compliant audit logging, automatic data masking, caching, retry logic, and more.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [HTTP Methods](#http-methods)
- [Authentication](#authentication)
- [ISO 27001 Audit Logging](#iso-27001-audit-logging)
- [Caching](#caching)
- [Retry Logic](#retry-logic)
- [Interceptors](#interceptors)
- [Request Metrics](#request-metrics)
- [Error Handling](#error-handling)
- [Browser Compatibility](#browser-compatibility)
- [API Reference](#api-reference)
- [Examples](#examples)

## Overview

DataClient extends the standard `fetch` API with:

- **ISO 27001 Compliant Audit Logging** - Automatic audit trail for all HTTP requests with sensitive data masking
- **Response Caching** - In-memory cache with configurable TTL for GET requests
- **Automatic Retry** - Exponential backoff retry logic for retryable errors
- **Request Deduplication** - Prevents duplicate concurrent requests
- **Request Metrics** - Track response times, error rates, and cache performance
- **Browser Compatibility** - Works in React, Vue, Angular, and other front-end frameworks
- **SSR Support** - Graceful degradation for server-side rendering

## Installation

DataClient is included in the `@aifabrix/miso-client` package:

```bash
npm install @aifabrix/miso-client
```

## ⚠️ Security Warning: Browser Usage

**IMPORTANT:** Never expose `clientSecret` in browser/client-side code. Client secrets are sensitive credentials that should only be used in server-side environments.

For browser applications, use the **Server-Provided Client Token Pattern** (see [Authentication](#authentication) section below).

## Quick Start

### Browser-Safe Configuration (Recommended)

```typescript
import { DataClient } from '@aifabrix/miso-client';

// Server provides client token (see Authentication section)
const initialClientToken = window.INITIAL_CLIENT_TOKEN; // From server
const tokenExpiresAt = window.INITIAL_CLIENT_TOKEN_EXPIRES_AT;

// Create DataClient instance WITHOUT clientSecret
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ DO NOT include clientSecret in browser code
    
    // ✅ Use server-provided token
    clientToken: initialClientToken,
    clientTokenExpiresAt: tokenExpiresAt,
    
    // ✅ Refresh callback calls your server endpoint
    onClientTokenRefresh: async () => {
      const response = await fetch('/api/client-token', {
        credentials: 'include', // Include cookies for auth
      });
      return await response.json(); // { token: string, expiresIn: number }
    },
  },
});

// Make authenticated requests
const users = await dataClient.get('/api/users');
const newUser = await dataClient.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});
```

### Server-Side Only Configuration

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

## Configuration

### ⚠️ Security: Browser vs Server Configuration

**Browser Applications (React, Vue, Angular):**

- ❌ **NEVER** include `clientSecret` in configuration
- ✅ Use server-provided `clientToken` with refresh callback
- ✅ See the Authentication section below for the Client Token Pattern

**Server Applications (Node.js, Express):**

- ✅ Can use `clientSecret` (stored in environment variables)
- ✅ Full MisoClient features available

### Basic Configuration

#### Browser-Safe Configuration (Recommended)

```typescript
import { DataClient, DataClientConfig } from '@aifabrix/miso-client';

const config: DataClientConfig = {
  // Required: Base URL for API requests
  baseUrl: 'https://api.example.com',
  
  // Required: MisoClient configuration for authentication and audit logging
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ DO NOT include clientSecret in browser code
    
    // ✅ Server-provided client token (see Client Token Pattern section)
    clientToken: initialClientToken, // From server endpoint or initial page load
    clientTokenExpiresAt: initialExpiresAt,
    
    // ✅ Refresh callback - calls your server endpoint
    onClientTokenRefresh: async () => {
      const response = await fetch('/api/client-token', {
        credentials: 'include',
      });
      const data = await response.json();
      return {
        token: data.token,
        expiresIn: data.expiresIn,
      };
    },
  },
  
  // Optional: Token storage keys in localStorage (default: ['token', 'accessToken', 'authToken'])
  tokenKeys: ['token', 'accessToken'],
  
  // Optional: Login redirect URL (default: '/login')
  loginUrl: '/login',
  
  // Optional: Default request timeout in milliseconds (default: 30000)
  timeout: 30000,
  
  // Optional: Default headers for all requests
  defaultHeaders: {
    'X-Custom-Header': 'value',
  },
};
```

#### Server-Side Configuration

```typescript
// ✅ SAFE: Server-side only
const config: DataClientConfig = {
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientSecret: process.env.MISO_CLIENTSECRET, // ✅ Safe in server environment
  },
};
```

### Cache Configuration

```typescript
const config: DataClientConfig = {
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  
  cache: {
    // Enable/disable caching (default: true)
    enabled: true,
    
    // Default TTL in seconds (default: 300 = 5 minutes)
    defaultTTL: 300,
    
    // Maximum cache size in entries (default: 100)
    maxSize: 100,
  },
};
```

### Retry Configuration

```typescript
const config: DataClientConfig = {
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  
  retry: {
    // Enable/disable retry logic (default: true)
    enabled: true,
    
    // Maximum number of retries (default: 3)
    maxRetries: 3,
    
    // Base delay in milliseconds for exponential backoff (default: 1000)
    baseDelay: 1000,
    
    // Maximum delay in milliseconds (default: 10000)
    maxDelay: 10000,
  },
};
```

### ISO 27001 Audit Configuration

```typescript
const config: DataClientConfig = {
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  
  audit: {
    // Enable/disable audit logging (default: true)
    enabled: true,
    
    // Audit detail level (default: 'standard')
    // - minimal: Only method, URL, status, duration, userId
    // - standard: Includes headers and bodies (masked)
    // - detailed: Includes sizes and more metadata
    // - full: Complete audit trail with all details
    level: 'standard',
    
    // Batch size for queued audit logs (default: 10)
    batchSize: 10,
    
    // Maximum response size to include in audit logs (default: 10000)
    maxResponseSize: 10000,
    
    // Maximum size before skipping masking (default: 50000)
    maxMaskingSize: 50000,
    
    // Endpoints to skip audit logging (e.g., ['/health', '/metrics'])
    skipEndpoints: ['/health', '/metrics'],
  },
};
```

## HTTP Methods

DataClient provides methods for all standard HTTP verbs:

### GET Request

```typescript
// Simple GET request
const users = await dataClient.get<User[]>('/api/users');

// GET with options
const user = await dataClient.get<User>('/api/users/123', {
  headers: {
    'X-Custom-Header': 'value',
  },
  cache: {
    enabled: true,
    ttl: 600, // 10 minutes
  },
});
```

### POST Request

```typescript
// POST with data
const newUser = await dataClient.post<User>('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// POST with options
const result = await dataClient.post<CreateResponse>('/api/users', userData, {
  skipAuth: false,
  timeout: 10000,
});
```

### PUT Request

```typescript
const updatedUser = await dataClient.put<User>('/api/users/123', {
  name: 'Jane Doe',
  email: 'jane@example.com',
});
```

### PATCH Request

```typescript
const patchedUser = await dataClient.patch<User>('/api/users/123', {
  email: 'newemail@example.com',
});
```

### DELETE Request

```typescript
await dataClient.delete('/api/users/123');
```

## Authentication

### ⚠️ Security: Client Token Pattern for Browser

For browser applications, use the **Server-Provided Client Token Pattern** to avoid exposing `clientSecret`:

#### Server-Side: Token Refresh Endpoint

```typescript
// Server: Express.js example
import express from 'express';
import { MisoClient } from '@aifabrix/miso-client';

const app = express();

// Secure token refresh endpoint
app.get('/api/client-token', 
  authenticateUser,           // ✅ User must be authenticated
  rateLimit({ window: '15m', max: 10 }), // ✅ Rate limiting
  async (req, res) => {
    // Server uses clientSecret securely
    const serverClient = new MisoClient({
      controllerUrl: 'https://controller.aifabrix.ai',
      clientId: 'ctrl-dev-my-app',
      clientSecret: process.env.MISO_CLIENTSECRET, // ✅ Environment variable
    });
    
    const token = await serverClient.getEnvironmentToken();
    
    // Return token with short expiration for browser
    res.json({
      token: token,
      expiresIn: 1800, // 30 minutes (shorter than server-side)
    });
  }
);

// Initial page load: Provide token to browser
app.get('/', authenticateUser, async (req, res) => {
  const serverClient = new MisoClient({
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientSecret: process.env.MISO_CLIENTSECRET,
  });
  
  const token = await serverClient.getEnvironmentToken();
  
  res.render('index', {
    initialClientToken: token,
    initialClientTokenExpiresAt: Date.now() + 1800000, // 30 minutes
  });
});
```

#### Browser-Side: Use Client Token

```typescript
// Browser: Use server-provided token
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ NO clientSecret
    
    // Initial token from server
    clientToken: window.INITIAL_CLIENT_TOKEN,
    clientTokenExpiresAt: new Date(window.INITIAL_CLIENT_TOKEN_EXPIRES_AT),
    
    // Refresh callback - calls your server endpoint
    onClientTokenRefresh: async () => {
      const response = await fetch('/api/client-token', {
        credentials: 'include', // Include cookies for user auth
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh client token');
      }
      
      return await response.json(); // { token: string, expiresIn: number }
    },
  },
});
```

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

### Check Authentication Status

```typescript
if (dataClient.isAuthenticated()) {
  // User is authenticated
  const users = await dataClient.get('/api/users');
} else {
  // Redirect to login via controller
  await dataClient.redirectToLogin();
  // After authentication, user will be redirected back to current page
}
```

### Redirect to Login with Custom URL

```typescript
// Redirect to login and return to dashboard after authentication
await dataClient.redirectToLogin('https://myapp.com/dashboard');

// Controller handles OAuth flow and redirects to dashboard after login
```

### Logout User

```typescript
// Basic logout - redirects to login page
await dataClient.logout();

// Logout and redirect to home page
await dataClient.logout('/home');

// Configure custom logout URL
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  logoutUrl: '/goodbye', // Custom logout page
});

await dataClient.logout(); // Redirects to /goodbye
```

**What logout does:**

- Calls controller logout API to invalidate server-side session
- Clears authentication tokens from localStorage
- Clears HTTP response cache
- Redirects to logout URL or login page

### Automatic Login Redirect

DataClient automatically redirects to the login page on 401 errors via the controller:

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  loginUrl: '/login', // Fallback login URL if controller unavailable
});

// On 401 error, automatically calls controller login endpoint
// and redirects to controller's login URL
try {
  await dataClient.get('/api/protected');
} catch (error) {
  // User will be redirected to controller login URL
  // After authentication, controller redirects back to current page
}
```

### Client Token Refresh

When using the client token pattern, DataClient automatically refreshes expired tokens:

```typescript
// Token refresh happens automatically when:
// 1. Token expires (checked with 60s buffer)
// 2. Audit logging requires client token
// 3. Token refresh callback is called

// The refresh callback should:
// - Require user authentication
// - Implement rate limiting
// - Return { token: string, expiresIn: number }
// - Handle errors gracefully

const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientToken: initialToken,
    clientTokenExpiresAt: initialExpiresAt,
    onClientTokenRefresh: async () => {
      // This is called automatically when token expires
      const response = await fetch('/api/client-token', {
        credentials: 'include',
      });
      return await response.json();
    },
  },
});
```

### Get Environment Token (Browser-Side)

DataClient provides a browser-side method to fetch environment tokens with automatic caching:

```typescript
// Get environment token (checks cache first, then calls backend)
const token = await dataClient.getEnvironmentToken();

// Token is automatically cached in localStorage
// Cache keys: 'miso:client-token' and 'miso:client-token-expires-at'
// Cache expires based on expiresIn from backend response
```

**Configuration:**

The `getEnvironmentToken()` method uses `clientTokenUri` from `misoConfig` or defaults to `/api/v1/auth/client-token`:

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // Optional: Custom client token endpoint URI
    clientTokenUri: '/api/v1/auth/client-token', // Default
  },
});
```

**Server-Side Route Example:**

Create a server-side route that validates origin and returns the token:

```typescript
// Server: Express.js example
import express from 'express';
import { MisoClient, getEnvironmentToken } from '@aifabrix/miso-client';

const app = express();
const misoClient = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET,
  // Configure allowed origins for CORS validation
  allowedOrigins: [
    'http://localhost:3000',
    'https://myapp.com',
    'http://localhost:*', // Wildcard port support
  ],
});

// Client token endpoint with origin validation
app.post('/api/v1/auth/client-token', async (req, res) => {
  try {
    // getEnvironmentToken validates origin and logs audit events
    const token = await getEnvironmentToken(misoClient, req);
    
    res.json({
      token,
      expiresIn: 1800, // 30 minutes
    });
  } catch (error) {
    res.status(403).json({
      error: 'Origin validation failed or token fetch failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
```

**Environment Variable Configuration:**

Configure allowed origins via environment variable:

```bash
# .env file
MISO_ALLOWED_ORIGINS=http://localhost:3000,https://myapp.com,http://localhost:*
```

**Security Best Practices:**

1. **Always validate origins** - Configure `allowedOrigins` in server-side MisoClient config
2. **Use HTTPS in production** - Never allow HTTP origins in production
3. **Rate limit endpoints** - Implement rate limiting on client token endpoints
4. **Require authentication** - Ensure user is authenticated before issuing client tokens
5. **Short expiration times** - Use shorter expiration times for browser tokens (e.g., 30 minutes)

### Get Client Token Info

Extract application and environment information from the client token:

```typescript
// Get token info (application, environment, applicationId, clientId)
const tokenInfo = dataClient.getClientTokenInfo();

if (tokenInfo) {
  console.log('Application:', tokenInfo.application);
  console.log('Environment:', tokenInfo.environment);
  console.log('Application ID:', tokenInfo.applicationId);
  console.log('Client ID:', tokenInfo.clientId);
} else {
  console.log('No client token available');
}
```

**Use Cases:**

- Display current application/environment in UI
- Debug token information
- Conditional logic based on environment

**Example: Display Current Environment**

```typescript
function EnvironmentBadge() {
  const dataClient = useDataClient(); // Your hook or context
  const tokenInfo = dataClient.getClientTokenInfo();
  
  if (!tokenInfo) {
    return <div>No environment info</div>;
  }
  
  return (
    <div>
      <span>Environment: {tokenInfo.environment || 'unknown'}</span>
      <span>Application: {tokenInfo.application || 'unknown'}</span>
    </div>
  );
}
```

## ISO 27001 Audit Logging

DataClient automatically logs all HTTP requests/responses for ISO 27001 compliance with sensitive data masking.

### Audit Levels

#### Minimal Level

Logs only basic information:

- Request method
- URL
- Status code
- Duration
- User ID (if available)

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  audit: {
    level: 'minimal',
  },
});
```

#### Standard Level (Default)

Includes headers and bodies (masked):

- All minimal level fields
- Request headers (masked)
- Response headers (masked)
- Request body (masked)
- Response body (masked)

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  audit: {
    level: 'standard',
  },
});
```

#### Detailed Level

Includes sizes and more metadata:

- All standard level fields
- Request size
- Response size

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  audit: {
    level: 'detailed',
  },
});
```

#### Full Level

Complete audit trail with all details.

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  audit: {
    level: 'full',
  },
});
```

### Sensitive Data Masking

DataClient automatically masks sensitive data before logging:

- Passwords, tokens, API keys
- PII (email, phone, SSN, etc.)
- Financial data (credit cards, bank accounts)
- Custom sensitive fields (configurable)

```typescript
// Sensitive data is automatically masked in audit logs
await dataClient.post('/api/users', {
  username: 'john',
  password: 'secret123', // Will be masked as ***MASKED***
  email: 'john@example.com', // Will be masked as ***MASKED***
});
```

### Skip Audit for Specific Endpoints

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  audit: {
    skipEndpoints: ['/health', '/metrics', '/ping'],
  },
});

// This request won't be audited
await dataClient.get('/health');
```

### Skip Audit for Specific Requests

```typescript
// Skip audit for this specific request
await dataClient.get('/api/users', {
  skipAudit: true,
});
```

### Update Audit Configuration

```typescript
// Update audit configuration at runtime
dataClient.setAuditConfig({
  level: 'detailed',
  maxResponseSize: 20000,
});
```

## Caching

DataClient provides in-memory caching for GET requests to improve performance.

### Basic Caching

```typescript
// First request - fetches from API
const users1 = await dataClient.get('/api/users');

// Second request - returns from cache (if within TTL)
const users2 = await dataClient.get('/api/users');
```

### Cache Configuration

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  cache: {
    enabled: true,
    defaultTTL: 300, // 5 minutes
    maxSize: 100, // Maximum 100 cached entries
  },
});
```

### Per-Request Cache Control

```typescript
// Disable cache for this request
const users = await dataClient.get('/api/users', {
  cache: {
    enabled: false,
  },
});

// Custom TTL for this request
const user = await dataClient.get('/api/users/123', {
  cache: {
    ttl: 600, // 10 minutes
  },
});

// Custom cache key
const data = await dataClient.get('/api/data', {
  cache: {
    key: 'custom-cache-key',
    ttl: 300,
  },
});
```

### Clear Cache

```typescript
// Clear all cached responses
dataClient.clearCache();
```

## Retry Logic

DataClient automatically retries failed requests with exponential backoff.

### Retryable Errors

- Network errors (connection failures, timeouts)
- 5xx server errors
- 408 Request Timeout
- 429 Too Many Requests

### Non-Retryable Errors

- 4xx client errors (except 401/403)
- 401 Unauthorized
- 403 Forbidden

### Retry Configuration

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  retry: {
    enabled: true,
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
  },
});
```

### Per-Request Retry Control

```typescript
// Disable retry for this request
const result = await dataClient.get('/api/users', {
  retries: 0,
});

// Custom retry count
const result = await dataClient.get('/api/users', {
  retries: 5,
});
```

## Interceptors

DataClient supports request, response, and error interceptors for custom transformation.

### Request Interceptor

```typescript
dataClient.setInterceptors({
  onRequest: async (url, options) => {
    // Transform request before sending
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Custom-Header': 'value',
      },
    };
  },
});
```

### Response Interceptor

```typescript
dataClient.setInterceptors({
  onResponse: async (response, data) => {
    // Transform response data
    return {
      ...data,
      timestamp: Date.now(),
    };
  },
});
```

### Error Interceptor

```typescript
dataClient.setInterceptors({
  onError: async (error, response) => {
    // Transform error
    if (error instanceof AuthenticationError) {
      // Handle authentication errors
      console.error('Authentication failed');
    }
    return error;
  },
});
```

### Multiple Interceptors

```typescript
dataClient.setInterceptors({
  onRequest: async (url, options) => {
    // Add request ID
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Request-ID': generateRequestId(),
      },
    };
  },
  onResponse: async (response, data) => {
    // Log response
    console.log('Response received:', data);
    return data;
  },
  onError: async (error) => {
    // Log error
    console.error('Request failed:', error);
    return error;
  },
});
```

## Request Metrics

DataClient tracks request metrics for monitoring and performance analysis.

### Get Metrics

```typescript
const metrics = dataClient.getMetrics();

console.log('Total requests:', metrics.totalRequests);
console.log('Total failures:', metrics.totalFailures);
console.log('Average response time:', metrics.averageResponseTime, 'ms');
console.log('Error rate:', metrics.errorRate);
console.log('Cache hit rate:', metrics.cacheHitRate);
console.log('Response time distribution:', metrics.responseTimeDistribution);
```

### Metrics Structure

```typescript
interface RequestMetrics {
  totalRequests: number;
  totalFailures: number;
  averageResponseTime: number;
  responseTimeDistribution: {
    min: number;
    max: number;
    p50: number;  // 50th percentile
    p95: number;  // 95th percentile
    p99: number;  // 99th percentile
  };
  errorRate: number;        // 0-1
  cacheHitRate: number;      // 0-1
}
```

## Error Handling

DataClient provides custom error types for better error handling.

### Error Types

#### NetworkError

Thrown on network failures (connection errors, CORS issues, etc.)

```typescript
try {
  await dataClient.get('/api/users');
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  }
}
```

#### TimeoutError

Thrown when a request exceeds the timeout

```typescript
try {
  await dataClient.get('/api/users', { timeout: 1000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Request timeout:', error.message);
  }
}
```

#### AuthenticationError

Thrown on 401 Unauthorized responses

```typescript
try {
  await dataClient.get('/api/protected');
} catch (error) {
  if (error instanceof AuthenticationError) {
    // User will be automatically redirected to login
    console.error('Authentication required');
  }
}
```

#### ApiError

Base error class for API errors

```typescript
try {
  await dataClient.get('/api/users');
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Response:', error.response);
  }
}
```

## Browser Compatibility

DataClient is designed for browser environments but gracefully handles SSR scenarios.

### Browser Detection

DataClient automatically detects browser environment and uses appropriate APIs:

- `localStorage` for token storage
- `window.location` for redirects
- `fetch` API for HTTP requests
- `AbortController` for request cancellation

### SSR Support

DataClient gracefully degrades in server-side rendering environments:

```typescript
// Works in both browser and SSR
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
});

// isAuthenticated() returns false in SSR
if (dataClient.isAuthenticated()) {
  // Browser-only code
}
```

### Request Cancellation

```typescript
// Create AbortController
const controller = new AbortController();

// Make request with signal
const promise = dataClient.get('/api/users', {
  signal: controller.signal,
});

// Cancel request
controller.abort();

try {
  await promise;
} catch (error) {
  // Request was cancelled
}
```

### Timeout Handling

```typescript
// Per-request timeout
const result = await dataClient.get('/api/users', {
  timeout: 5000, // 5 seconds
});

// Global timeout configuration
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  timeout: 30000, // 30 seconds default
});
```

## API Reference

### DataClient Class

#### Constructor

```typescript
constructor(config: DataClientConfig)
```

Creates a new DataClient instance.

#### Methods

##### HTTP Methods

- `get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>`
- `post<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`
- `put<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`
- `patch<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`
- `delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>`

##### Utility Methods

- `isAuthenticated(): boolean` - Check if user is authenticated
- `redirectToLogin(redirectUrl?: string): Promise<void>` - Redirect to login page via controller with optional redirect URL
- `logout(redirectUrl?: string): Promise<void>` - Logout user, clear tokens and cache, and redirect
- `getEnvironmentToken(): Promise<string>` - Get environment/client token (browser-side with caching)
- `getClientTokenInfo(): ClientTokenInfo | null` - Extract application and environment info from client token
- `setInterceptors(config: InterceptorConfig): void` - Configure interceptors
- `setAuditConfig(config: Partial<AuditConfig>): void` - Update audit configuration
- `clearCache(): void` - Clear all cached responses
- `getMetrics(): RequestMetrics` - Get request metrics

### Type Definitions

See [TypeScript definitions](../src/types/data-client.types.ts) for complete type definitions.

## Examples

### React Example

```typescript
import { DataClient } from '@aifabrix/miso-client';
import { useEffect, useState } from 'react';

// ✅ Browser-safe configuration with client token pattern
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ NO clientSecret in browser code
    
    // ✅ Server-provided client token (from initial page load or API)
    clientToken: window.INITIAL_CLIENT_TOKEN,
    clientTokenExpiresAt: new Date(window.INITIAL_CLIENT_TOKEN_EXPIRES_AT),
    
    // ✅ Refresh callback - calls your server endpoint
    onClientTokenRefresh: async () => {
      const response = await fetch('/api/client-token', {
        credentials: 'include',
      });
      return await response.json();
    },
  },
});

function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await dataClient.get('/api/users');
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### Vue Example

```typescript
import { DataClient } from '@aifabrix/miso-client';
import { ref, onMounted } from 'vue';

// ✅ Browser-safe configuration
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ NO clientSecret in browser code
    clientToken: window.INITIAL_CLIENT_TOKEN,
    clientTokenExpiresAt: new Date(window.INITIAL_CLIENT_TOKEN_EXPIRES_AT),
    onClientTokenRefresh: async () => {
      const response = await fetch('/api/client-token', {
        credentials: 'include',
      });
      return await response.json();
    },
  },
});

export default {
  setup() {
    const users = ref([]);
    const loading = ref(true);

    onMounted(async () => {
      try {
        const data = await dataClient.get('/api/users');
        users.value = data;
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        loading.value = false;
      }
    });

    return { users, loading };
  },
};
```

### Error Handling Example

```typescript
import { DataClient, NetworkError, AuthenticationError, TimeoutError } from '@aifabrix/miso-client';

const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
});

async function fetchData() {
  try {
    const data = await dataClient.get('/api/users');
    return data;
  } catch (error) {
    if (error instanceof NetworkError) {
      console.error('Network error - check your connection');
    } else if (error instanceof TimeoutError) {
      console.error('Request timeout - try again');
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication required - redirecting to login');
      // Already handled by DataClient
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
```

### Caching Example

```typescript
// Enable caching for frequently accessed data
const users = await dataClient.get('/api/users', {
  cache: {
    ttl: 600, // Cache for 10 minutes
  },
});

// Disable cache for real-time data
const liveData = await dataClient.get('/api/live', {
  cache: {
    enabled: false,
  },
});
```

### Interceptor Example

```typescript
// Add request ID to all requests
dataClient.setInterceptors({
  onRequest: async (url, options) => {
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Request-ID': crypto.randomUUID(),
      },
    };
  },
});

// Transform all responses
dataClient.setInterceptors({
  onResponse: async (response, data) => {
    return {
      success: true,
      data,
      timestamp: Date.now(),
    };
  },
});
```

## Best Practices

1. **Use TypeScript** - DataClient is fully typed for better developer experience
2. **Configure Audit Logging** - Set appropriate audit level for your compliance needs
3. **Use Caching Wisely** - Cache static data, disable for real-time data
4. **Handle Errors Properly** - Use custom error types for better error handling
5. **Monitor Metrics** - Track request metrics for performance optimization
6. **Set Appropriate Timeouts** - Configure timeouts based on your API response times
7. **Use Interceptors** - Add common headers, transform responses, handle errors globally

## Troubleshooting

### Token Not Found

If authentication fails, ensure the user token is stored in localStorage with one of the configured keys:

```typescript
// Store user token (for API authentication)
localStorage.setItem('token', 'your-jwt-token');

// Verify token is accessible
console.log(localStorage.getItem('token'));
```

### Client Token Refresh Fails

If client token refresh fails:

1. **Check Server Endpoint** - Ensure `/api/client-token` endpoint is accessible
2. **Verify Authentication** - Ensure user is authenticated (cookies/session)
3. **Check Rate Limiting** - Verify rate limits aren't blocking requests
4. **Inspect Network** - Check browser DevTools Network tab for errors
5. **Server Logs** - Check server logs for token refresh requests

```typescript
// Debug client token refresh
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientToken: initialToken,
    clientTokenExpiresAt: initialExpiresAt,
    onClientTokenRefresh: async () => {
      try {
        console.log('Refreshing client token...');
        const response = await fetch('/api/client-token', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          console.error('Token refresh failed:', response.status, response.statusText);
          throw new Error(`Token refresh failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Token refreshed successfully');
        return data;
      } catch (error) {
        console.error('Token refresh error:', error);
        throw error;
      }
    },
  },
});
```

### Audit Logs Not Appearing

Ensure MisoClient is properly configured and audit logging is enabled:

**Browser Applications:**

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // ❌ NO clientSecret in browser
    clientToken: initialClientToken, // From server
    clientTokenExpiresAt: initialExpiresAt,
    onClientTokenRefresh: async () => {
      const response = await fetch('/api/client-token', {
        credentials: 'include',
      });
      return await response.json();
    },
    audit: {
      enabled: true, // Ensure audit is enabled
    },
  },
});
```

**Server Applications:**

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientSecret: process.env.MISO_CLIENTSECRET, // ✅ Safe on server
    audit: {
      enabled: true,
    },
  },
});
```

### Cache Not Working

Verify cache is enabled and check cache TTL:

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  cache: {
    enabled: true, // Ensure cache is enabled
    defaultTTL: 300,
  },
});
```

## See Also

- [MisoClient API Reference](./api-reference.md)
- [Getting Started Guide](./getting-started.md)
- [Configuration Guide](./configuration.md)
- [Examples](./examples.md)
