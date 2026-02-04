# Error Handling Reference

Complete reference for error handling in the MisoClient SDK following RFC 7807 Problem Details for HTTP APIs standard.

## Table of Contents

- [Quick Start](#quick-start)
- [RFC 7807 Compliance](#rfc-7807-compliance)
- [Best Practices](#best-practices)
- [Error Logging Best Practices](#error-logging-best-practices)
- [Accessing Error Details](#accessing-error-details)
- [Common Error Scenarios](#common-error-scenarios)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Security Considerations](#security-considerations)
- [Testing Best Practices](#testing-best-practices)
- [Technical Reference](#technical-reference)
- [Advanced Topics](#advanced-topics)
- [See Also](#see-also)

## Quick Start

> **📖 For practical examples, see [Error Handling Examples](../examples/error-handling.md)**

### Express Route Error Handling (Recommended Pattern)

**✅ BEST PRACTICE: Use `asyncHandler` wrapper, `loggerContextMiddleware`, and `handleRouteError` with unified logging**

```typescript
import express from 'express';
import { Request, Response } from 'express';
import { 
  asyncHandler, 
  AppError, 
  handleRouteError, 
  setErrorLogger,
  loggerContextMiddleware,
  getLogger
} from '@aifabrix/miso-client';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
app.use(express.json());

// Initialize MisoClient once at startup
const client = new MisoClient(loadConfig());
await client.initialize();

// Add logger context middleware early in middleware chain (after auth middleware if needed)
// This automatically extracts context from requests and stores it in AsyncLocalStorage
app.use(loggerContextMiddleware);

// Configure error logger to use unified logging interface
setErrorLogger({
  async logError(message, options) {
    const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
    const stack = (options as { stack?: string })?.stack;
    await logger.error(message, stack ? new Error(stack) : undefined);
  }
});

// Route handler with automatic error handling - no try-catch needed!
app.get(
  '/api/user',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await client.getUser(token);
    res.json({ user });
  }, 'getUser')
);

// Error middleware (register last)
app.use(async (error: Error, req: Request, res: Response, _next: Function) => {
  await handleRouteError(error, req, res);
});

app.listen(3000);
```

**Benefits:**

- ✅ No try-catch boilerplate needed
- ✅ Automatic RFC 7807 error formatting
- ✅ Automatic error logging with full context via unified logging interface
- ✅ Automatic correlation ID extraction (server-generated if not provided)
- ✅ Consistent error responses across all routes
- ✅ All errors logged with IP, method, path, userAgent, correlationId, userId automatically
- ✅ Minimal API: `logger.error(message, error)` - just 2 parameters!

### Basic Error Handling (Non-Express)

**For non-Express contexts, attach business context per log call:**

```typescript
import { MisoClient, loadConfig, MisoClientError } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

try {
  const user = await client.getUser(token);
} catch (error) {
  if (error instanceof MisoClientError) {
    // Access structured error details
    if (error.errorResponse) {
      console.error('Type:', error.errorResponse.type);
      console.error('Title:', error.errorResponse.title);
      console.error('Status:', error.errorResponse.statusCode);
      console.error('Errors:', error.errorResponse.errors);
      console.error('Correlation ID:', error.errorResponse.correlationId);
    }
    
    // Log error with attached context for non-Express flows
    await client.log
      .withContext({ jobId: 'sync-123' })
      .error('User fetch failed', error instanceof Error ? error.stack : undefined);
  }
}
```

## RFC 7807 Compliance

**CRITICAL: All error responses MUST follow RFC 7807 Problem Details for HTTP APIs standard.**

### Error Response Structure

All error responses must include:

```typescript
interface ErrorResponse {
  type: string;              // URI reference (e.g., "/Errors/BadRequest")
  title: string;             // Human-readable summary
  statusCode: number;        // HTTP status code (camelCase in miso-client 1.8.1+)
  detail: string;            // Human-readable explanation
  instance?: string;         // Request URI (optional)
  correlationId?: string;   // Correlation ID for tracing (camelCase in miso-client 1.8.1+)
  errors?: ValidationError[]; // Validation errors (optional)
}
```

### Standard Error Type URIs

- `/Errors/BadRequest` - 400: Invalid request format or parameters
- `/Errors/Unauthorized` - 401: Authentication required
- `/Errors/Forbidden` - 403: Insufficient permissions
- `/Errors/NotFound` - 404: Resource not found
- `/Errors/MethodNotAllowed` - 405: HTTP method not allowed
- `/Errors/Conflict` - 409: Resource conflict (e.g., duplicate)
- `/Errors/UnprocessableEntity` - 422: Validation failed
- `/Errors/TooManyRequests` - 429: Rate limit exceeded
- `/Errors/InternalServerError` - 500: Internal server error
- `/Errors/ServiceUnavailable` - 503: Service temporarily unavailable

### Content-Type Header

**MANDATORY: All error responses MUST set `Content-Type: application/problem+json`**

The `handleRouteError()` utility automatically sets this header.

## Best Practices

### ✅ DO: Use asyncHandler for Route Handlers

**MANDATORY: All route handlers MUST use `asyncHandler()` wrapper.**

```typescript
import { asyncHandler, AppError } from '@aifabrix/miso-client';
import { Request, Response } from 'express';

router.get(
  '/resources/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const resource = await service.getResource(req.params.id);
    if (!resource) {
      throw new AppError('Resource not found', 404);
    }
    res.success(resource);
  }, 'getResource')
);
```

**Benefits:**

- Eliminates try-catch boilerplate
- Automatic error catching and handling
- Consistent error logging
- Operation name tracking for debugging

### ✅ DO: Use AppError for Business Logic Errors

```typescript
import { AppError } from '@aifabrix/miso-client';

// Simple error
if (!resource) {
  throw new AppError('Resource not found', 404);
}

// With validation errors
const errors = validateInput(data);
if (errors.length > 0) {
  throw new AppError('Validation failed', 422, { validationErrors: errors });
}
```

### ✅ DO: Use handleRouteError for Error Middleware

**Configure unified logging interface with `setErrorLogger()`:**

```typescript
import { handleRouteError, setErrorLogger, loggerContextMiddleware, getLogger } from '@aifabrix/miso-client';
import { Request, Response, NextFunction } from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
app.use(express.json());

// Initialize MisoClient once (typically at app startup)
const client = new MisoClient(loadConfig());
await client.initialize();

// Add logger context middleware early in middleware chain
// This automatically extracts context from requests and stores it in AsyncLocalStorage
app.use(loggerContextMiddleware);

// Configure error logger to use unified logging interface
setErrorLogger({
  async logError(message, options) {
    const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
    const stack = (options as { stack?: string })?.stack;
    await logger.error(message, stack ? new Error(stack) : undefined);
  }
});

export const errorHandler = async (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  await handleRouteError(error, req, res);
};
```

The `handleRouteError()` utility automatically:

- Formats errors as RFC 7807 Problem Details
- Logs errors with unified logging interface (via configured error logger)
- Uses `getLogger()` which auto-detects context from AsyncLocalStorage (set by `loggerContextMiddleware`)
- Automatically extracts: IP, method, path, userAgent, correlationId (server-generated if not provided), userId
- Sets `Content-Type: application/problem+json` header
- Maps error types to appropriate status codes

### ✅ DO: Handle External API Errors Properly

```typescript
import { MisoClientError, AppError, getLogger } from '@aifabrix/miso-client';
import { DataClient, MisoClient } from '@aifabrix/miso-client';
import { Request, Response } from 'express';

// In Express route handler (loggerContextMiddleware must be set up)
router.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const client = new MisoClient(loadConfig());
  await client.initialize();
  
  try {
    const dataClient = new DataClient();
    const result = await dataClient.get('/api/endpoint');
    res.success(result);
  } catch (error) {
    if (error instanceof MisoClientError) {
      // Log error with automatic context extraction (from AsyncLocalStorage)
      const logger = getLogger();
      await logger.error('External API call failed', error);
      
      // Use structured error response if available
      if (error.errorResponse) {
        throw new AppError(
          error.errorResponse.title,
          error.errorResponse.statusCode,
          { 
            validationErrors: error.errorResponse.errors,
            correlationId: error.errorResponse.correlationId
          }
        );
      }
      // Fallback for non-structured errors
      throw new AppError(error.message, error.statusCode || 500);
    }
    throw error; // Re-throw to be handled by error middleware
  }
}, 'fetchExternalData'));
```

### ❌ DON'T: Expose Internal Error Details

```typescript
// ❌ WRONG - Never expose stack traces or internal details
res.status(500).json({
  error: error.message,
  stack: error.stack,        // NEVER expose stack traces
  internalCode: error.code,  // NEVER expose internal codes
  databaseQuery: query       // NEVER expose internal queries
});

// ✅ CORRECT - Use handleRouteError which sanitizes errors
await handleRouteError(error, req, res);
```

### ❌ DON'T: Skip Error Logging

```typescript
// ❌ WRONG - Always log errors
catch (error) {
  res.status(500).json({ error: 'Something went wrong' });
  // Missing: error logging
}

// ✅ CORRECT - Use asyncHandler which automatically logs
router.get(
  '/endpoint',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Errors are automatically logged
  })
);
```

### ❌ DON'T: Use Old Error Formats

```typescript
// ❌ WRONG - Don't use old format
res.status(404).json({ success: false, error: 'Not found' });
res.status(500).json({ success: false, message: 'Error' });

// ✅ CORRECT - Use RFC 7807 format
throw new AppError('Resource not found', 404);
// Automatically formatted by handleRouteError
```

## Error Logging Best Practices

### ✅ Good: Comprehensive Error Logging with Unified Logging Interface

**Express routes - use `getLogger()` for automatic context extraction:**

```typescript
import { getLogger, loggerContextMiddleware } from '@aifabrix/miso-client';
import { Request, Response } from 'express';

// Setup (one time, early in middleware chain)
app.use(loggerContextMiddleware);

// Route handler - errors automatically logged by asyncHandler + handleRouteError
app.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await processData(req.body);
  res.json({ success: true });
}, 'processData'));

// Or with manual logging:
app.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    await processData(req.body);
    res.json({ success: true });
  } catch (error) {
    // Log with automatic context extraction (from AsyncLocalStorage)
    const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
    await logger.error('Data processing failed', error);
    
    // Re-throw to be handled by error middleware
    throw error;
  }
}, 'processData'));
```

**What `loggerContextMiddleware` automatically extracts and stores in AsyncLocalStorage:**

- `ipAddress` - Client IP (from server connection, handles proxy headers)
- `method` - HTTP method (GET, POST, etc.) - from server request object
- `path` - Request path - from server request object
- `userAgent` - Browser/client user agent - from request headers
- `correlationId` - Server-generated if not provided (ISO 27001 compliant)
- `requestId` - From common request ID headers if present
- `referer` - From request headers (client-provided, logging only)
- `requestSize` - From `content-length` header when available
- `userId` - Extracted from validated JWT token
- `sessionId` - Extracted from validated JWT token
- `applicationId` - Extracted from validated JWT token

### ✅ Good: Manual Context (Non-Express)

**For background jobs or non-Express contexts, attach context per log call:**

```typescript
// Log with explicit context for non-Express flows
try {
  const result = await client.getUser(token);
} catch (error) {
  await client.log
    .withContext({ jobId: 'job-123' })
    .error('User fetch failed', error instanceof Error ? error.stack : undefined);
}
```

**Or for service layers without Request objects:**

```typescript
import { getLogger } from '@aifabrix/miso-client';

// Context is automatically available if set by middleware or manually
export class UserService {
  async getUser(userId: string) {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      return user;
    } catch (error) {
      const logger = getLogger(); // Auto-detects context if available
      await logger.error('Failed to fetch user', error);
      throw error;
    }
  }
}
```

### Async Context Propagation

`loggerContextMiddleware` stores context in `AsyncLocalStorage`, which flows through normal `await`/Promise chains within a request. Context can be lost if work is detached (timers, background jobs, queue workers) after the request ends. For detached work, use `withContext(...)` per log call or pass the request into `withRequest(req)` before branching.

### ❌ Bad: Minimal Logging (Missing Context)

```typescript
// ❌ Don't do this - missing context setup
// Missing: loggerContextMiddleware setup
app.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    await processData(req.body);
  } catch (error) {
    const logger = getLogger(); // ❌ No context available - middleware not set up!
    await logger.error('Failed');  // ❌ No IP, endpoint, user, correlation ID, etc.
  }
}, 'processData'));

// ✅ CORRECT - Set up middleware first
app.use(loggerContextMiddleware); // Add this early in middleware chain
app.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    await processData(req.body);
  } catch (error) {
    const logger = getLogger(); // ✅ Context automatically available
    await logger.error('Failed', error); // ✅ Auto-extracts all context
  }
}, 'processData'));
```

### Error Logging Checklist

When logging errors, always include:

- ✅ **Request context**: IP address, method, path, user agent
- ✅ **User context**: User ID, session ID (if available)
- ✅ **Correlation ID**: For request tracing
- ✅ **Error details**: Status code, error type, error message
- ✅ **Stack trace**: For debugging (never expose to client)
- ✅ **Operation name**: What operation was being performed
- ✅ **Additional context**: Any relevant business context

## Accessing Error Details

### MisoClientError Structure

All HTTP errors from the SDK are thrown as `MisoClientError`:

```typescript
class MisoClientError extends Error {
  readonly errorResponse?: ErrorResponse;        // Structured error (RFC 7807)
  readonly errorBody?: Record<string, unknown>;  // Raw error body (backward compatibility)
  readonly statusCode?: number;                  // HTTP status code
  readonly message: string;                      // Error message
}
```

### Accessing Structured Errors

```typescript
try {
  await client.validateToken(token);
} catch (error) {
  if (error instanceof MisoClientError) {
    // Structured error response (RFC 7807)
    if (error.errorResponse) {
      console.error('Type:', error.errorResponse.type);        // Error type URI
      console.error('Title:', error.errorResponse.title);     // Human-readable title
      console.error('Detail:', error.errorResponse.detail);   // Detailed message
      console.error('Errors:', error.errorResponse.errors);   // Array of error messages
      console.error('Status:', error.errorResponse.statusCode);
      console.error('Instance:', error.errorResponse.instance);
      console.error('Correlation ID:', error.errorResponse.correlationId);
    }
    // Fallback for non-structured errors
    else if (error.errorBody) {
      console.error('Error body:', error.errorBody);
      console.error('Status:', error.statusCode);
    }
    
    // Error message is always available
    console.error('Message:', error.message);
  }
}
```

### ErrorResponse Interface

```typescript
interface ErrorResponse {
  type: string;              // Error type URI (e.g., "/Errors/BadRequest")
  title: string;             // Human-readable title
  statusCode: number;        // HTTP status code (camelCase in miso-client 1.8.1+)
  detail: string;            // Human-readable explanation
  instance?: string;         // Request instance URI (optional)
  correlationId?: string;    // Correlation ID for tracing (camelCase in miso-client 1.8.1+)
  errors?: string[];         // Array of error messages (optional)
}
```

## Common Error Scenarios

### 1. Redis Connection Failure

**Behavior**: Automatically falls back to controller when Redis is unavailable.

```typescript
try {
  await client.initialize();
} catch (error) {
  // Redis connection errors are logged but don't prevent initialization
  // SDK automatically falls back to direct controller calls
  console.warn('Redis connection failed, using controller fallback');
}
```

### 2. Token Validation Failure

**Behavior**: Returns `false` or `null` instead of throwing for invalid tokens.

```typescript
const isValid = await client.validateToken(token);
if (!isValid) {
  throw new AppError('Invalid or expired token', 401);
}
```

### 3. Network Issues

**Behavior**: Logs warnings and continues with cached data when possible.

**Express routes - use `getLogger()` for automatic context extraction:**

```typescript
import { Request, Response } from 'express';
import { MisoClientError, getLogger } from '@aifabrix/miso-client';

// Setup (one time, early in middleware chain)
app.use(loggerContextMiddleware);

router.get('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await client.get('/api/data');
    res.success(data);
  } catch (error) {
    if (error instanceof MisoClientError && error.statusCode === 503) {
      // Log network issue with automatic context extraction
      const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
      await logger.error('Service unavailable, attempting cache fallback', error);
      
      // Service unavailable - try cached data
      const cachedData = await getCachedData();
      if (cachedData) {
        return res.success(cachedData);
      }
    }
    throw error; // Re-throw to be handled by error middleware
  }
}, 'getData'));
```

### 4. Rate Limiting

**Behavior**: Returns 429 status with retry-after information.

**Express routes - use `getLogger()` for automatic context extraction:**

```typescript
import { Request, Response } from 'express';
import { MisoClientError, AppError, getLogger } from '@aifabrix/miso-client';

// Setup (one time, early in middleware chain)
app.use(loggerContextMiddleware);

router.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    await client.post('/api/data', req.body);
    res.success({ message: 'Data posted successfully' });
  } catch (error) {
    if (error instanceof MisoClientError && error.statusCode === 429) {
      const retryAfter = error.errorResponse?.retryAfter || 60;
      
      // Log rate limit with automatic context extraction
      const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
      await logger.error(`Rate limited. Retry after ${retryAfter} seconds`, error);
      
      // Implement retry logic with exponential backoff
      throw new AppError(`Rate limit exceeded. Retry after ${retryAfter} seconds`, 429);
    }
    throw error; // Re-throw to be handled by error middleware
  }
}, 'postData'));
```

## Error Recovery Strategies

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on client errors (4xx)
      if (error instanceof MisoClientError && error.statusCode && error.statusCode < 500) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}
```

### Fallback to Cached Data

```typescript
async function getDataWithFallback(key: string): Promise<Data> {
  try {
    const data = await client.get(`/api/data/${key}`);
    await cache.set(key, data);
    return data;
  } catch (error) {
    // Try cache on error
    const cachedData = await cache.get(key);
    if (cachedData) {
      console.warn('Using cached data due to API error');
      return cachedData;
    }
    throw error;
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= 5) {
        this.state = 'open';
      }
      
      throw error;
    }
  }
}
```

## Security Considerations

### ✅ DO: Sanitize Error Messages

**Never expose sensitive information in error messages:**

```typescript
// ❌ WRONG - Exposes sensitive information
throw new AppError(`Database query failed: ${query}`, 500);
throw new AppError(`User ${userId} not authorized`, 403);

// ✅ CORRECT - Generic error messages
throw new AppError('Database operation failed', 500);
throw new AppError('Insufficient permissions', 403);
```

### ✅ DO: Log Sensitive Details Securely

**Express routes - use `getLogger()` for automatic context extraction:**

```typescript
import { Request, Response } from 'express';
import { getLogger } from '@aifabrix/miso-client';

// Setup (one time, early in middleware chain)
app.use(loggerContextMiddleware);

// In Express route handler
router.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    await processDatabaseQuery();
  } catch (error) {
    // Log sensitive details securely with automatic context extraction (not exposed to client)
    const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
    await logger.error('Database query failed', error);
    // Context automatically includes: IP, method, path, userAgent, correlationId, userId
    
    throw error; // Re-throw to be handled by error middleware
  }
}, 'processData'));
```

### ✅ DO: Validate Error Responses

```typescript
// Validate error responses before sending
function sanitizeErrorResponse(error: ErrorResponse): ErrorResponse {
  return {
    ...error,
    detail: sanitizeMessage(error.detail),  // Remove sensitive info
    errors: error.errors?.map(msg => sanitizeMessage(msg)),
  };
}
```

### ❌ DON'T: Expose Stack Traces

```typescript
import { Request, Response } from 'express';
import { getLogger, loggerContextMiddleware } from '@aifabrix/miso-client';

// Setup (one time, early in middleware chain)
app.use(loggerContextMiddleware);

// ❌ WRONG - Never expose stack traces to clients
res.status(500).json({
  error: error.message,
  stack: error.stack  // NEVER expose
});

// ✅ CORRECT - Stack traces only in logs (use getLogger() in Express routes)
router.post('/api/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    await processOperation();
  } catch (error) {
    // Log stack trace securely with automatic context extraction
    const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
    await logger.error('Operation failed', error);
    // Context automatically includes: IP, method, path, userAgent, correlationId, userId
    
    // Re-throw to be handled by error middleware (client receives sanitized error)
    throw error;
  }
}, 'processOperation'));
```

## Testing Best Practices

### Unit Testing Error Handling

```typescript
import { MisoClientError, AppError } from '@aifabrix/miso-client';

