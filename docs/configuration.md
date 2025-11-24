# Configuration Guide

Complete guide to configuring the AI Fabrix Miso Client SDK.

## Table of Contents

- [Why Use .env?](#why-use-env)
- [Basic Configuration](#basic-configuration)
- [Redis Configuration](#redis-configuration)
- [Environment Variables](#environment-variables)
- [Cache Configuration](#cache-configuration)
- [Logging Configuration](#logging-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Configuration Examples](#configuration-examples)
- [Best Practices](#best-practices)

## Why Use .env?

**Recommended approach:** Use environment variables in a `.env` file with `loadConfig()`.

### The Simple Way (Recommended)

```bash
# .env file
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
REDIS_HOST=localhost
```

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Automatically loads from .env - that's it!
const client = new MisoClient(loadConfig());
await client.initialize();
```

**Benefits:**

- ✅ No configuration boilerplate
- ✅ Easy environment switching (dev/test/prod)
- ✅ Keeps secrets out of code
- ✅ Standard practice across frameworks
- ✅ Team-friendly
- ✅ CI/CD ready

### When to Use Manual Configuration

Use manual configuration when:

- You need dynamic configuration
- Config comes from an external service
- You're integrating with an existing config system
- You have special requirements

**Example:**

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

**Most developers use .env.** The rest of this guide covers both approaches.

---

## Basic Configuration

### Required Configuration

The following configuration options are required for the MisoClient to function:

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
  };
}
```

**Example:**

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-client-secret-here'
});
```

**Recommended:** Use `loadConfig()` to load from `.env` automatically:

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
```

### Configuration Details

#### `controllerUrl`

- **Type**: `string`
- **Required**: Yes
- **Description**: The base URL of your AI Fabrix controller instance
- **Examples**:
  - `https://controller.aifabrix.ai`
  - `https://miso.yourcompany.com`
  - `http://localhost:3000` (for development)

#### `clientId`

- **Type**: `string`
- **Required**: Yes
- **Description**: Client ID for authenticating with the controller
- **Examples**:
  - `'ctrl-dev-my-app'`
  - `'ctrl-pro-production-app'`
- **Security**: Store in environment variables, never hardcode

#### `clientSecret`

- **Type**: `string`
- **Required**: Yes
- **Description**: Client secret for authenticating with the controller
- **Security**: Store in environment variables, never hardcode
- **Note**: The client token is automatically fetched and managed by the SDK

## Redis Configuration

Redis is optional but recommended for improved performance through caching.

### RedisConfig Interface

```typescript
interface RedisConfig {
  host: string; // Required: Redis host
  port: number; // Required: Redis port
  password?: string; // Optional: Redis password
  db?: number; // Optional: Redis database number
  keyPrefix?: string; // Optional: Key prefix
}
```

### Redis Configuration Options

#### `host`

- **Type**: `string`
- **Required**: Yes
- **Description**: Redis server hostname or IP address
- **Examples**:
  - `'localhost'`
  - `'redis.example.com'`
  - `'192.168.1.100'`

#### `port`

- **Type**: `number`
- **Required**: Yes
- **Description**: Redis server port
- **Default**: `6379`
- **Examples**:
  - `6379` (standard Redis port)
  - `6380` (Redis with TLS)
  - `16379` (custom port)

#### `password`

- **Type**: `string`
- **Required**: No
- **Description**: Redis authentication password
- **Security**: Store in environment variables, never hardcode

#### `db`

- **Type**: `number`
- **Required**: No
- **Description**: Redis database number (0-15)
- **Default**: `0`

#### `keyPrefix`

- **Type**: `string`
- **Required**: No
- **Description**: Prefix for all Redis keys
- **Default**: `'miso:'`
- **Examples**:
  - `'miso:'`
  - `'myapp:miso:'`
  - `'prod:miso:'`

### Redis Configuration Examples

#### Basic Redis Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  redis: {
    host: 'localhost',
    port: 6379
  }
});
```

#### Redis with Authentication

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET,
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 1,
    keyPrefix: 'prod:miso:'
  }
});
```

#### Redis Cluster Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET,
  redis: {
    host: 'redis-cluster.example.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'cluster:miso:'
  }
});
```

## Environment Variables

You can configure the client using environment variables for better security and flexibility.

### Environment Variable Names

```bash
# Required
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret-here

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
```

### Loading Configuration from Environment

```typescript
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'miso:'
  },
  logLevel: process.env.MISO_LOG_LEVEL as any,
  encryptionKey: process.env.ENCRYPTION_KEY,
  apiKey: process.env.API_KEY
});
```

### Environment-Specific Configuration

#### Development Environment

```bash
# .env.development
MISO_CONTROLLER_URL=http://localhost:3000
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-dev-secret
REDIS_HOST=localhost
REDIS_PORT=6379
MISO_LOG_LEVEL=debug
```

#### Test Environment

```bash
# .env.test
MISO_CONTROLLER_URL=https://test-controller.aifabrix.ai
MISO_CLIENTID=ctrl-test-my-app
MISO_CLIENTSECRET=your-test-secret
REDIS_HOST=test-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=test-password
MISO_LOG_LEVEL=info
```

#### Production Environment

```bash
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

