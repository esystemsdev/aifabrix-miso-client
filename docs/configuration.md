# Configuration Guide

Complete guide to configuring the AI Fabrix Miso Client SDK.

## Table of Contents

- [Why Use .env?](#why-use-env)
- [Basic Configuration](#basic-configuration)
- [Redis Configuration](#redis-configuration)
- [Environment Variables](#environment-variables)
- [Cache Configuration](#cache-configuration)
- [Logging Configuration](#logging-configuration)
- [Audit Configuration](#audit-configuration)
- [Sensitive Fields Configuration](#sensitive-fields-configuration)
- [Event Emission Mode](#event-emission-mode)
- [API Key Testing Support](#api-key-testing-support)
- [Best Practices](#best-practices)

## Why Use .env?

**You need to:** Configure the SDK with minimal boilerplate.

**Here's how:** Use environment variables in a `.env` file with `loadConfig()`.

```bash
# .env file
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
REDIS_HOST=localhost
```

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
// Automatically loads from .env - that's it!
const client = new MisoClient(loadConfig());
await client.initialize();
```

**What happens:**

- `loadConfig()` automatically loads all environment variables
- Validates required variables (`MISO_CLIENTID`, `MISO_CLIENTSECRET`)
- Throws clear errors if variables are missing
- No configuration boilerplate needed

**Benefits:**

- ✅ No configuration boilerplate
- ✅ Easy environment switching (dev/test/prod)
- ✅ Keeps secrets out of code
- ✅ Standard practice across frameworks
- ✅ Team-friendly
- ✅ CI/CD ready

**When to use manual configuration:**

- Dynamic configuration from external service
- Integrating with existing config system
- Special requirements

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  redis: {
    host: 'localhost',
    port: 6379,
  },
});
```

## Basic Configuration

**You need to:** Configure required settings for MisoClient.

**Here's how:** Provide controller URL, client ID, and client secret.

```typescript
interface MisoClientConfig {
  controllerUrl: string; // Required: AI Fabrix controller URL
  clientId: string; // Required: Client ID (e.g., 'ctrl-dev-my-app')
  clientSecret: string; // Required: Client secret
  redis?: RedisConfig; // Optional: Redis configuration for caching
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Optional: Logging level
  encryptionKey?: string; // Optional: Encryption key for EncryptionService
  apiKey?: string; // Optional: API key for testing (bypasses OAuth2 authentication)
  emitEvents?: boolean; // Optional: Emit log events instead of HTTP/Redis (default: false)
  cache?: {
    roleTTL?: number; // Optional: Role cache TTL in seconds (default: 900)
    permissionTTL?: number; // Optional: Permission cache TTL in seconds (default: 900)
    tokenValidationTTL?: number; // Optional: Token validation cache TTL in seconds (default: 900)
  };
}
```

**Recommended approach:**

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient(loadConfig());
```

**Configuration details:**

- **`controllerUrl`**: Base URL of your AI Fabrix controller instance
  - Examples: `https://controller.aifabrix.ai`, `http://localhost:3000`
  - Note: Can be used as fallback when public/private URLs are not provided
- **`controllerPublicUrl`**: Public URL for browser/Vite environments (accessible from internet)
  - Examples: `https://controller.aifabrix.ai`, `https://api.example.com`
  - Used automatically in browser environments
  - Falls back to `controllerUrl` if not provided
- **`controllerPrivateUrl`**: Private URL for server environments (internal network access)
  - Examples: `http://miso-controller:3010`, `http://10.0.0.5:3000`
  - Used automatically in server environments
  - Falls back to `controllerUrl` if not provided
- **`clientId`**: Client ID for authenticating with the controller
  - Examples: `'ctrl-dev-my-app'`, `'ctrl-pro-production-app'`
  - Security: Store in environment variables, never hardcode
- **`clientSecret`**: Client secret for authenticating with the controller
  - Security: Store in environment variables, never hardcode
  - Note: Client token is automatically fetched and managed by the SDK

## Public and Private Controller URLs

**You need to:** Configure separate URLs for browser and server environments to handle different network topologies.

**Here's how:** Use `controllerPublicUrl` for browser/Vite environments and `controllerPrivateUrl` for server environments. The SDK automatically detects the environment and uses the appropriate URL.

### Automatic Environment Detection

The SDK automatically detects whether it's running in a browser or server environment:

- **Browser/Vite**: Uses `controllerPublicUrl` (or falls back to `controllerUrl`)
- **Server/Node.js**: Uses `controllerPrivateUrl` (or falls back to `controllerUrl`)

### Browser Configuration (Vite/React/Angular)

```typescript
// Browser configuration - use public URL
const browserClient = new MisoClient({
  controllerPublicUrl: 'https://controller.aifabrix.ai',
  clientId: 'my-app',
  // ❌ DO NOT include clientSecret in browser code
  // Use clientToken pattern instead (see DataClient documentation)
});
```

**Environment variable:**

```bash
# Browser (Vite) - Public URL
MISO_WEB_SERVER_URL=https://controller.aifabrix.ai
```

### Server Configuration

```typescript
// Server configuration - use private URL
const serverClient = new MisoClient({
  controllerPrivateUrl: 'http://miso-controller:3010',
  clientId: 'my-app',
  clientSecret: 'your-secret',
});
```

**Environment variable:**

```bash
# Server - Private URL
MISO_CONTROLLER_URL=http://miso-controller:3010
```

### Backward Compatibility

Existing `controllerUrl` configuration continues to work as a fallback:

```typescript
// Single URL (works for both browser and server)
const legacyClient = new MisoClient({
  controllerUrl: 'http://localhost:3000',
  clientId: 'my-app',
  clientSecret: 'your-secret',
});
```

**Environment variable:**

```bash
# Server - Private URL (also sets controllerUrl for backward compatibility)
MISO_CONTROLLER_URL=http://localhost:3000
```

### Priority Order

The SDK resolves URLs in the following priority order:

1. **Environment-specific URL**: `controllerPublicUrl` (browser) or `controllerPrivateUrl` (server)
2. **Fallback**: `controllerUrl` if environment-specific URL not provided
3. **Error**: Throws clear error if no URL available

### Migration Guide

**From single URL to dual URL setup:**

1. **Phase 1**: Add public/private URLs while keeping `controllerUrl` (backward compatible)

   ```typescript
   const client = new MisoClient({
     controllerUrl: 'http://localhost:3000', // Still works as fallback
     controllerPublicUrl: 'https://controller.aifabrix.ai', // Browser
     controllerPrivateUrl: 'http://miso-controller:3010', // Server
     clientId: 'my-app',
     clientSecret: 'your-secret',
   });
   ```

2. **Phase 2**: Update applications to use public/private URLs explicitly

   ```typescript
   // Browser app
   const browserClient = new MisoClient({
     controllerPublicUrl: 'https://controller.aifabrix.ai',
     clientId: 'my-app',
   });
   
   // Server app
   const serverClient = new MisoClient({
     controllerPrivateUrl: 'http://miso-controller:3010',
     clientId: 'my-app',
     clientSecret: 'your-secret',
   });
   ```

**Benefits:**

- ✅ Separate network topologies for browser and server
- ✅ Public URL accessible from internet (browser)
- ✅ Private URL for internal network access (server)
- ✅ Automatic environment detection
- ✅ Backward compatible with existing `controllerUrl`

### Advanced: Manual URL Resolution

For advanced use cases, you can manually resolve controller URLs or detect the environment using the exported utilities:

```typescript
import { resolveControllerUrl, isBrowser, MisoClientConfig } from '@aifabrix/miso-client';

// Detect environment
if (isBrowser()) {
  console.log('Running in browser');
} else {
  console.log('Running on server');
}

// Manually resolve URL
const config: MisoClientConfig = {
  controllerPublicUrl: 'https://controller.aifabrix.ai',
  controllerPrivateUrl: 'http://miso-controller:3010',
  controllerUrl: 'http://localhost:3000', // Fallback
  clientId: 'my-app',
};

const resolvedUrl = resolveControllerUrl(config);
console.log('Resolved URL:', resolvedUrl);
```

**Use Cases:**

- Pre-validating configuration before creating MisoClient
- Conditional logic based on environment
- Testing and debugging URL resolution
- Custom URL resolution logic

**See Also:**

- [Standalone Utilities Reference](./reference-utilities.md#standalone-utilities) - Complete documentation for `resolveControllerUrl()` and `isBrowser()`

## Keycloak Configuration

**You need to:** Configure Keycloak URLs for local token validation with `validateTokenLocal()`.

**Here's how:** Use `authServerPublicUrl` for browser-side and issuer validation, and `authServerPrivateUrl` for server-side JWKS fetching. The SDK automatically detects the environment and uses the appropriate URL.

### Keycloak URL Configuration

The SDK supports separate private and public Keycloak URLs, similar to controller URLs:

- **`authServerUrl`**: Fallback URL for backward compatibility
- **`authServerPrivateUrl`**: Private URL for server-side JWKS fetching (internal network)
- **`authServerPublicUrl`**: Public URL for browser-side and issuer validation (public network)

### Automatic Environment Detection

The SDK automatically detects whether it's running in a browser or server environment:

- **Browser/Vite**: Uses `authServerPublicUrl` (or falls back to `authServerUrl`)
- **Server/Node.js**: Uses `authServerPrivateUrl` (or falls back to `authServerUrl`)

### Server Configuration

```typescript
// Server configuration - use private URL for JWKS fetching
const serverClient = new MisoClient({
  controllerPrivateUrl: 'http://miso-controller:3010',
  clientId: 'my-app',
  clientSecret: 'your-secret',
  keycloak: {
    authServerUrl: 'https://keycloak.example.com', // Fallback
    authServerPrivateUrl: 'http://keycloak-internal:8080', // For JWKS fetching
    authServerPublicUrl: 'https://keycloak.example.com', // For issuer validation
    realm: 'my-realm',
    clientId: 'my-client',
    verifyAudience: true,
  },
});
```

**What happens:**

- JWKS keys are fetched from `authServerPrivateUrl` (faster, more secure, internal network)
- Token issuer validation uses `authServerPublicUrl` (matches token's `iss` claim)
- Tokens are always issued with the public URL in the `iss` claim

### Browser Configuration

```typescript
// Browser configuration - use public URL
const browserClient = new MisoClient({
  controllerPublicUrl: 'https://controller.aifabrix.ai',
  clientId: 'my-app',
  keycloak: {
    authServerUrl: 'https://keycloak.example.com', // Fallback
    authServerPublicUrl: 'https://keycloak.example.com', // For JWKS and issuer
    realm: 'my-realm',
  },
});
```

### Environment Variables

You can configure Keycloak URLs using environment variables:

```bash
# .env file
KEYCLOAK_SERVER_URL=http://keycloak-internal:8080
KEYCLOAK_PUBLIC_SERVER_URL=https://keycloak.example.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=my-client
KEYCLOAK_VERIFY_AUDIENCE=true
```

The `loadConfig()` function automatically maps these to the Keycloak configuration:

- `KEYCLOAK_SERVER_URL` → `authServerPrivateUrl`
- `KEYCLOAK_PUBLIC_SERVER_URL` → `authServerPublicUrl`
- `KEYCLOAK_REALM` → `realm`
- `KEYCLOAK_CLIENT_ID` → `clientId`
- `KEYCLOAK_VERIFY_AUDIENCE` → `verifyAudience`

### Backward Compatibility

Existing code using single `authServerUrl` will continue to work:

```typescript
// Backward compatible - single URL
const client = new MisoClient({
  keycloak: {
    authServerUrl: 'https://keycloak.example.com',
    realm: 'my-realm',
  },
});
```

**Benefits:**

- ✅ Separate network topologies for JWKS fetching and issuer validation
- ✅ Private URL for internal JWKS fetching (server-side)
- ✅ Public URL for issuer validation (matches token's `iss` claim)
- ✅ Automatic environment detection
- ✅ Backward compatible with existing `authServerUrl`

## Redis Configuration

**You need to:** Configure Redis for improved performance through caching.

**Here's how:** Provide Redis connection details (optional but recommended).

```typescript
interface RedisConfig {
  host: string; // Required: Redis host
  port: number; // Required: Redis port
  password?: string; // Optional: Redis password
  db?: number; // Optional: Redis database number (0-15, default: 0)
  keyPrefix?: string; // Optional: Key prefix (default: 'miso:')
}
```

**Basic Redis configuration:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  redis: {
    host: 'localhost',
    port: 6379
  }
});
```

**Redis with authentication:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 1,
    keyPrefix: 'prod:miso:'
  }
});
```

**What happens:**

- SDK automatically connects to Redis on initialization
- Falls back to controller when Redis is unavailable
- No errors thrown - graceful degradation

## Environment Variables

**You need to:** Configure the SDK using environment variables.

**Here's how:** Set environment variables in your `.env` file or environment.

```bash
# Required
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret-here

# Server - Private URL (for server environments)
MISO_CONTROLLER_URL=http://miso-controller:3010

# Optional: Public URL for browser/Vite environments
MISO_WEB_SERVER_URL=https://controller.aifabrix.ai

# Optional: Logging level
MISO_LOG_LEVEL=info

# Optional Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
REDIS_KEY_PREFIX=miso:

# Optional Encryption
ENCRYPTION_KEY=your-encryption-key

# Optional: API key for testing (bypasses OAuth2 authentication)
API_KEY=your-test-api-key

# Optional: Custom sensitive fields configuration file path
MISO_SENSITIVE_FIELDS_CONFIG=/path/to/custom-sensitive-fields.json

# Optional: Event emission mode
MISO_EMIT_EVENTS=true
```

**Environment-specific configuration:**

```bash
# .env.development
MISO_CONTROLLER_URL=http://localhost:3000
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-dev-secret
REDIS_HOST=localhost
REDIS_PORT=6379
MISO_LOG_LEVEL=debug

# .env.production
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
MISO_CLIENTID=ctrl-pro-my-app
MISO_CLIENTSECRET=your-prod-secret
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=secure-password
REDIS_DB=1
REDIS_KEY_PREFIX=prod:miso:
MISO_LOG_LEVEL=warn
```

## Cache Configuration

**You need to:** Configure caching behavior for roles, permissions, and token validation.

**Here's how:** Set cache TTL values for roles, permissions, and token validation.

```typescript
interface CacheConfig {
  roleTTL?: number; // Role cache TTL in seconds (default: 900 = 15 minutes)
  permissionTTL?: number; // Permission cache TTL in seconds (default: 900 = 15 minutes)
  tokenValidationTTL?: number; // Token validation cache TTL in seconds (default: 900 = 15 minutes)
}
```

**Token Validation Caching:**

Token validation results are cached by userId with a configurable TTL to reduce API calls to the controller. The cache is automatically cleared when users logout.

- **Cache key format**: `token:${userId}`
- **Default TTL**: 900 seconds (15 minutes)
- **Configurable**: Set `cache.tokenValidationTTL` in config
- **Automatic invalidation**: Cache cleared on logout
- **Performance**: Reduces controller API calls significantly for frequently validated tokens

**High security (short cache duration):**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  cache: {
    roleTTL: 300, // 5 minutes
    permissionTTL: 300, // 5 minutes
    tokenValidationTTL: 600 // 10 minutes
  }
});
```

**High performance (long cache duration):**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  cache: {
    roleTTL: 1800, // 30 minutes
    permissionTTL: 1800, // 30 minutes
    tokenValidationTTL: 1800 // 30 minutes
  }
});
```

**Recommended:** `300` - `1800` seconds (5-30 minutes) depending on security requirements.

## Logging Configuration

**You need to:** Configure logging behavior and levels.

**Here's how:** Set the log level based on your environment.

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

**Log level options:**

- **`debug`**: Logs all messages including debug information
  - Use case: Development and debugging
  - Performance: Lowest performance due to verbose logging
- **`info`**: Logs informational messages and above
  - Use case: General application logging
  - Performance: Good balance of information and performance
- **`warn`**: Logs warning messages and errors only
  - Use case: Production environments
  - Performance: High performance, minimal logging
- **`error`**: Logs only error messages
  - Use case: Critical production environments
  - Performance: Highest performance, minimal logging

**Configuration examples:**

```typescript
// Development
const client = new MisoClient({
  ...loadConfig(),
  logLevel: 'debug'
});

// Production
const client = new MisoClient({
  ...loadConfig(),
  logLevel: 'warn'
});

// Conditional
const client = new MisoClient({
  ...loadConfig(),
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
});
```

## Audit Configuration

**You need to:** Configure HTTP request audit logging for ISO 27001 compliance.

**Here's how:** Set audit level and performance optimizations.

```typescript
interface AuditConfig {
  enabled?: boolean; // Enable/disable audit logging (default: true)
  level?: 'minimal' | 'standard' | 'detailed' | 'full'; // Audit detail level (default: 'detailed')
  maxResponseSize?: number; // Truncate responses larger than this (default: 10000)
  maxMaskingSize?: number; // Skip masking for objects larger than this (default: 50000)
  batchSize?: number; // Batch size for queued logs (default: 10)
  batchInterval?: number; // Flush interval in ms (default: 100)
  skipEndpoints?: string[]; // Endpoints to skip audit logging
}
```

**Audit levels:**

- **`minimal`**: Only metadata (method, URL, status, duration) - no masking, no sizes
  - Use case: Maximum performance, compliance with minimal audit requirements
  - Performance: Fastest - < 1ms CPU overhead
  - ISO 27001 Compliance: ✅ (minimal audit trail)
- **`standard`**: Light masking (headers only, selective body masking)
  - Use case: Balanced performance and audit detail
  - Performance: Fast - ~5-10ms CPU overhead for medium requests
  - ISO 27001 Compliance: ✅ (audit trail with selective masking)
- **`detailed`** (Default): Full masking with sizes - optimized
  - Use case: Full compliance audit logging with performance optimizations
  - Performance: Optimized - ~10-20ms CPU overhead for medium requests
  - ISO 27001 Compliance: ✅ (full audit trail with data protection)
- **`full`**: Everything including debug-level details
  - Use case: Development and debugging
  - Performance: Most detailed - ~20-50ms CPU overhead for medium requests
  - ISO 27001 Compliance: ✅ (comprehensive audit trail)

**Configuration examples:**

```typescript
// High Performance Production (Minimal)
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    level: 'minimal' // Only metadata, fastest performance
  }
});

// Balanced Production (Standard)
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    level: 'standard', // Light masking, good performance
    maxResponseSize: 10000, // Truncate large responses
    maxMaskingSize: 50000 // Skip masking for very large objects
  }
});

// Full Compliance (Detailed - Default)
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    level: 'detailed', // Full masking with optimizations (default)
    maxResponseSize: 10000,
    maxMaskingSize: 50000
  }
});

// Development/Debugging (Full)
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    level: 'full' // Everything for debugging
  }
});

// Batch Logging for High Volume
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    batchSize: 20, // Batch 20 logs per request
    batchInterval: 200 // Flush every 200ms
  }
});

// Skip Specific Endpoints
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    skipEndpoints: ['/api/health', '/api/metrics'] // Don't audit health checks
  }
});

// Disable Audit Logging
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    enabled: false // Completely disable audit logging
  }
});
```

**What happens:**

- SDK automatically optimizes audit logging based on request size
- Large requests automatically use metadata-only mode or skip masking
- Batch logging reduces network overhead by ~90% (default: 10 logs per request)

**Best practices:**

1. **Production**: Use `minimal` or `standard` for maximum performance
2. **Development**: Use `full` for comprehensive debugging
3. **High Volume**: Enable batch logging with larger batch sizes
4. **Large Payloads**: Configure `maxResponseSize` and `maxMaskingSize` appropriately
5. **Health Checks**: Skip auditing for health check endpoints using `skipEndpoints`

## Sensitive Fields Configuration

**You need to:** Customize which fields are considered sensitive for data masking.

**Here's how:** Provide your own sensitive fields configuration file.

**Default configuration:**

The SDK includes a default `sensitive-fields.config.json` file that masks common sensitive fields including:

- **Authentication**: password, token, secret, key, authorization, cookie, session
- **PII**: email, phone, ssn, taxId
- **Financial**: creditCard, cvv, pin, bankAccount, routingNumber
- **Security**: otp, privateKey, encryptionKey

**Custom configuration:**

```bash
# .env file
MISO_SENSITIVE_FIELDS_CONFIG=/path/to/custom-sensitive-fields.json
```

```typescript
const client = new MisoClient({
  ...loadConfig(),
  sensitiveFieldsConfig: '/path/to/custom-sensitive-fields.json' // Optional
});
```

**Configuration file structure:**

```json
{
  "version": "1.0.0",
  "description": "Your custom sensitive fields configuration",
  "categories": {
    "authentication": [
      "password",
      "token",
      "secret",
      "myCustomAuthField"
    ],
    "pii": [
      "email",
      "ssn",
      "phone",
      "customPIIField"
    ],
    "financial": [
      "creditCard",
      "cvv",
      "bankAccount"
    ],
    "security": [
      "privateKey",
      "encryptionKey",
      "mySecurityField"
    ]
  },
  "fieldPatterns": [
    "password",
    "secret",
    "token",
    "customPattern"
  ]
}
```

**What happens:**

1. SDK loads your custom configuration file on initialization
2. Custom fields are merged with default fields (custom fields extend defaults)
3. All HTTP request/response data is automatically masked before logging
4. Masking happens in audit logs (always) and debug logs (when `logLevel === 'debug'`)

**Best practices:**

1. **Always extend defaults**: Don't replace default fields, add to them
2. **Use descriptive categories**: Keep fields organized by category
3. **Include patterns**: Add fieldPatterns for flexible matching
4. **Test your configuration**: Verify sensitive data is masked correctly
5. **Keep it updated**: Add new sensitive fields as your application evolves

## Event Emission Mode

**You need to:** Embed the SDK directly and receive logs as events instead of HTTP calls.

**Here's how:** Enable `emitEvents = true` and listen to log events.

**When to use:**

- ✅ **Direct SDK embedding**: When embedding the SDK directly in your own application
- ✅ **Avoid HTTP overhead**: Skip HTTP calls and save logs directly to DB
- ✅ **Single codebase**: Use the same logger in both client applications and your own embedded applications
- ❌ **External applications**: Regular applications should use default mode (HTTP/Redis)

**Configuration:**

```bash
# .env file
MISO_EMIT_EVENTS=true
```

```typescript
const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true // Enable event emission mode
});
```

**Usage example:**

```typescript
import { MisoClient, loadConfig, LogEntry } from '@aifabrix/miso-client';
import { db } from './database';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true
});

await client.initialize();

// Listen to log events
client.log.on('log', (logEntry: LogEntry) => {
  // Save directly to DB without HTTP
  db.saveLog(logEntry);
});

// Listen to batch events (for audit logs with batching)
client.log.on('log:batch', (logEntries: LogEntry[]) => {
  // Save batch directly to DB
  db.saveLogs(logEntries);
});

// Use logger as normal - events will be emitted instead of HTTP calls
await client.log.error('Error occurred', { error: 'details' });
await client.log.audit('user.created', 'users', { userId: '123' });
```

**Event names:**

- **`'log'`**: Emitted for all log entries (info, debug, error, audit)
  - Payload: `LogEntry` (same structure as REST API)
- **`'log:batch'`**: Emitted for batched audit logs
  - Payload: `LogEntry[]` (array of log entries)

**What happens:**

- When `emitEvents = true`, logs are emitted as events via EventEmitter
- Redis queue operations are skipped
- HTTP POST to `/api/logs` is skipped
- Batch events are emitted for audit logs with batching enabled
- All EventEmitter methods are available (`on`, `once`, `off`, etc.)

**Best practices:**

1. **Use when embedding the SDK**: Event emission mode is designed for applications that embed the SDK directly
2. **Handle events synchronously**: Listeners should handle events quickly to avoid blocking
3. **Error handling**: Wrap event listeners in try-catch to handle errors gracefully
4. **Batch processing**: Use batch events (`log:batch`) for high-volume audit logging

## API Key Testing Support

**You need to:** Test your application without requiring a full Keycloak setup.

**Here's how:** Configure `API_KEY` to bypass OAuth2 authentication for testing.

**Security notice:**

⚠️ **API_KEY is for testing only.** Do not use this in production environments. It bypasses all OAuth2/Keycloak authentication checks.

**Configuration:**

```bash
# .env file
API_KEY=test-api-key-123
```

```typescript
const client = new MisoClient({
  ...loadConfig(),
  apiKey: 'test-api-key-123' // Optional: for testing only
});
```

**Usage example:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient(loadConfig()); // API_KEY loaded from .env

// When testing with matching API key
const isValid = await client.validateToken('test-api-key-123');
// Returns: true (no controller call made)

// When testing with non-matching token
const isValid2 = await client.validateToken('different-token');
// Falls through to normal OAuth2 validation

// getUser/getUserInfo return null for API_KEY tokens (by design)
const user = await client.getUser('test-api-key-123');
// Returns: null (no controller call made)
```

**What happens:**

- Bearer tokens matching the API key automatically validate without calling the controller
- `validateToken()` returns `true` for matching API_KEY tokens without making HTTP requests
- `getUser()` and `getUserInfo()` return `null` when using API_KEY (by design for testing scenarios)
- Tokens that don't match the API key fall through to normal OAuth2 validation

**When to use:**

- ✅ Unit and integration testing
- ✅ Local development without Keycloak
- ✅ CI/CD pipeline testing
- ❌ Production environments
- ❌ Real user authentication

## Best Practices

### Security Best Practices

**Never hardcode sensitive information:**

```typescript
// ❌ Bad
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: 'hardcoded-secret', // Never do this!
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: 'hardcoded-password' // Never do this!
  }
});

// ✅ Good - Use loadConfig() or environment variables
const client = new MisoClient(loadConfig());

// ✅ Good - Or manually from env vars
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!),
    password: process.env.REDIS_PASSWORD
  },
  logLevel: process.env.MISO_LOG_LEVEL as any
});
```

**Use environment-specific configurations:**

```typescript
const config = {
  dev: { /* dev config */ },
  tst: { /* test config */ },
  pro: { /* prod config */ }
};

const environment = process.env.NODE_ENV as keyof typeof config;
const client = new MisoClient(config[environment]);
```

**Validate configuration at startup:**

```typescript
// ✅ Use loadConfig() which validates automatically
const config = loadConfig();
const client = new MisoClient(config);
```

### Performance Best Practices

**Configure appropriate cache TTL:**

```typescript
// High-security applications
cache: {
  roleTTL: 300,        // 5 minutes
  permissionTTL: 300, // 5 minutes
  tokenValidationTTL: 600, // 10 minutes
}

// High-performance applications
cache: {
  roleTTL: 1800,       // 30 minutes
  permissionTTL: 1800, // 30 minutes
  tokenValidationTTL: 1800, // 30 minutes
}
```

**Use Redis for production:**

```typescript
// Always use Redis in production
const client = new MisoClient({
  ...loadConfig(),
  redis: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT!),
    password: process.env.REDIS_PASSWORD
  }
});
```

**Configure appropriate log levels:**

```typescript
// Development
logLevel: 'debug';

// Production
logLevel: 'warn';
```

### Configuration Management

**Use configuration files:**

```typescript
// config/miso.config.ts
export const misoConfig = {
  dev: {
    controllerUrl: 'http://localhost:3000',
    clientId: 'ctrl-dev-app',
    clientSecret: process.env.DEV_CLIENT_SECRET!,
    logLevel: 'debug' as const
  },
  pro: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-pro-app',
    clientSecret: process.env.PROD_CLIENT_SECRET!,
    logLevel: 'warn' as const
  }
};
```

**Centralize configuration:**

```typescript
// config/index.ts
import { misoConfig } from './miso.config';

export function getMisoConfig() {
  const environment = process.env.NODE_ENV as keyof typeof misoConfig;
  return misoConfig[environment];
}
```