describe('Error Handling', () => {
  it('should handle MisoClientError with structured response', async () => {
    const mockError = new MisoClientError('Test error', {
      errorResponse: {
        type: '/Errors/BadRequest',
        title: 'Bad Request',
        statusCode: 400,
        detail: 'Invalid input',
        errors: ['Field is required'],
      },
    });
    
    try {
      throw mockError;
    } catch (error) {
      expect(error).toBeInstanceOf(MisoClientError);
      if (error instanceof MisoClientError && error.errorResponse) {
        expect(error.errorResponse.statusCode).toBe(400);
        expect(error.errorResponse.type).toBe('/Errors/BadRequest');
      }
    }
  });
  
  it('should handle AppError correctly', () => {
    const error = new AppError('Resource not found', 404);
    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
  });
});
```

### Integration Testing Error Responses

```typescript
describe('API Error Responses', () => {
  it('should return RFC 7807 format for 404 errors', async () => {
    const response = await request(app)
      .get('/api/resources/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      type: expect.stringContaining('/Errors/NotFound'),
      title: expect.any(String),
      statusCode: 404,
      detail: expect.any(String),
    });
  });
  
  it('should include correlation ID in error response', async () => {
    const correlationId = 'test-correlation-id';
    const response = await request(app)
      .get('/api/resources/nonexistent')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId);
    
    expect(response.body.correlationId).toBe(correlationId);
  });
});
```

### Mocking Errors in Tests

```typescript
import { MisoClientError } from '@aifabrix/miso-client';