Configure caching behavior for roles and permissions.

### Cache Configuration Interface

```typescript
interface CacheConfig {
  roleTTL?: number; // Role cache TTL in seconds
  permissionTTL?: number; // Permission cache TTL in seconds
}
```

### Cache Configuration Options

#### `roleTTL`

- **Type**: `number`
- **Required**: No
- **Description**: Time-to-live for role cache in seconds
- **Default**: `900` (15 minutes)
- **Recommended**: `300` - `1800` (5-30 minutes)

#### `permissionTTL`

- **Type**: `number`
- **Required**: No
- **Description**: Time-to-live for permission cache in seconds
- **Default**: `900` (15 minutes)
- **Recommended**: `300` - `1800` (5-30 minutes)

### Cache Configuration Examples

#### Short Cache Duration (High Security)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-secure-app',
  clientSecret: 'your-secret',
  cache: {
    roleTTL: 300, // 5 minutes
    permissionTTL: 300 // 5 minutes
  }
});
```

#### Long Cache Duration (High Performance)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-app',
  clientSecret: 'your-secret',
  cache: {
    roleTTL: 1800, // 30 minutes
    permissionTTL: 1800 // 30 minutes
  }
});
```

#### Custom Cache Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: 'your-secret',
  cache: {
    roleTTL: 600, // 10 minutes for roles
    permissionTTL: 300 // 5 minutes for permissions
  }
});
```

## Logging Configuration

Configure logging behavior and levels.

### Log Level Options

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

#### `debug`

- **Description**: Logs all messages including debug information
- **Use Case**: Development and debugging
- **Performance**: Lowest performance due to verbose logging

#### `info`

- **Description**: Logs informational messages and above
- **Use Case**: General application logging
- **Performance**: Good balance of information and performance

#### `warn`

- **Description**: Logs warning messages and errors only
- **Use Case**: Production environments
- **Performance**: High performance, minimal logging

#### `error`

- **Description**: Logs only error messages
- **Use Case**: Critical production environments
- **Performance**: Highest performance, minimal logging

### Logging Configuration Examples

#### Development Logging

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-app',
  clientSecret: 'your-secret',
  logLevel: 'debug'
});
```

#### Production Logging

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-app',
  clientSecret: 'your-secret',
  logLevel: 'warn'
});
```

#### Conditional Logging

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!,
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
});
```

## Audit Configuration

Configure HTTP request audit logging behavior and performance optimizations. The SDK automatically optimizes audit logging performance through intelligent processing, truncation, and batching to minimize overhead while maintaining ISO 27001 compliance.

### Audit Configuration Options

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

### Audit Levels

#### `minimal`

- **Description**: Only metadata (method, URL, status, duration) - no masking, no sizes
- **Use Case**: Maximum performance, compliance with minimal audit requirements
- **Performance**: Fastest - < 1ms CPU overhead
- **ISO 27001 Compliance**: ✅ (minimal audit trail)

#### `standard`

- **Description**: Light masking (headers only, selective body masking)
- **Use Case**: Balanced performance and audit detail
- **Performance**: Fast - ~5-10ms CPU overhead for medium requests
- **ISO 27001 Compliance**: ✅ (audit trail with selective masking)

