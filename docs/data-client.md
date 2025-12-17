# DataClient Browser Wrapper

The **DataClient** is a browser-compatible HTTP client wrapper around MisoClient that provides enhanced HTTP capabilities for React, Vue, and other front-end applications. It includes ISO 27001 compliant audit logging, automatic data masking, caching, retry logic, and more.

## Table of Contents

- [Introduction](#introduction)
- [Quick Start](#quick-start)
- [Developer Journey](#developer-journey)
  - [Step 1: Server Setup](#step-1-server-setup)
  - [Step 2: Browser Setup](#step-2-browser-setup)
  - [Step 3: Making API Requests](#step-3-making-api-requests)
  - [Step 4: Advanced Features](#step-4-advanced-features)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Introduction

### What is DataClient?

DataClient is a browser-compatible HTTP client that wraps MisoClient functionality for front-end applications. It provides:

- **ISO 27001 Compliant Audit Logging** - Automatic audit trail for all HTTP requests with sensitive data masking
- **Response Caching** - In-memory cache with configurable TTL for GET requests
- **Automatic Retry** - Exponential backoff retry logic for retryable errors
- **Request Deduplication** - Prevents duplicate concurrent requests
- **Request Metrics** - Track response times, error rates, and cache performance
- **Browser Compatibility** - Works in React, Vue, Angular, and other front-end frameworks
- **SSR Support** - Graceful degradation for server-side rendering

### ⚠️ Security Warning: Browser Usage

**IMPORTANT:** Never expose `clientSecret` in browser/client-side code. Client secrets are sensitive credentials that should only be used in server-side environments.

For browser applications, use the **Server-Provided Client Token Pattern** (see [Step 2: Browser Setup](#step-2-browser-setup) below).

## Quick Start

### Installation

DataClient is included in the `@aifabrix/miso-client` package:

```bash
npm install @aifabrix/miso-client
```

### Configuration

**Use standard `.env` parameters** - AI Fabrix builder automatically manages these environment variables:

```bash
# .env file
# MISO Application Client Credentials (per application)
MISO_CLIENTID=dataplane_client_id123
MISO_CLIENTSECRET=dataplane_client_secret123
# MISO Controller URL
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
# Allowed origins for CORS validation (comma-separated)
MISO_ALLOWED_ORIGINS=https://myapp.com,http://localhost:*
```

**Never hard-code credentials** - Always use environment variables for security and flexibility.

### 5-Minute Setup

1. **Create a server endpoint** that provides client tokens (see [Step 1](#step-1-server-setup))
2. **Initialize DataClient** in your browser code (see [Step 2](#step-2-browser-setup))
3. **Start making requests** (see [Step 3](#step-3-making-api-requests))

### Setup Options

You have two options for setting up DataClient:

1. **Zero-Config Setup (Recommended)** - Simplest approach, automatic configuration
2. **Manual Setup** - Full control over configuration, useful for custom requirements

### Zero-Config Setup (Recommended)

For the simplest setup with zero configuration, use the auto-initialization helpers:

**Server-side (one line):**

```typescript
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// One line - automatically includes DataClient config in response
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
```

**Client-side (one line):**

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - automatically fetches config and initializes DataClient
const dataClient = await autoInitializeDataClient();
```

**What happens:**

1. Server endpoint automatically enriches the token response with DataClient configuration
2. Client automatically fetches config from the server endpoint
3. DataClient is initialized with server-provided configuration
4. No environment variables needed in frontend build
5. Configuration is cached for faster subsequent page loads

**Benefits:**

- ✅ Zero configuration - No environment variables in frontend build
- ✅ Single source of truth - All config from server .env
- ✅ Type-safe - Full TypeScript support
- ✅ Backward compatible - Existing code still works
- ✅ Secure - No secrets in frontend code

See [Zero-Config Setup](#zero-config-setup) section below for detailed documentation.

### When to Use Manual Setup

Use manual setup when you need:

- **Custom configuration** - Need to set custom cache, retry, or audit settings
- **Environment variables** - Want to use build-time environment variables instead of server-provided config
- **Multiple DataClient instances** - Need different configurations for different API endpoints
- **Advanced token handling** - Need custom token refresh logic or initial token from server
- **Testing** - Easier to mock and test with explicit configuration
- **Legacy code** - Migrating existing code that already uses manual configuration

**Example - Manual Setup with Custom Config:**

```typescript
import { DataClient } from '@aifabrix/miso-client';

const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    clientTokenUri: '/api/v1/auth/client-token',
  },
  cache: {
    enabled: true,
    defaultTTL: 600, // Custom cache TTL
  },
  retry: {
    enabled: true,
    maxRetries: 5, // Custom retry count
  },
  audit: {
    enabled: true,
    level: 'detailed', // Custom audit level
  },
});
```

## Zero-Config Setup

The zero-config approach moves all configuration logic into the `@aifabrix/miso-client` package, requiring minimal code from developers.

### Server-Side Setup

Use the `createClientTokenEndpoint` helper to automatically enrich your client-token endpoint with DataClient configuration:

```typescript
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// One line - automatically includes DataClient config in response
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
```

**What `createClientTokenEndpoint` does:**

1. Validates request origin (using existing `getEnvironmentToken` logic)
2. Fetches client token from controller
3. Automatically enriches response with DataClient config:
   - `baseUrl` - Derived from request (`req.protocol + '://' + req.get('host')`)
   - `controllerUrl` - From `misoClient.getConfig().controllerUrl`
   - `controllerPublicUrl` - From `misoClient.getConfig().controllerPublicUrl` (if set)
   - `clientId` - From `misoClient.getConfig().clientId`
   - `clientTokenUri` - From options or defaults to `/api/v1/auth/client-token`

**Response format:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 1800,
  "config": {
    "baseUrl": "http://localhost:3083",
    "controllerUrl": "https://controller.aifabrix.ai",
    "controllerPublicUrl": "https://controller.aifabrix.ai",
    "clientId": "ctrl-dev-my-app",
    "clientTokenUri": "/api/v1/auth/client-token"
  }
}
```

**Custom options:**

```typescript
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient, {
  clientTokenUri: '/custom/token', // Custom endpoint URI
  expiresIn: 3600, // Custom expiration (default: 1800)
  includeConfig: true, // Include config in response (default: true)
}));
```

### Client-Side Setup

Use the `autoInitializeDataClient` helper to automatically fetch configuration and initialize DataClient:

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - everything is automatic
const dataClient = await autoInitializeDataClient();
```

**What `autoInitializeDataClient` does:**

1. Detects if running in browser
2. Checks localStorage cache first (if enabled)
3. Fetches config from `/api/v1/auth/client-token` endpoint (or custom URI)
4. Extracts `config` from response
5. Initializes DataClient with server-provided config
6. Caches config in localStorage for future page loads

**Custom options:**

```typescript
const dataClient = await autoInitializeDataClient({
  clientTokenUri: '/api/v1/auth/client-token', // Custom endpoint
  baseUrl: 'https://api.example.com', // Override baseUrl detection
  onError: (error) => console.error('Init failed:', error), // Error handler
  cacheConfig: true, // Cache config in localStorage (default: true)
});
```

**Error handling:**

```typescript
try {
  const dataClient = await autoInitializeDataClient();
  // Use dataClient...
} catch (error) {
  if (error.message.includes('config not found')) {
    console.error('Server endpoint must use createClientTokenEndpoint() helper');
  } else if (error.message.includes('Unable to detect baseUrl')) {
    console.error('Provide baseUrl option or ensure window.location.origin is available');
  } else {
    console.error('Initialization failed:', error);
  }
}
```

**Benefits:**

- ✅ **Zero configuration** - No environment variables in frontend build
- ✅ **Single source of truth** - All config from server .env
- ✅ **Type-safe** - Full TypeScript support with exported types
- ✅ **Backward compatible** - Existing code still works
- ✅ **Developer-friendly** - One line of code for each side
- ✅ **Secure** - No secrets in frontend code
- ✅ **Flexible** - Options available for customization

**TypeScript types:**

```typescript
import {
  createClientTokenEndpoint,
  ClientTokenResponse,
  DataClientConfigResponse,
  hasConfig,
  autoInitializeDataClient,
  AutoInitOptions,
} from '@aifabrix/miso-client';

// Type-safe response handling
app.post('/api/v1/auth/client-token', async (req, res) => {
  const handler = createClientTokenEndpoint(misoClient);
  await handler(req, res);
  
  // Or manually create response with types
  const response: ClientTokenResponse = {
    token: await getEnvironmentToken(misoClient, req),
    expiresIn: 1800,
    config: {
      baseUrl: `${req.protocol}://${req.get('host')}`,
      controllerUrl: misoClient.getConfig().controllerUrl,
      clientId: misoClient.getConfig().clientId,
      clientTokenUri: '/api/v1/auth/client-token',
    },
  };
  
  // Use type guard
  if (hasConfig(response)) {
    console.log('Config available:', response.config.baseUrl);
  }
  
  res.json(response);
});
```

## Developer Journey

Follow these steps to integrate DataClient into your application.

### Step 1: Server Setup

**You need to:** Create a secure server endpoint that provides client tokens to your browser application.

**Here's how:** Create an Express endpoint using the `getEnvironmentToken` helper function.

#### Create the Client Token Endpoint

```typescript
// server.ts (Express.js example)
import express from 'express';
import { MisoClient, getEnvironmentToken, loadConfig } from '@aifabrix/miso-client';

const app = express();

// Option 1: Use loadConfig() helper (recommended - automatically loads all .env parameters)
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const config = loadConfig(); // Automatically loads MISO_ALLOWED_ORIGINS, MISO_CLIENTID, etc.
const misoClient = new MisoClient(config);
await misoClient.initialize();

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

**What happens:**

1. Browser makes POST request to `/api/v1/auth/client-token`
2. `getEnvironmentToken()` validates the request origin against `allowedOrigins`
3. If valid, it fetches a client token from the controller
4. Token is returned to the browser with expiration time
5. Audit events are automatically logged for ISO 27001 compliance

**Manual configuration** - If you need custom logic:

```typescript
const misoClient = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL,
  clientId: process.env.MISO_CLIENTID,
  clientSecret: process.env.MISO_CLIENTSECRET,
  // Parse MISO_ALLOWED_ORIGINS manually
  allowedOrigins: process.env.MISO_ALLOWED_ORIGINS?.split(',').map(o => o.trim()),
});
```

**Security Best Practices:**

1. ✅ **Always validate origins** - Configure `allowedOrigins` in server-side MisoClient config
2. ✅ **Use HTTPS in production** - Never allow HTTP origins in production
3. ✅ **Rate limit endpoints** - Implement rate limiting on client token endpoints
4. ✅ **Require authentication** - Ensure user is authenticated before issuing client tokens
5. ✅ **Short expiration times** - Use shorter expiration times for browser tokens (e.g., 30 minutes)

### Step 2: Browser Setup

**You need to:** Initialize DataClient in your browser application without exposing `clientSecret`.

**Here's how:** Use the server-provided client token pattern.

**Note:** In browser environments, environment variables are typically injected at build time (via build tools like Vite, Webpack, etc.) or passed from the server. The examples below show both patterns.

#### Basic Browser Setup

```typescript
// browser.ts (React/Vue/Angular)
import { DataClient } from '@aifabrix/miso-client';

// Create DataClient instance WITHOUT clientSecret
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    // ❌ DO NOT include clientSecret in browser code
    
    // ✅ Use server-provided token endpoint
    clientTokenUri: '/api/v1/auth/client-token', // Default if not specified
    
    // Optional: Initial token from server (if provided on page load)
    // clientToken: window.INITIAL_CLIENT_TOKEN,
    // clientTokenExpiresAt: window.INITIAL_CLIENT_TOKEN_EXPIRES_AT,
  },
});
```

**What happens:**

1. DataClient is initialized without `clientSecret` (safe for browser)
2. When a client token is needed, `dataClient.getEnvironmentToken()` is called automatically
3. It checks localStorage cache first
4. If cache miss/expired, it calls your server endpoint (`/api/v1/auth/client-token`)
5. Token is cached in localStorage for future use

#### Using getEnvironmentToken (Browser-Side)

**You need to:** Get a client token for audit logging or other purposes.

**Here's how:** Call `dataClient.getEnvironmentToken()` - it handles caching automatically.

```typescript
// Get environment token (checks cache first, then calls backend)
const token = await dataClient.getEnvironmentToken();

// Token is automatically cached in localStorage
// Cache keys: 'miso:client-token' and 'miso:client-token-expires-at'
// Cache expires based on expiresIn from backend response
```

**What happens:**

1. Checks localStorage cache for valid token
2. If cached and valid, returns immediately
3. If cache miss or expired, calls your server endpoint (`/api/v1/auth/client-token`)
4. Caches the new token with expiration time
5. Returns the token

**Configuration:**

The `getEnvironmentToken()` method uses `clientTokenUri` from `misoConfig` or defaults to `/api/v1/auth/client-token`:

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    // Optional: Custom client token endpoint URI
    clientTokenUri: '/api/v1/auth/client-token', // Default
  },
});
```

#### User Token Management

DataClient automatically retrieves user authentication tokens from `localStorage`:

```typescript
// Default token keys: ['token', 'accessToken', 'authToken']
// DataClient checks these keys in order

// Store token in localStorage
localStorage.setItem('token', 'your-jwt-token');

// DataClient automatically uses the token for authenticated requests
const users = await dataClient.get('/api/users');
```

**Custom Token Keys:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: { /* ... */ },
  tokenKeys: ['myAppToken', 'authToken'], // Custom token keys
});
```

### Step 3: Making API Requests

**You need to:** Make HTTP requests to your API with automatic authentication and audit logging.

**Here's how:** Use DataClient's HTTP methods.

#### GET Request

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

#### POST Request

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

#### PUT, PATCH, DELETE Requests

```typescript
// PUT request
const updatedUser = await dataClient.put<User>('/api/users/123', {
  name: 'Jane Doe',
  email: 'jane@example.com',
});

// PATCH request
const patchedUser = await dataClient.patch<User>('/api/users/123', {
  email: 'newemail@example.com',
});

// DELETE request
await dataClient.delete('/api/users/123');
```

#### Skip Authentication

```typescript
// Make unauthenticated request
const publicData = await dataClient.get('/api/public', {
  skipAuth: true,
});
```

#### Authentication Status

```typescript
// Check if user is authenticated
if (dataClient.isAuthenticated()) {
  const users = await dataClient.get('/api/users');
} else {
  // Redirect to login via controller
  await dataClient.redirectToLogin();
}
```

#### Redirect to Login

```typescript
// Redirect to login and return to current page after authentication
await dataClient.redirectToLogin();

// Redirect to login and return to dashboard after authentication
await dataClient.redirectToLogin('https://myapp.com/dashboard');
```

**What redirectToLogin does:**

- Builds controller URL dynamically from configuration (`controllerPublicUrl` → `controllerUrl` → fallback to static `loginUrl`)
- Gets client token (from cache, config, or `getEnvironmentToken()`)
- Makes direct fetch request to `/api/v1/auth/login` with `x-client-token` header
- Redirects browser to the controller's login URL returned in response
- Falls back to static `loginUrl` config if controller URL is not configured or controller call fails

**Security:**

- Uses `x-client-token` header (lowercase) for authentication
- Never exposes `clientId` or `clientSecret` in browser code
- Supports both nested (`data.loginUrl`) and flat (`loginUrl`) response formats

#### Logout User

```typescript
// Basic logout - redirects to login page
await dataClient.logout();

// Logout and redirect to home page
await dataClient.logout('/home');

// Configure custom logout URL
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: { /* ... */ },
  logoutUrl: '/goodbye', // Custom logout page
});

await dataClient.logout(); // Redirects to /goodbye
```

**What logout does:**

- Builds controller URL dynamically from configuration (`controllerPublicUrl` → `controllerUrl`)
- Gets client token and makes direct fetch request to `/api/v1/auth/logout` with `x-client-token` header
- Calls controller logout API to invalidate server-side session
- Clears authentication tokens from localStorage (always, even if API call fails)
- Clears HTTP response cache
- Redirects to logout URL or login page

**Security:**

- Uses `x-client-token` header (lowercase) for authentication
- Never exposes `clientId` or `clientSecret` in browser code
- Always clears local state even if API call fails

### Step 4: Advanced Features

#### Caching

DataClient provides in-memory caching for GET requests:

```typescript
// First request - fetches from API
const users1 = await dataClient.get('/api/users');

// Second request - returns from cache (if within TTL)
const users2 = await dataClient.get('/api/users');
```

**Configuration:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: { /* ... */ },
  cache: {
    enabled: true,
    defaultTTL: 300, // 5 minutes
    maxSize: 100, // Maximum 100 cached entries
  },
});
```

**Per-Request Cache Control:**

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

// Clear all cached responses
dataClient.clearCache();
```

#### Retry Logic

DataClient automatically retries failed requests with exponential backoff:

**Retryable Errors:**

- Network errors (connection failures, timeouts)
- 5xx server errors
- 408 Request Timeout
- 429 Too Many Requests

**Non-Retryable Errors:**

- 4xx client errors (except 401/403)
- 401 Unauthorized
- 403 Forbidden

**Configuration:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: { /* ... */ },
  retry: {
    enabled: true,
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
  },
});
```

**Per-Request Retry Control:**

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

#### ISO 27001 Audit Logging

DataClient automatically logs all HTTP requests/responses for ISO 27001 compliance with sensitive data masking.

**Audit Levels:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: { /* ... */ },
  audit: {
    enabled: true,
    level: 'standard', // minimal | standard | detailed | full
    skipEndpoints: ['/health', '/metrics'],
  },
});
```

**Audit Level Details:**

- **minimal**: Only method, URL, status, duration, userId
- **standard**: Includes headers and bodies (masked) - **default**
- **detailed**: Includes sizes and more metadata
- **full**: Complete audit trail with all details

**Sensitive Data Masking:**

DataClient automatically masks sensitive data before logging:

- Passwords, tokens, API keys
- PII (email, phone, SSN, etc.)
- Financial data (credit cards, bank accounts)
- Custom sensitive fields (configurable)

**Skip Audit:**

```typescript
// Skip audit for specific endpoints (global config)
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: { /* ... */ },
  audit: {
    skipEndpoints: ['/health', '/metrics', '/ping'],
  },
});

// Skip audit for specific request
await dataClient.get('/api/users', {
  skipAudit: true,
});

// Update audit configuration at runtime
dataClient.setAuditConfig({
  level: 'detailed',
  maxResponseSize: 20000,
});
```

#### Interceptors

DataClient supports request, response, and error interceptors:

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
  onResponse: async (response, data) => {
    // Transform response data
    return {
      ...data,
      timestamp: Date.now(),
    };
  },
  onError: async (error) => {
    // Transform error
    console.error('Request failed:', error);
    return error;
  },
});
```

#### Request Metrics

Track request metrics for monitoring and performance analysis:

```typescript
const metrics = dataClient.getMetrics();

console.log('Total requests:', metrics.totalRequests);
console.log('Total failures:', metrics.totalFailures);
console.log('Average response time:', metrics.averageResponseTime, 'ms');
console.log('Error rate:', metrics.errorRate);
console.log('Cache hit rate:', metrics.cacheHitRate);
console.log('Response time distribution:', metrics.responseTimeDistribution);
```

#### Get Client Token Info

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

## API Reference

### DataClient Class

#### Constructor

```typescript
constructor(config: DataClientConfig)
```

Creates a new DataClient instance.

#### HTTP Methods

- `get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>`
- `post<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`
- `put<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`
- `patch<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T>`
- `delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>`

#### Utility Methods

- `isAuthenticated(): boolean` - Check if user is authenticated
- `redirectToLogin(redirectUrl?: string): Promise<void>` - Redirect to login page via controller
- `logout(redirectUrl?: string): Promise<void>` - Logout user, clear tokens and cache, and redirect
- `getEnvironmentToken(): Promise<string>` - Get environment/client token (browser-side with caching)
- `getClientTokenInfo(): ClientTokenInfo | null` - Extract application and environment info from client token
- `setInterceptors(config: InterceptorConfig): void` - Configure interceptors
- `setAuditConfig(config: Partial<AuditConfig>): void` - Update audit configuration
- `clearCache(): void` - Clear all cached responses
- `getMetrics(): RequestMetrics` - Get request metrics

### Configuration Types

#### DataClientConfig

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
}
```

#### ApiRequestOptions

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

### Error Types

- `NetworkError` - Network failures (connection errors, CORS issues, etc.)
- `TimeoutError` - Request timeout exceeded
- `AuthenticationError` - 401 Unauthorized responses
- `ApiError` - Base error class for API errors

**See Also:**

- [Complete API Reference](./api-reference.md#dataclient) - Full API documentation
- [TypeScript Definitions](../src/types/data-client.types.ts) - Complete type definitions

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

1. **Check Server Endpoint** - Ensure `/api/v1/auth/client-token` endpoint is accessible
2. **Verify Authentication** - Ensure user is authenticated (cookies/session)
3. **Check Rate Limiting** - Verify rate limits aren't blocking requests
4. **Inspect Network** - Check browser DevTools Network tab for errors
5. **Server Logs** - Check server logs for token refresh requests

**Debug Example:**

```typescript
// Debug client token refresh
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    clientTokenUri: '/api/v1/auth/client-token',
  },
});

try {
  const token = await dataClient.getEnvironmentToken();
  console.log('Token retrieved successfully');
} catch (error) {
  console.error('Token fetch failed:', error);
  // Check Network tab for request details
}
```

### Audit Logs Not Appearing

Ensure MisoClient is properly configured and audit logging is enabled:

**Browser Applications:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    // ❌ NO clientSecret in browser
    audit: {
      enabled: true, // Ensure audit is enabled
    },
  },
});
```

**Server Applications:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
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
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: { /* ... */ },
  cache: {
    enabled: true, // Ensure cache is enabled
    defaultTTL: 300,
  },
});
```

### Origin Validation Fails

If origin validation fails on the server endpoint:

1. **Check Allowed Origins** - Verify `allowedOrigins` includes your browser origin
2. **Check Origin Header** - Ensure browser sends `Origin` header correctly
3. **Wildcard Ports** - Use `http://localhost:*` for local development
4. **HTTPS in Production** - Never allow HTTP origins in production

**Debug Example:**

```typescript
// Server-side: Log origin for debugging
app.post('/api/v1/auth/client-token', async (req, res) => {
  console.log('Origin:', req.headers.origin);
  console.log('Referer:', req.headers.referer);
  console.log('Allowed origins:', misoClient.getConfig().allowedOrigins);
  
  try {
    const token = await getEnvironmentToken(misoClient, req);
    res.json({ token, expiresIn: 1800 });
  } catch (error) {
    console.error('Origin validation failed:', error);
    res.status(403).json({ error: 'Origin validation failed' });
  }
});
```

## Examples

### React Example

```typescript
import { DataClient } from '@aifabrix/miso-client';
import { useEffect, useState } from 'react';

// ✅ Browser-safe configuration
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
// Note: In browser environments, you may need to inject env vars at build time
// or use a config object passed from the server
const dataClient = new DataClient({
  baseUrl: window.API_BASE_URL || process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: window.MISO_CONTROLLER_URL || process.env.MISO_CONTROLLER_URL,
    clientId: window.MISO_CLIENTID || process.env.MISO_CLIENTID,
    clientTokenUri: '/api/v1/auth/client-token',
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
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    clientTokenUri: '/api/v1/auth/client-token',
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

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    // ... other config
  },
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

## See Also

- [MisoClient API Reference](./api-reference.md)
- [Getting Started Guide](./getting-started.md)
- [Configuration Guide](./configuration.md)
- [Examples](./examples.md)