// Mock MisoClientError
jest.mock('@aifabrix/miso-client', () => ({
  ...jest.requireActual('@aifabrix/miso-client'),
  MisoClient: jest.fn().mockImplementation(() => ({
    getUser: jest.fn().mockRejectedValue(
      new MisoClientError('User not found', {
        errorResponse: {
          type: '/Errors/NotFound',
          title: 'User Not Found',
          statusCode: 404,
          detail: 'User with provided ID was not found',
        },
      })
    ),
  })),
}));
```

## Technical Reference

### HTTP Status Codes

The SDK handles common HTTP status codes:

- **200**: Success
- **201**: Created
- **204**: No Content
- **400**: Bad Request
- **401**: Unauthorized (invalid token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict
- **422**: Unprocessable Entity (validation failed)
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error
- **503**: Service Unavailable

### Timeout Configuration

Default timeout is 30 seconds for HTTP requests. This can be configured in the HttpClient if needed.

### Backward Compatibility

The SDK maintains full backward compatibility. If a response doesn't match the structured error format, the error is still wrapped in `MisoClientError` with the `errorBody` property:

```typescript
try {
  await client.get('/api/endpoint');
} catch (error) {
  if (error instanceof MisoClientError) {
    // Structured error (new format)
    if (error.errorResponse) {
      console.log('Structured errors:', error.errorResponse.errors);
    }
    // Non-structured error (old format)
    else if (error.errorBody) {
      console.log('Error body:', error.errorBody);
    }
    
    // Status code is always available
    console.log('Status:', error.statusCode);
  }
}
```

### Field Name Compatibility

**IMPORTANT: miso-client 1.8.1+ uses camelCase for all error response fields.**

The `statusCode` field supports both camelCase (`statusCode`) and snake_case (`status_code`) for backward compatibility:

```typescript
// Preferred format (camelCase - miso-client 1.8.1+):
{
  errors: ['Error message'],
  type: '/Errors/Test',
  title: 'Test Error',
  statusCode: 400,  // camelCase
  correlationId: 'corr_123'  // camelCase (changed from requestKey in 1.8.1)
}