#### `detailed` (Default)

- **Description**: Full masking with sizes - current default behavior, optimized
- **Use Case**: Full compliance audit logging with performance optimizations
- **Performance**: Optimized - ~10-20ms CPU overhead for medium requests
- **ISO 27001 Compliance**: ✅ (full audit trail with data protection)

#### `full`

- **Description**: Everything including debug-level details
- **Use Case**: Development and debugging
- **Performance**: Most detailed - ~20-50ms CPU overhead for medium requests
- **ISO 27001 Compliance**: ✅ (comprehensive audit trail)

### Audit Configuration Examples

#### High Performance Production (Minimal)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-app',
  clientSecret: 'your-secret',
  audit: {
    level: 'minimal' // Only metadata, fastest performance
  }
});
```

#### Balanced Production (Standard)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-app',
  clientSecret: 'your-secret',
  audit: {
    level: 'standard', // Light masking, good performance
    maxResponseSize: 10000, // Truncate large responses
    maxMaskingSize: 50000 // Skip masking for very large objects
  }
});
```

#### Full Compliance (Detailed - Default)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-app',
  clientSecret: 'your-secret',
  audit: {
    level: 'detailed', // Full masking with optimizations (default)
    maxResponseSize: 10000,
    maxMaskingSize: 50000
  }
});
```

#### Development/Debugging (Full)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-app',
  clientSecret: 'your-secret',
  audit: {
    level: 'full' // Everything for debugging
  }
});
```

#### Batch Logging for High Volume

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-app',
  clientSecret: 'your-secret',
  audit: {
    batchSize: 20, // Batch 20 logs per request
    batchInterval: 200 // Flush every 200ms
  }
});
```

#### Skip Specific Endpoints

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-app',
  clientSecret: 'your-secret',
  audit: {
    skipEndpoints: ['/api/health', '/api/metrics'] // Don't audit health checks
  }
});
```

#### Disable Audit Logging

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-app',
  clientSecret: 'your-secret',
  audit: {
    enabled: false // Completely disable audit logging
  }
});
```

### Performance Impact by Request Size

The SDK automatically optimizes audit logging based on request size:

#### Small Requests (< 10KB)

- **Minimal**: < 1ms CPU overhead
- **Standard**: ~2-5ms CPU overhead
- **Detailed**: ~5-10ms CPU overhead
- **Full**: ~7-15ms CPU overhead

#### Medium Requests (10KB-100KB)

- **Minimal**: < 1ms CPU overhead
- **Standard**: ~5-10ms CPU overhead
- **Detailed**: ~10-20ms CPU overhead
- **Full**: ~20-50ms CPU overhead

#### Large Requests (> 100KB)

- **Minimal**: < 1ms CPU overhead
- **Standard**: ~10-20ms CPU overhead (automatically uses metadata-only mode)
- **Detailed**: ~20-50ms CPU overhead (automatically skips masking for large objects)
- **Full**: ~50-100ms CPU overhead

### Batch Logging Performance

The SDK automatically batches audit logs to minimize network overhead:

- **Default batching**: ~10 audit logs per HTTP request (automatically reduces network overhead by 90%)
- **Custom batching**: Configurable batch size and interval for your specific needs

### Best Practices

1. **Production**: Use `minimal` or `standard` for maximum performance
2. **Development**: Use `full` for comprehensive debugging
3. **High Volume**: Enable batch logging with larger batch sizes
4. **Large Payloads**: Configure `maxResponseSize` and `maxMaskingSize` appropriately
5. **Health Checks**: Skip auditing for health check endpoints using `skipEndpoints`

---

## Sensitive Fields Configuration

The SDK includes ISO 27001 compliant data masking for sensitive fields in audit and debug logs. You can customize which fields are considered sensitive by providing your own configuration file.

### Default Configuration

The SDK includes a default `sensitive-fields.config.json` file that masks common sensitive fields including:

- **Authentication**: password, token, secret, key, authorization, cookie, session
- **PII**: email, phone, ssn, taxId
- **Financial**: creditCard, cvv, pin, bankAccount, routingNumber
- **Security**: otp, privateKey, encryptionKey

### Custom Configuration

You can provide your own sensitive fields configuration file to extend or customize the default fields:

#### Using Environment Variable

```bash
# .env file
MISO_SENSITIVE_FIELDS_CONFIG=/path/to/custom-sensitive-fields.json
```

#### Using Config Object

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  sensitiveFieldsConfig: '/path/to/custom-sensitive-fields.json' // Optional
});
```

