# Services API Reference

Complete API reference for service classes and methods in the MisoClient SDK: logging, encryption, caching, and service classes.

## Table of Contents

- [Logging Methods](#logging-methods)
- [Encryption Methods](#encryption-methods)
- [Cache Methods](#cache-methods)
- [Service Classes](#service-classes)
- [Examples](#examples)
- [See Also](#see-also)

## Logging Methods

The SDK provides a logger service accessible via `client.log`. The logger extends `EventEmitter` and supports event emission mode for direct SDK embedding in your own application.

**Event Emission Mode:**
When `emitEvents = true` in config, logs are emitted as Node.js events instead of being sent via HTTP/Redis. See [Event Emission Mode Guide](./configuration.md#event-emission-mode) for details.

### Basic Logging Methods

#### `log.error(message: string, context?: object): Promise<void>`

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

#### `log.audit(action: string, resource: string, context?: object): Promise<void>`

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

#### `log.info(message: string, context?: object): Promise<void>`

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

#### `log.debug(message: string, context?: object): Promise<void>`

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

### Fluent API with LoggerChain

The logger supports a fluent API via `LoggerChain` for building complex logging scenarios with method chaining.

#### `log.withContext(context: Record<string, unknown>): LoggerChain`

Creates a logger chain with initial context.

**Parameters:**

- `context` - Context object to include in logs

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
await client.log
  .withContext({ operation: 'sync', source: 'external-api' })
  .info('Sync started');
```

#### `log.withToken(token: string): LoggerChain`

Creates a logger chain with JWT token for automatic user context extraction.

**Parameters:**

- `token` - JWT token to extract user context from

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
await client.log
  .withToken(userToken)
  .info('User action performed');
```

#### `log.forRequest(req: Request): LoggerChain`

Creates a logger chain with request context pre-populated. Auto-extracts IP, method, path, user-agent, correlation ID, and user from JWT.

**Parameters:**

- `req` - Express Request object

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
import { Request } from 'express';

app.get('/api/users', async (req: Request, res) => {
  await client.log
    .forRequest(req)
    .info('Users list accessed');
  
  // Automatically includes: IP, method, path, userAgent, correlationId, userId
});
```

### Unified Logging Interface

The SDK provides a unified logging interface with a minimal API (1-3 parameters maximum) and automatic context extraction via AsyncLocalStorage. This enables simple, consistent logging across all applications without requiring manual context passing.

**Key Benefits:**

- **Minimal API**: Maximum 1-3 parameters per logging call
- **Automatic Context**: Context extracted automatically from AsyncLocalStorage (set by Express middleware or manually)
- **Simple Usage**: `logger.info(message)`, `logger.error(message, error?)`, `logger.audit(action, resource, entityId?, oldValues?, newValues?)`
- **Framework Agnostic**: Works in Express routes, service layers, background jobs
- **Zero Configuration**: Context automatically available when middleware is used

**Setup:**

1. Add Express middleware (if using Express):
```typescript
import { loggerContextMiddleware } from '@aifabrix/miso-client';

app.use(loggerContextMiddleware);
```

2. Get logger instance anywhere:
```typescript
import { getLogger } from '@aifabrix/miso-client';

const logger = getLogger();
```

#### `getLogger(loggerService?: LoggerService): UnifiedLogger`

Factory function to get UnifiedLogger instance with automatic context detection from AsyncLocalStorage.

**Parameters:**

- `loggerService` - Optional LoggerService instance (if not provided, uses registered instance from MisoClient)

**Returns:** `UnifiedLogger` instance

**Example:**

```typescript
import { getLogger } from '@aifabrix/miso-client';

const logger = getLogger();
await logger.info('Message'); // Auto-extracts context from AsyncLocalStorage
```

#### `setLoggerContext(context: Partial<LoggerContext>): void`

Set logger context for current async execution context. Context is automatically available to all code in the same async context.

**Parameters:**

- `context` - Context to set (partial, will be merged with existing)

**Example:**

```typescript
import { setLoggerContext } from '@aifabrix/miso-client';

setLoggerContext({
  userId: 'user-123',
  correlationId: 'req-456',
  ipAddress: '192.168.1.1',
});
```

#### `clearLoggerContext(): void`

Clear logger context for current async execution context.

**Example:**

```typescript
import { clearLoggerContext } from '@aifabrix/miso-client';

clearLoggerContext();
```

#### `mergeLoggerContext(additional: Partial<LoggerContext>): void`

Merge additional fields into existing logger context.

**Parameters:**

- `additional` - Additional context fields to merge

**Example:**

```typescript
import { mergeLoggerContext } from '@aifabrix/miso-client';

mergeLoggerContext({ userId: 'user-123' });
```

#### UnifiedLogger Methods

##### `info(message: string): Promise<void>`

Log info message with automatic context extraction.

**Parameters:**

- `message` - Info message

**Example:**

```typescript
const logger = getLogger();
await logger.info('Users list accessed');
```

##### `warn(message: string): Promise<void>`

Log warning message with automatic context extraction.

**Parameters:**

- `message` - Warning message

**Example:**

```typescript
const logger = getLogger();
await logger.warn('Rate limit approaching');
```

##### `debug(message: string): Promise<void>`

Log debug message with automatic context extraction.

**Parameters:**

- `message` - Debug message

**Example:**

```typescript
const logger = getLogger();
await logger.debug('Processing request');
```

##### `error(message: string, error?: unknown): Promise<void>`

Log error message with automatic context extraction and error details.

**Parameters:**

- `message` - Error message
- `error` - Optional error object (auto-extracts stack trace, error name, error message)

**Example:**

```typescript
const logger = getLogger();

try {
  await processData();
} catch (error) {
  await logger.error('Failed to process data', error); // Auto-extracts error details
}
```

##### `audit(action: string, resource: string, entityId?: string, oldValues?: object, newValues?: object): Promise<void>`

Log audit event with automatic context extraction.

**Parameters:**

- `action` - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
- `resource` - Resource type (e.g., 'User', 'Tenant')
- `entityId` - Optional entity ID (defaults to 'unknown')
- `oldValues` - Optional old values for UPDATE operations (ISO 27001 requirement)
- `newValues` - Optional new values for CREATE/UPDATE operations (ISO 27001 requirement)

**Example:**

```typescript
const logger = getLogger();

// CREATE operation
await logger.audit('CREATE', 'User', 'user-123', undefined, { name: 'John Doe' });

// UPDATE operation
await logger.audit('UPDATE', 'User', 'user-123', { name: 'John' }, { name: 'John Doe' });

// DELETE operation
await logger.audit('DELETE', 'User', 'user-123');
```

#### Express Middleware

##### `loggerContextMiddleware`

Express middleware to set logger context from request. Extracts context from Request object and sets it in AsyncLocalStorage.

**Usage:**

```typescript
import { loggerContextMiddleware } from '@aifabrix/miso-client';

// Add middleware early in middleware chain (after auth middleware if you need JWT context)
app.use(loggerContextMiddleware);

app.get('/api/users', async (req, res) => {
  const logger = getLogger();
  await logger.info('Users list accessed'); // Auto-extracts context from request
});
```

**Auto-extracted Context Fields:**

- `ipAddress` - Client IP address (from request.ip or connection.remoteAddress)
- `userAgent` - User agent string (from User-Agent header)
- `correlationId` - Request correlation ID (from x-correlation-id header or auto-generated)
- `userId` - Authenticated user ID (from JWT token or x-user-id header)
- `sessionId` - Session ID (from JWT token or x-session-id header)
- `method` - HTTP method (GET, POST, etc.)
- `path` - Request path
- `hostname` - Request hostname (from Host header)
- `applicationId` - Application identifier (from JWT token or x-application-id header)

**See Also:**

- [Background Jobs Examples](./examples/background-jobs.md) - Logging examples with request context
- [Express Middleware Examples](./examples/express-middleware.md) - Express integration examples
- [Background Jobs Examples](./examples/background-jobs.md) - Background job logging patterns

### Log Entry Getter Methods

The logger provides getter methods that return `LogEntry` objects instead of sending logs directly. These methods are designed for external logger integration, allowing you to use your own logger tables while automatically extracting default context from the system.

**Use Case:** When you need to save logs to your own database tables with custom schemas, but want to leverage the SDK's automatic context extraction (IP, method, path, userAgent, correlationId, userId from request; userId, sessionId from token).

#### `log.getLogWithRequest(req: Request, message: string, level?: LogEntry["level"], context?: Record<string, unknown>): LogEntry`

Returns a `LogEntry` object with request context automatically extracted. Extracts IP, method, path, userAgent, correlationId, userId from Express Request.

**Parameters:**

- `req` - Express Request object
- `message` - Log message
- `level` - Optional log level (defaults to 'info')
- `context` - Optional additional context object

**Returns:** Complete `LogEntry` object with all request context extracted

**Auto-extracted Fields:**

- `ipAddress` - Client IP (handles proxy headers)
- `method` - HTTP method (GET, POST, etc.)
- `path` - Request path
- `userAgent` - Browser/client user agent
- `correlationId` - From `x-correlation-id` header or auto-generated
- `userId` - Extracted from JWT token in Authorization header
- `sessionId` - Extracted from JWT token
- `requestId` - From `x-request-id` header

**Example:**

```typescript
import { Request } from 'express';

app.get('/api/users', async (req: Request, res) => {
  // Get LogEntry object with all request context
  const logEntry = client.log.getLogWithRequest(
    req,
    'Users list accessed',
    'info',
    { action: 'list_users' }
  );

  // Save to your own logger table
  await myCustomLogger.save(logEntry);
  
  // logEntry contains: timestamp, level, message, context, 
  // ipAddress, method, path, userAgent, correlationId, userId, etc.
});
```

#### `log.getWithContext(context: Record<string, unknown>, message: string, level?: LogEntry["level"]): LogEntry`

Returns a `LogEntry` object with provided context. Generates correlation ID automatically and extracts metadata from environment.

**Parameters:**

- `context` - Context object to include in logs
- `message` - Log message
- `level` - Optional log level (defaults to 'info')

**Returns:** Complete `LogEntry` object

**Example:**

```typescript
const logEntry = client.log.getWithContext(
  { operation: 'sync', source: 'external-api' },
  'Sync started',
  'info'
);

// Save to your own logger table
await myCustomLogger.save(logEntry);
```

#### `log.getWithToken(token: string, message: string, level?: LogEntry["level"], context?: Record<string, unknown>): LogEntry`

Returns a `LogEntry` object with token context extracted. Extracts userId, sessionId, applicationId from JWT token and generates correlation ID automatically.

**Parameters:**

- `token` - JWT token to extract user context from
- `message` - Log message
- `level` - Optional log level (defaults to 'info')
- `context` - Optional additional context object

**Returns:** Complete `LogEntry` object with user context

**Extracted from Token:**

- `userId` - From `sub`, `userId`, or `user_id` fields
- `sessionId` - From `sessionId` or `sid` fields
- `applicationId` - From `applicationId` or `app_id` fields

**Example:**

```typescript
const token = req.headers.authorization?.replace('Bearer ', '');

const logEntry = client.log.getWithToken(
  token,
  'Token validated',
  'audit',
  { action: 'validate' }
);

// Save to your own logger table
await myCustomLogger.save(logEntry);
```

#### `log.getForRequest(req: Request, message: string, level?: LogEntry["level"], context?: Record<string, unknown>): LogEntry`

Alias for `getLogWithRequest()`. Returns a `LogEntry` object with request context extracted.

**Parameters:**

- `req` - Express Request object
- `message` - Log message
- `level` - Optional log level (defaults to 'info')
- `context` - Optional additional context object

**Returns:** Complete `LogEntry` object

**Example:**

```typescript
const logEntry = client.log.getForRequest(req, 'User action', 'info', { action: 'login' });
await myCustomLogger.save(logEntry);
```

#### `log.generateCorrelationId(): string`

Generates a unique correlation ID for request tracing. Format: `{clientId-prefix}-{timestamp}-{counter}-{random}`.

**Returns:** Unique correlation ID string

**Example:**

```typescript
const correlationId = client.log.generateCorrelationId();
// Returns: "ctrl-dev-t-1234567890-1-abc123xyz"
```

**Note:** All getter methods automatically mask sensitive data in context when data masking is enabled (default). The returned `LogEntry` objects are ready to be saved to your own logger tables without additional processing.

**Complete Example - External Logger Integration:**

```typescript
import { Request } from 'express';
import { MisoClient, loadConfig, LogEntry } from '@aifabrix/miso-client';
import { db } from './database';

const client = new MisoClient(loadConfig());
await client.initialize();

// Express route handler
app.post('/api/users', async (req: Request, res) => {
  try {
    // Get LogEntry with all request context automatically extracted
    const logEntry = client.log.getLogWithRequest(
      req,
      'User creation started',
      'info',
      { action: 'create_user' }
    );

    // Save to your own logger table
    await db.customLogs.insert({
      ...logEntry,
      // Add any custom fields your schema requires
      customField: 'value'
    });

    // Perform operation
    const user = await createUser(req.body);

    // Log success with token context
    const token = req.headers.authorization?.replace('Bearer ', '');
    const successLog = client.log.getWithToken(
      token,
      'User created successfully',
      'audit',
      { userId: user.id, action: 'user.created' }
    );

    await db.customLogs.insert(successLog);
    res.json(user);
  } catch (error) {
    // Log error with request context
    const errorLog = client.log.getLogWithRequest(
      req,
      'User creation failed',
      'error',
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    );

    await db.customLogs.insert(errorLog);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Background job example
async function processJob(jobData: any) {
  // Get LogEntry with context (no request available)
  const logEntry = client.log.getWithContext(
    { jobId: jobData.id, jobType: jobData.type },
    'Job processing started',
    'info'
  );

  await db.customLogs.insert(logEntry);

  // Process job...
  
  // Log completion
  const completionLog = client.log.getWithContext(
    { jobId: jobData.id, status: 'completed' },
    'Job completed',
    'info'
  );

  await db.customLogs.insert(completionLog);
}
```

### LoggerChain Methods

#### `withIndexedContext(context: IndexedLoggingContext): LoggerChain`

Adds indexed context fields for fast querying. These fields are stored at the top level of `LogEntry` for efficient database queries.

**Parameters:**

- `context` - Indexed logging context with source, external system, and record information

**Returns:** `LoggerChain` instance for method chaining

**Indexed Fields:**

- `sourceKey` - Source identifier (e.g., datasource key)
- `sourceDisplayName` - Human-readable source name
- `externalSystemKey` - External system identifier
- `externalSystemDisplayName` - Human-readable external system name
- `recordKey` - Record identifier
- `recordDisplayName` - Human-readable record name

**Example:**

```typescript
import { extractLoggingContext } from '@aifabrix/miso-client';

const logContext = extractLoggingContext({
  source: {
    key: 'datasource-1',
    displayName: 'PostgreSQL DB',
    externalSystem: { key: 'system-1', displayName: 'External API' }
  },
  record: { key: 'record-123', displayName: 'User Profile' }
});

await client.log
  .withIndexedContext(logContext)
  .addCorrelation(correlationId)
  .addUser(userId)
  .error('Sync failed');
```

#### `withCredentialContext(credentialId?: string, credentialType?: string): LoggerChain`

Adds credential context for audit logging.

**Parameters:**

- `credentialId` - Optional credential identifier
- `credentialType` - Optional credential type (e.g., 'oauth2', 'api-key')

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
await client.log
  .withCredentialContext('cred-123', 'oauth2')
  .info('API call completed');
```

#### `withRequestMetrics(requestSize?: number, responseSize?: number, durationMs?: number): LoggerChain`

Adds request/response metrics for performance logging.

**Parameters:**

- `requestSize` - Optional request size in bytes
- `responseSize` - Optional response size in bytes
- `durationMs` - Optional request duration in milliseconds

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
const startTime = Date.now();
const response = await fetch('/api/data');
const duration = Date.now() - startTime;

await client.log
  .withRequestMetrics(
    JSON.stringify(requestBody).length,
    JSON.stringify(response).length,
    duration
  )
  .info('Upstream API call completed');
```

#### `withRequest(req: Request): LoggerChain`

Auto-extracts logging context from Express Request. Extracts IP, method, path, user-agent, correlation ID, referer, user from JWT, and request size.

**Parameters:**

- `req` - Express Request object

**Returns:** `LoggerChain` instance for method chaining

**Auto-extracted Fields:**

- `ipAddress` - Client IP (handles proxy headers)
- `method` - HTTP method (GET, POST, etc.)
- `path` - Request path
- `userAgent` - Browser/client user agent
- `correlationId` - From `x-correlation-id` or `x-request-id` headers
- `referer` - Referer header
- `userId` - Extracted from JWT token in Authorization header
- `sessionId` - Extracted from JWT token
- `requestId` - From `x-request-id` header
- `requestSize` - From `content-length` header

**Example:**

```typescript
import { Request } from 'express';

app.post('/api/users', async (req: Request, res) => {
  // Simple: Auto-extracts all request context
  await client.log
    .withRequest(req)
    .info('User created');
  
  // Equivalent to manually extracting:
  // await client.log
  //   .addUser(userId)
  //   .addCorrelation(req.headers['x-correlation-id'])
  //   .info('User created', {
  //     ipAddress: req.ip,
  //     method: req.method,
  //     path: req.path,
  //     userAgent: req.headers['user-agent']
  //   });
});
```

#### `addUser(userId: string): LoggerChain`

Adds user ID to logging context.

**Parameters:**

- `userId` - User identifier

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
await client.log
  .addUser('user-123')
  .info('User action');
```

#### `addCorrelation(correlationId: string): LoggerChain`

Adds correlation ID to logging context.

**Parameters:**

- `correlationId` - Correlation identifier for request tracing

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
await client.log
  .addCorrelation('req-123')
  .info('Request processed');
```

#### `addSession(sessionId: string): LoggerChain`

Adds session ID to logging context.

**Parameters:**

- `sessionId` - Session identifier

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
await client.log
  .addSession('session-123')
  .info('Session activity');
```

#### `withoutMasking(): LoggerChain`

Disables sensitive data masking for this log entry.

**Returns:** `LoggerChain` instance for method chaining

**Example:**

```typescript
await client.log
  .withoutMasking()
  .info('Log entry without data masking');
```

#### `error(message: string, stackTrace?: string): Promise<void>`

Logs an error message with accumulated context.

**Parameters:**

- `message` - Error message
- `stackTrace` - Optional stack trace

**Example:**

```typescript
await client.log
  .withRequest(req)
  .addUser(userId)
  .error('Operation failed', error.stack);
```

#### `info(message: string): Promise<void>`

Logs an info message with accumulated context.

**Parameters:**

- `message` - Info message

**Example:**

```typescript
await client.log
  .withRequest(req)
  .info('Request processed');
```

#### `audit(action: string, resource: string): Promise<void>`

Logs an audit event with accumulated context.

**Parameters:**

- `action` - Action performed
- `resource` - Resource affected

**Example:**

```typescript
await client.log
  .withRequest(req)
  .addUser(userId)
  .audit('user.login', 'authentication');
```

## Encryption Methods

The SDK provides an encryption service accessible via `client.encryption`. This service calls the miso-controller to encrypt/decrypt security parameters using Azure Key Vault (production) or local AES-256-GCM encryption (development).

### `encryption.encrypt(plaintext, parameterName): Promise<EncryptResult>`

Encrypts a plaintext value and stores it as a security parameter.

**Parameters:**

- `plaintext` - The value to encrypt (max 32KB)
- `parameterName` - Name identifier (1-128 chars, alphanumeric with dots, underscores, hyphens)

**Returns:** `Promise<{ value: string, storage: 'keyvault' | 'local' }>`

**Example:**

```typescript
const result = await client.encryption.encrypt('my-api-key', 'external-api-key');
// result.value: 'kv://external-api-key' (Key Vault) or 'enc://v1:base64...' (local)
// result.storage: 'keyvault' or 'local'

// Store result.value in your database (never store plaintext)
await db.settings.update({ apiKeyRef: result.value });
```

### `encryption.decrypt(value, parameterName): Promise<string>`

Decrypts a security parameter reference to plaintext.

**Parameters:**

- `value` - Encrypted reference (`kv://...` or `enc://v1:...`)
- `parameterName` - Name identifier (must match encryption)

**Returns:** `Promise<string>` - Decrypted plaintext value

**Example:**

```typescript
const setting = await db.settings.findOne();
const apiKey = await client.encryption.decrypt(setting.apiKeyRef, 'external-api-key');
// Use apiKey for external API call
```

### Error Handling

```typescript
import { EncryptionError } from '@aifabrix/miso-client';

try {
  await client.encryption.encrypt('secret', 'invalid name!');
} catch (error) {
  if (error instanceof EncryptionError) {
    console.error(`Code: ${error.code}, Parameter: ${error.parameterName}`);
    // Code: INVALID_PARAMETER_NAME, Parameter: invalid name!
  }
}
```

**Error Codes:**

| Code | Description |
|------|-------------|
| `INVALID_PARAMETER_NAME` | Parameter name doesn't match pattern (1-128 chars, alphanumeric, dots, underscores, hyphens) |
| `ENCRYPTION_FAILED` | Controller encryption failed |
| `DECRYPTION_FAILED` | Controller decryption failed |
| `ACCESS_DENIED` | App doesn't have access to parameter |
| `PARAMETER_NOT_FOUND` | Parameter doesn't exist (Key Vault mode) |

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

→ [Event Emission Mode Guide](./configuration.md#event-emission-mode)

**Circuit Breaker for HTTP Logging:**

The `LoggerService` and `AuditLogQueue` implement a circuit breaker pattern to prevent infinite retry loops when the logging service is unavailable. This improves performance and prevents resource exhaustion.

**How it works:**

- After 3 consecutive HTTP logging failures, the circuit breaker opens
- HTTP logging is disabled for 60 seconds (circuit breaker cooldown period)
- After the cooldown period, the circuit breaker resets and logging attempts resume
- Success resets the failure counter immediately

**Benefits:**

- Prevents performance degradation when controller logging endpoint is unavailable
- Reduces network traffic during outages
- Gracefully handles network errors and server unavailability
- Automatic recovery when service becomes available again

**Note:** This is an internal implementation detail. Logging failures are handled silently to avoid disrupting application functionality. For critical logging requirements, consider using event emission mode or implementing your own retry/buffer strategy.

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

> **Note (v4.0.0+):** EncryptionService now uses controller-based encryption. Access via `client.encryption` property.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());

// Encrypt via controller
const result = await client.encryption.encrypt('sensitive-data', 'param-name');
// result.value: 'kv://param-name' (Key Vault) or 'enc://v1:...' (local)
// result.storage: 'keyvault' or 'local'

// Decrypt via controller
const plaintext = await client.encryption.decrypt(result.value, 'param-name');
```

**Methods:**

- `encrypt(plaintext: string, parameterName: string): Promise<EncryptResult>` - Encrypts via controller
- `decrypt(value: string, parameterName: string): Promise<string>` - Decrypts via controller

**See Also:** [Encryption Methods](#encryption-methods) for full API documentation

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

## Examples

### Basic Logging

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

// Basic logging
await client.log.info('Application started');
await client.log.error('Operation failed', { error: 'details' });
await client.log.audit('user.created', 'users', { userId: '123' });
```

### Encryption Usage

```typescript
if (client.encryption) {
  const encrypted = client.encryption.encrypt('sensitive-data');
  const decrypted = client.encryption.decrypt(encrypted);
}
```

### Cache Usage

```typescript
// Store value in cache
await client.cache.set('user:123', { name: 'John', age: 30 }, 600);

// Retrieve from cache
const user = await client.cache.get<{ name: string; age: number }>('user:123');

// Delete from cache
await client.cache.delete('user:123');
```

## See Also

- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [Configuration Guide](./configuration.md) - Configuration options
- [Background Jobs Examples](./examples/background-jobs.md) - Background job logging examples
- [Type Reference](./reference-types.md) - Complete type definitions