// Legacy format (snake_case - still supported):
{
  errors: ['Error message'],
  type: '/Errors/Test',
  title: 'Test Error',
  status_code: 400  // snake_case
}
```

## Advanced Topics

### Snake_case Error Handling (ISO 27001 Compliance)

The SDK provides utilities for handling snake_case error responses for ISO 27001 compliance.

#### ErrorResponseSnakeCase Interface

```typescript
interface ErrorResponseSnakeCase {
  errors: string[];           // Human-readable list of error messages
  type?: string;              // RFC 7807 type URI
  title?: string;             // Short, human-readable title
  status_code: number;        // HTTP status code
  instance?: string;          // URI/path identifying the error instance
  request_key?: string;       // Request correlation key for debugging/audit
}
```

#### ApiErrorException Class

```typescript
class ApiErrorException extends Error {
  status_code: number;
  request_key?: string;
  type?: string;
  instance?: string;
  errors: string[];
}
```

**Example:**

```typescript
import { ApiErrorException } from '@aifabrix/miso-client';

try {
  // Some API call that throws ApiErrorException
} catch (error) {
  if (error instanceof ApiErrorException) {
    console.error('Status code:', error.status_code);
    console.error('Errors:', error.errors);
    console.error('Type:', error.type);
    console.error('Request key:', error.request_key);
  }
}
```

#### `transform_error_to_snake_case(err: unknown): ErrorResponseSnakeCase`

Transforms arbitrary error into standardized snake_case ErrorResponse.

**Example:**

```typescript
import { transform_error_to_snake_case } from '@aifabrix/miso-client';