### Configuration File Structure

Your custom configuration file should follow this JSON structure:

```json
{
  "version": "1.0.0",
  "description": "Your custom sensitive fields configuration",
  "categories": {
    "authentication": [
      "password",
      "token",
      "secret",
      // ... add your custom authentication fields
    ],
    "pii": [
      "email",
      "ssn",
      "phone",
      // ... add your custom PII fields
    ],
    "financial": [
      "creditCard",
      "cvv",
      "bankAccount",
      // ... add your custom financial fields
    ],
    "security": [
      "privateKey",
      "encryptionKey",
      // ... add your custom security fields
    ]
  },
  "fieldPatterns": [
    "password",
    "secret",
    "token",
    // ... patterns that match sensitive fields
  ]
}
```

### Field Categories

#### `authentication`

Fields related to authentication and authorization:

- `password`, `passwd`, `pwd`
- `token`, `secret`, `key`
- `authorization`, `auth`
- `cookie`, `session`
- `apiKey`, `accessToken`, `refreshToken`

#### `pii`

Personally Identifiable Information:

- `email`, `emailAddress`
- `phone`, `phoneNumber`, `telephone`, `mobile`
- `ssn`, `socialSecurityNumber`
- `taxId`, `taxIdentification`

#### `financial`

Financial information:

- `creditCard`, `cc`, `cardNumber`
- `cvv`, `cvv2`, `cvc`
- `pin`, `bankAccount`, `bankAccountNumber`
- `routingNumber`, `iban`, `swift`
- `accountNumber`

#### `security`

Security-related fields:

- `otp`, `oneTimePassword`
- `privateKey`, `publicKey`
- `encryptionKey`, `decryptionKey`

### Field Patterns

The `fieldPatterns` array contains patterns that are matched against field names. If a field name contains any of these patterns, it will be masked.

Example patterns:

- `password` - matches fields like `userPassword`, `adminPassword`, etc.
- `secret` - matches fields like `apiSecret`, `clientSecret`, etc.
- `token` - matches fields like `accessToken`, `refreshToken`, etc.

### Example Custom Configuration

```json
{
  "version": "1.0.0",
  "description": "Custom sensitive fields for MyApp",
  "categories": {
    "authentication": [
      "password",
      "token",
      "apiKey",
      "myCustomAuthField"  // Your custom field
    ],
    "pii": [
      "email",
      "ssn",
      "customPIIField"  // Your custom field
    ],
    "financial": [
      "creditCard",
      "bankAccount"
    ],
    "security": [
      "privateKey",
      "mySecurityField"  // Your custom field
    ]
  },
  "fieldPatterns": [
    "password",
    "secret",
    "token",
    "customPattern"  // Your custom pattern
  ]
}
```

### How It Works

1. The SDK loads your custom configuration file on initialization
2. Custom fields are merged with default fields (custom fields extend defaults)
3. All HTTP request/response data is automatically masked before logging
4. Masking happens in:
   - Audit logs (always)
   - Debug logs (when `logLevel === 'debug'`)

### Best Practices

1. **Always extend defaults**: Don't replace default fields, add to them
2. **Use descriptive categories**: Keep fields organized by category
3. **Include patterns**: Add fieldPatterns for flexible matching
4. **Test your configuration**: Verify sensitive data is masked correctly
5. **Keep it updated**: Add new sensitive fields as your application evolves

### ISO 27001 Compliance

The SDK automatically masks all sensitive data according to ISO 27001 standards:

- Request headers (Authorization, tokens, cookies)
- Request bodies (passwords, secrets, PII)
- Response bodies (especially error responses)
- Recursive masking for nested objects and arrays

