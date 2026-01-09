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

## Examples

### Background Jobs with Logging

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

interface Job {
  id: string;
  type: string;
  userId: string;
  data: any;
}

class JobProcessor {
  async processJob(job: Job) {
    try {
      await client.log.info('Job started', {
        jobId: job.id,
        jobType: job.type,
        userId: job.userId
      });

      await this.performJob(job);

      await client.log.info('Job completed', {
        jobId: job.id,
        jobType: job.type,
        userId: job.userId
      });
    } catch (error) {
      await client.log.error('Job failed', {
        jobId: job.id,
        jobType: job.type,
        userId: job.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async performJob(job: Job) {
    // Job-specific logic here
  }
}
```

### Event Emission Mode

```typescript
import { MisoClient, loadConfig, LogEntry } from '@aifabrix/miso-client';
import { db } from './database';

const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true
});

await client.initialize();

// Listen to log events
client.log.on('log', async (logEntry: LogEntry) => {
  try {
    // Save directly to database without HTTP
    await db.logs.insert({
      timestamp: logEntry.timestamp,
      level: logEntry.level,
      message: logEntry.message,
      context: logEntry.context,
      userId: logEntry.userId,
      correlationId: logEntry.correlationId,
      requestId: logEntry.requestId,
      sessionId: logEntry.sessionId
    });
  } catch (error) {
    console.error('Failed to save log:', error);
  }
});

// Listen to batch events (for batched audit logs)
client.log.on('log:batch', async (logEntries: LogEntry[]) => {
  try {
    await db.logs.insertMany(
      logEntries.map(entry => ({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        context: entry.context,
        userId: entry.userId,
        correlationId: entry.correlationId,
        requestId: entry.requestId,
        sessionId: entry.sessionId
      }))
    );
  } catch (error) {
    console.error('Failed to save batch logs:', error);
  }
});

// Use logger normally - events will be emitted
await client.log.info('Application started');
await client.log.error('Operation failed', { error: 'details' });
await client.log.audit('user.created', 'users', { userId: '123' });
```

### Encryption Usage

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient({
  ...loadConfig(),
  encryptionKey: process.env.ENCRYPTION_KEY
});
await client.initialize();

if (client.encryption) {
  // Encrypt sensitive data
  const encrypted = client.encryption.encrypt('sensitive-data');
  console.log('Encrypted:', encrypted);

  // Decrypt data
  const decrypted = client.encryption.decrypt(encrypted);
  console.log('Decrypted:', decrypted);
}
```

### Cache Usage

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

// Store value in cache
await client.cache.set('user:123', { name: 'John', age: 30 }, 600); // 10 minutes

// Retrieve from cache
const user = await client.cache.get<{ name: string; age: number }>('user:123');
if (user) {
  console.log('Cached user:', user);
}

// Delete from cache
await client.cache.delete('user:123');

// Clear all cache
await client.cache.clear();
```

## See Also

- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [Configuration Guide](./configuration.md) - Configuration options including event emission mode
- [Examples Guide](./examples.md) - Framework-specific examples including background jobs and event emission mode
- [Type Reference](./reference-types.md) - Complete type definitions
- **Example Files:**
  - [Logging Example](../examples/step-5-logging.ts) - Basic logging usage
  - [Audit Example](../examples/step-6-audit.ts) - Audit trail implementation
  - [Encryption & Cache Example](../examples/step-7-encryption-cache.ts) - Encryption and caching usage
  - [Event Emission Mode Example](../examples/event-emission-mode.example.ts) - Event emission mode setup