try {
  // Some operation that might fail
} catch (error) {
  const standardizedError = transform_error_to_snake_case(error);
  console.error('Error status:', standardizedError.status_code);
  console.error('Error messages:', standardizedError.errors);
  console.error('Error type:', standardizedError.type);
}
```

#### `handle_api_error_snake_case(err: unknown): never`

Handles API error and throws snake_case ApiErrorException.

**Example:**

```typescript
import { handle_api_error_snake_case } from '@aifabrix/miso-client';

try {
  // Some API operation
} catch (error) {
  // Transform and throw as ApiErrorException
  handle_api_error_snake_case(error);
}
```

#### Express Middleware with Snake_case

```typescript
import { ApiErrorException, transform_error_to_snake_case } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

// Error handler middleware
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ApiErrorException) {
    return res.status(err.status_code).json({
      error: {
        errors: err.errors,
        type: err.type || 'about:blank',
        title: err.message,
        status_code: err.status_code,
        instance: err.instance,
        request_key: err.request_key
      }
    });
  }
  
  const standardizedError = transform_error_to_snake_case(err);
  res.status(standardizedError.status_code || 500).json({
    error: standardizedError
  });
});
```

### Compatibility Note

The SDK supports both error formats:

- **camelCase** (`ErrorResponse`) - Used with `MisoClientError` class (miso-client 1.8.1+ standard)
- **snake_case** (`ErrorResponseSnakeCase`) - Used with `ApiErrorException` class (ISO 27001 compliance)

Both formats are automatically handled by `transform_error_to_snake_case()` which normalizes errors from various sources into the snake_case format.

### Testing with Mocked Errors

```typescript
import { MisoClientError } from '@aifabrix/miso-client';