### Example Usage

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Set custom config path in .env or config
const client = new MisoClient({
  ...loadConfig(),
  sensitiveFieldsConfig: './my-custom-sensitive-fields.json'
});

await client.initialize();

// All HTTP requests will now use your custom sensitive fields configuration
// for masking data in audit and debug logs
const user = await client.getUser(token);
```

## Event Emission Mode

The SDK supports event emission mode for direct SDK embedding in your own application. When `emitEvents = true`, logs are emitted as Node.js events instead of being sent via HTTP REST API or Redis queues. This enables your application to embed the SDK directly, listen to log events, and save them directly to the database without HTTP round-trips.

### When to Use Event Emission

- ✅ **Direct SDK embedding**: When embedding the SDK directly in your own application
- ✅ **Avoid HTTP overhead**: Skip HTTP calls and save logs directly to DB
- ✅ **Single codebase**: Use the same logger in both client applications and your own embedded applications
- ❌ **External applications**: Regular applications should use default mode (HTTP/Redis)

### Configuration

#### Using Environment Variables

```bash
# .env file
MISO_EMIT_EVENTS=true
```

#### Manual Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  emitEvents: true // Enable event emission mode
});
```

### Event Names

- **`'log'`**: Emitted for all log entries (info, debug, error, audit)
  - Payload: `LogEntry` (same structure as REST API)
- **`'log:batch'`**: Emitted for batched audit logs
  - Payload: `LogEntry[]` (array of log entries)

### Usage Example

```typescript
import { MisoClient, loadConfig, LogEntry } from '@aifabrix/miso-client';

// Create client with emitEvents enabled
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

### Event Payload Structure

The event payload has the same structure as what would be sent to the REST API:

```typescript
interface LogEntry {
  timestamp: string;
  level: 'error' | 'audit' | 'info' | 'debug';
  environment: string;
  application: string;
  applicationId: string;
  userId?: string;
  message: string;
  context?: Record<string, unknown>;
  stackTrace?: string;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  // ... other ISO 27001 metadata fields
}
```

### Behavior Differences

#### When `emitEvents = true`

- ✅ Logs are emitted as events via EventEmitter
- ❌ Redis queue operations are skipped
- ❌ HTTP POST to `/api/logs` is skipped
- ✅ Batch events are emitted for audit logs with batching enabled
- ✅ All EventEmitter methods are available (`on`, `once`, `off`, etc.)

#### When `emitEvents = false` (default)

- ❌ Events are not emitted
- ✅ Redis queue operations (if Redis is connected)
- ✅ HTTP POST fallback (if Redis fails or not connected)
- ✅ Normal batch processing via HTTP/Redis

### Best Practices

1. **Use when embedding the SDK**: Event emission mode is designed for applications that embed the SDK directly
2. **Handle events synchronously**: Listeners should handle events quickly to avoid blocking
3. **Error handling**: Wrap event listeners in try-catch to handle errors gracefully
4. **Batch processing**: Use batch events (`log:batch`) for high-volume audit logging

### Example: Complete Setup for Direct SDK Embedding

```typescript
import { MisoClient, loadConfig, LogEntry } from '@aifabrix/miso-client';
import { db } from './database';

const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true,
  audit: {
    batchSize: 10,
    batchInterval: 100
  }
});

await client.initialize();

// Single log event handler
client.log.on('log', (logEntry: LogEntry) => {
  try {
    // Save to database directly
    await db.logs.insert({
      timestamp: logEntry.timestamp,
      level: logEntry.level,
      message: logEntry.message,
      context: logEntry.context,
      userId: logEntry.userId,
      // ... other fields
    });
  } catch (error) {
    console.error('Failed to save log:', error);
  }
});

// Batch event handler (for audit logs)
client.log.on('log:batch', async (logEntries: LogEntry[]) => {
  try {
    // Batch insert to database
    await db.logs.insertMany(
      logEntries.map(entry => ({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        context: entry.context,
        userId: entry.userId,
        // ... other fields
      }))
    );
  } catch (error) {
    console.error('Failed to save batch logs:', error);
  }
});

