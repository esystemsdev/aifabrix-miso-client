# Event Emission Mode Examples

> **📖 For detailed event emission mode API reference, see [Services Reference - LoggerService](../reference-services.md#loggerservice)**

Practical examples for embedding the SDK directly and receiving logs as events instead of HTTP calls.

**You need to:** Embed the SDK directly and receive logs as events instead of HTTP calls.

**Here's how:** Enable `emitEvents = true` and listen to log events.

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

// Listen to batch events (for audit logs with batching)
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

**What happens:**

- When `emitEvents = true`, logs are emitted as Node.js events
- HTTP/Redis operations are skipped
- Your event listeners save logs directly to your database
- Same payload structure as REST API for consistency

**Configuration:**

```bash
# .env file
MISO_EMIT_EVENTS=true
```

**See Also:**

- [Services Reference](../reference-services.md) - Complete logging API reference
- [Configuration Reference](../configuration.md#event-emission-mode) - Event emission mode configuration
