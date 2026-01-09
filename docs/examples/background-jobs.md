# Background Jobs Examples

> **📖 For detailed logging API reference, see [Services Reference - Logging Methods](../reference-services.md#logging-methods)**

Practical examples for using the AI Fabrix Miso Client SDK in background job processing.

## Logging with Request Context (Express)

**You need to:** Log requests with automatic context extraction from Express Request.

**Here's how:** Use `withRequest()` method to auto-extract IP, method, path, user-agent, correlation ID, and user from JWT.

```typescript
import { Request } from 'express';

app.get('/api/users', async (req: Request, res) => {
  // Simple: Auto-extracts all request context
  await client.log
    .withRequest(req)
    .info('Users list accessed');
  
  // Automatically includes: IP, method, path, userAgent, correlationId, userId
  const users = await fetchUsers();
  res.json(users);
});
```

**What gets extracted:**

- `ipAddress` - Client IP (handles proxy headers)
- `method` - HTTP method (GET, POST, etc.)
- `path` - Request path
- `userAgent` - Browser/client user agent
- `correlationId` - From `x-correlation-id` or `x-request-id` headers
- `userId` - Extracted from JWT token in Authorization header
- `sessionId` - Extracted from JWT token
- `referer` - Referer header
- `requestSize` - From `content-length` header

## Audit Logging with Request Context

**You need to:** Log audit events with automatic context extraction from Express Request.

**Here's how:** Use `withRequest()` method with `audit()` to auto-extract request context for audit logs.

```typescript
import { Request } from 'express';

app.post('/api/posts', async (req: Request, res) => {
  // Audit log with request context - auto-extracts IP, method, path, userAgent, correlationId, userId
  await client.log
    .withRequest(req)
    .audit('post.created', 'posts', {
      postTitle: req.body.title
    });
  
  // Or combine with other chain methods
  await client.log
    .withRequest(req)
    .addUser(userId)
    .audit('user.login', 'authentication');
  
  res.status(201).json({ message: 'Post created' });
});
```

**Benefits:**

- Automatically captures all request context (IP, method, path, userAgent, correlationId, userId)
- No need to manually extract and pass context fields
- Consistent audit logging across your application
- Works seamlessly with other chain methods like `addUser()`, `addCorrelation()`, etc.

## Logging with Indexed Context

**You need to:** Add indexed context fields for fast database queries and observability.

**Here's how:** Use `extractLoggingContext()` and `withIndexedContext()` for structured logging.

```typescript
import { extractLoggingContext } from '@aifabrix/miso-client';

// Extract indexed context from source and record objects
const logContext = extractLoggingContext({
  source: {
    key: 'datasource-1',
    displayName: 'PostgreSQL DB',
    externalSystem: { key: 'system-1', displayName: 'External API' }
  },
  record: { key: 'record-123', displayName: 'User Profile' }
});

// Use in logging
await client.log
  .withIndexedContext(logContext)
  .addCorrelation(correlationId)
  .addUser(userId)
  .error('Sync failed');
```

**Indexed fields enable fast queries:**

- `sourceKey` - Source identifier (e.g., datasource key)
- `sourceDisplayName` - Human-readable source name
- `externalSystemKey` - External system identifier
- `externalSystemDisplayName` - Human-readable external system name
- `recordKey` - Record identifier
- `recordDisplayName` - Human-readable record name

## Logging with Credential Context

**You need to:** Add credential context for audit logging.

**Here's how:** Use `withCredentialContext()` method.

```typescript
await client.log
  .withCredentialContext('cred-123', 'oauth2')
  .info('API call completed');
```

## Logging with Request Metrics

**You need to:** Add request/response metrics for performance logging.

**Here's how:** Use `withRequestMetrics()` method.

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

## Background Job Processing

**You need to:** Add logging and authentication context to background job processing.

**Here's how:** Use MisoClient logging in job processors.

```typescript
// job-processor.ts
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
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

**See Also:**

- [Services Reference](../reference-services.md) - Complete logging API reference