// Use logger normally - events will be emitted
await client.log.info('Application started');
await client.log.error('Operation failed', { error: 'details' });
```

### Backward Compatibility

When `emitEvents` is not set or `false`, the SDK maintains backward compatibility:

- Uses Redis queues (if Redis is connected)
- Falls back to HTTP POST (if Redis fails or not connected)
- No breaking changes to existing applications

---

## API Key Testing Support

The SDK supports an optional `API_KEY` configuration that allows bypassing OAuth2 authentication for testing purposes. This is useful when you need to test your application without requiring a full Keycloak setup.

### How It Works

When `API_KEY` is configured:

- Bearer tokens matching the API key will automatically validate without calling the controller
- `validateToken()` returns `true` for matching API_KEY tokens without making HTTP requests
- `getUser()` and `getUserInfo()` return `null` when using API_KEY (by design for testing scenarios)
- Tokens that don't match the API key fall through to normal OAuth2 validation

### Security Notice

⚠️ **API_KEY is for testing only.** Do not use this in production environments. It bypasses all OAuth2/Keycloak authentication checks.

### Configuration

#### Using Environment Variables

```bash
# .env file
API_KEY=test-api-key-123
```

#### Manual Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  apiKey: 'test-api-key-123' // Optional: for testing only
});
```

### Usage Example

```typescript
// Set API_KEY in environment or config
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

### When to Use API_KEY

- ✅ Unit and integration testing
- ✅ Local development without Keycloak
- ✅ CI/CD pipeline testing
- ❌ Production environments
- ❌ Real user authentication

## Advanced Configuration

### Custom HTTP Client Configuration

The SDK uses axios internally. You can extend the configuration by accessing the HttpClient:

```typescript
import { HttpClient } from '@aifabrix/miso-client';

class CustomHttpClient extends HttpClient {
  constructor(config: MisoClientConfig) {
    super(config);

    // Add custom interceptors
    this.axios.interceptors.request.use(
      (config) => {
        // Add custom headers
        config.headers['X-Custom-Header'] = 'custom-value';
        return config;
      },
      (error) => Promise.reject(error)
    );
  }
}
```

### Custom Redis Configuration

For advanced Redis configurations, you can extend the RedisService:

```typescript
import { RedisService } from '@aifabrix/miso-client';
import Redis from 'ioredis';

class CustomRedisService extends RedisService {
  async connect(): Promise<void> {
    // Custom Redis connection logic
    this.redis = new Redis({
      host: this.config?.host,
      port: this.config?.port,
      password: this.config?.password,
      db: this.config?.db || 0,
      keyPrefix: this.config?.keyPrefix || 'miso:',

      // Custom Redis options
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,

      // Cluster configuration
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    });

    await this.redis.connect();
    this.connected = true;
  }
}
```

### Multi-Environment Configuration

```typescript
interface EnvironmentConfig {
  dev: MisoClientConfig;
  tst: MisoClientConfig;
  pro: MisoClientConfig;
}

const configs: EnvironmentConfig = {
  dev: {
    controllerUrl: 'http://localhost:3000',
    clientId: 'ctrl-dev-app',
    clientSecret: process.env.DEV_CLIENT_SECRET!,
    redis: {
      host: 'localhost',
      port: 6379
    },
    logLevel: 'debug'
  },
  tst: {
    controllerUrl: 'https://test-controller.aifabrix.ai',
    clientId: 'ctrl-test-app',
    clientSecret: process.env.TEST_CLIENT_SECRET!,
    redis: {
      host: 'test-redis.example.com',
      port: 6379,
      password: process.env.TEST_REDIS_PASSWORD
    },
    logLevel: 'info'
  },
  pro: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-pro-app',
    clientSecret: process.env.PROD_CLIENT_SECRET!,
    redis: {
      host: 'prod-redis.example.com',
      port: 6379,
      password: process.env.PROD_REDIS_PASSWORD,
      db: 1,
      keyPrefix: 'prod:miso:'
    },
    logLevel: 'warn',
    cache: {
      roleTTL: 600,
      permissionTTL: 300
    }
  }
};

const environment = process.env.NODE_ENV as keyof EnvironmentConfig;
const client = new MisoClient(configs[environment]);
```

## Configuration Examples

### Complete Configuration Examples

#### Minimal Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET!
});
```

