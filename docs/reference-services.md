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