// Mock error for testing
const mockError = new MisoClientError('Test error', {
  errorResponse: {
    errors: ['Test error message'],
    type: '/Errors/Test',
    title: 'Test Error',
    statusCode: 400,
    detail: 'Test error detail',
    correlationId: 'test-correlation-id',
  }
});

try {
  throw mockError;
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    console.log('Structured errors:', error.errorResponse.errors);
    console.log('Status:', error.errorResponse.statusCode);
    console.log('Correlation ID:', error.errorResponse.correlationId);
  }
}
```

## Compliance Checklist

When implementing error handling, ensure:

- [ ] All error responses use RFC 7807 format
- [ ] All route handlers use `asyncHandler()` wrapper
- [ ] All custom errors throw `AppError`
- [ ] All errors logged with unified logging interface using `getLogger()` (automatic via handleRouteError when configured)
- [ ] `loggerContextMiddleware` set up early in middleware chain for automatic context extraction
- [ ] Content-Type header set to `application/problem+json` (automatic via handleRouteError)
- [ ] Error type URIs follow standard naming (`/Errors/{ErrorType}`)
- [ ] Correlation IDs included in error responses (automatic via handleRouteError)
- [ ] Appropriate HTTP status codes used
- [ ] No internal error details exposed to clients
- [ ] MisoClientError errors handled and errorResponse extracted
- [ ] Stack traces never exposed to clients (only in logs)
- [ ] Sensitive information sanitized in error messages
- [ ] Tests verify RFC 7807 compliance
- [ ] Error recovery strategies implemented where appropriate

## See Also

- [Type Reference](./reference-types.md) - Complete type definitions including error types
- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [DataClient Reference](./reference-dataclient.md#error-types) - Browser client error types
- [Error Handling Examples](./examples/error-handling.md) - Error handling examples
- [RFC 7807 Specification](https://tools.ietf.org/html/rfc7807) - Problem Details for HTTP APIs

---

**Last Updated**: 2026-01-09  
**Version**: 2.0  
**Applies To**: All error handling in MisoClient SDK and applications using it