#### Full Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 1,
    keyPrefix: 'prod:miso:'
  },
  logLevel: 'warn',
  cache: {
    roleTTL: 600, // 10 minutes
    permissionTTL: 300 // 5 minutes
  }
});
```

#### Docker Configuration

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Recommended: Use loadConfig() which reads from .env
const client = new MisoClient(loadConfig());

// Or manually:
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  logLevel: process.env.MISO_LOG_LEVEL as any
});
```

#### Kubernetes Configuration

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Recommended: Use loadConfig() which reads from environment variables
const client = new MisoClient(loadConfig());

// Or manually:
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: process.env.REDIS_SERVICE_HOST!,
    port: parseInt(process.env.REDIS_SERVICE_PORT!),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: `${process.env.POD_NAMESPACE}:miso:`
  },
  logLevel: 'info'
});
```

## Best Practices

### Security Best Practices

1. **Never hardcode sensitive information**:

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

2. **Use environment-specific configurations**:

   ```typescript
   const config = {
     dev: {
       /* dev config */
     },
     tst: {
       /* test config */
     },
     pro: {
       /* prod config */
     }
   };

   const environment = process.env.NODE_ENV as keyof typeof config;
   const client = new MisoClient(config[environment]);
   ```

3. **Validate configuration at startup**:

   ```typescript
   function validateConfig(config: MisoClientConfig): void {
     if (!config.controllerUrl) {
       throw new Error('MISO_CONTROLLER_URL is required');
     }
     if (!config.clientId) {
       throw new Error('MISO_CLIENTID is required');
     }
     if (!config.clientSecret) {
       throw new Error('MISO_CLIENTSECRET is required');
     }
   }

   // Recommended: Use loadConfig()
   const config = loadConfig();
   validateConfig(config);
   const client = new MisoClient(config);
   
   // Or manually:
   const manualConfig = {
     controllerUrl: process.env.MISO_CONTROLLER_URL!,
     clientId: process.env.MISO_CLIENTID!,
     clientSecret: process.env.MISO_CLIENTSECRET!
   };
   validateConfig(manualConfig);
   const client2 = new MisoClient(manualConfig);
   ```

### Performance Best Practices

1. **Configure appropriate cache TTL**:

   ```typescript
   // High-security applications
   cache: {
     roleTTL: 300,        // 5 minutes
     permissionTTL: 300, // 5 minutes
   }

   // High-performance applications
   cache: {
     roleTTL: 1800,       // 30 minutes
     permissionTTL: 1800, // 30 minutes
   }
   ```

2. **Use Redis for production**:

   ```typescript
   // Always use Redis in production
   const client = new MisoClient({
     // ... other config
     redis: {
       host: process.env.REDIS_HOST!,
       port: parseInt(process.env.REDIS_PORT!),
       password: process.env.REDIS_PASSWORD
     }
   });
   ```

3. **Configure appropriate log levels**:

   ```typescript
   // Development
   logLevel: 'debug';

   // Production
   logLevel: 'warn';
   ```

### Configuration Management

1. **Use configuration files**:

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

2. **Centralize configuration**:

   ```typescript
   // config/index.ts
   import { misoConfig } from './miso.config';

   export function getMisoConfig() {
     const environment = process.env.NODE_ENV as keyof typeof misoConfig;
     return misoConfig[environment];
   }
   ```

3. **Use configuration validation**:

   ```typescript
   import { z } from 'zod';

   const misoConfigSchema = z.object({
     controllerUrl: z.string().url(),
     clientId: z.string().min(1),
     clientSecret: z.string().min(1),
     redis: z
       .object({
         host: z.string(),
         port: z.number().min(1).max(65535),
         password: z.string().optional()
       })
       .optional(),
     logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
     encryptionKey: z.string().optional(),
     cache: z.object({
       roleTTL: z.number().optional(),
       permissionTTL: z.number().optional()
     }).optional()
   });

   const config = misoConfigSchema.parse(process.env);
   const client = new MisoClient(config);
   ```

This configuration guide provides comprehensive information about all available configuration options and best practices for using the AI Fabrix Miso Client SDK effectively.
