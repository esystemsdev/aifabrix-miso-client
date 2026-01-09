# Error Handling Examples

> **📖 For detailed error handling API reference, see [Error Handling Reference](../reference-errors.md)**

Practical examples showing how to set up error handling with minimal code using miso-client utilities.

**Key Benefits:**
- ✅ No try-catch boilerplate needed
- ✅ Automatic RFC 7807 error formatting
- ✅ Automatic error logging with full context
- ✅ One-time setup, works everywhere

## Quick Start: Complete Express App Setup

Here's the absolute minimum setup needed for error handling in an Express app:

```typescript
import express from 'express';
import { 
  MisoClient, 
  loadConfig, 
  asyncHandler, 
  AppError, 
  handleRouteError, 
  setErrorLogger 
} from '@aifabrix/miso-client';
import { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Initialize MisoClient once at startup
let misoClient: MisoClient | null = null;

(async () => {
  try {
    const config = loadConfig();
    misoClient = new MisoClient(config);
    await misoClient.initialize();
    
    // Configure error logger to use MisoClient logger
    setErrorLogger({
      async logError(message, options) {
        const req = (options as { req?: Request })?.req;
        if (req && misoClient) {
          // Automatic context extraction: IP, method, path, userAgent, correlationId, userId
          await misoClient.log
            .forRequest(req)
            .error(message, (options as { stack?: string })?.stack);
        } else if (misoClient) {
          // Fallback for non-Express contexts
          await misoClient.log.error(message, options as Record<string, unknown>);
        }
      }
    });
    
    console.log('✅ Error handling configured');
  } catch (error) {
    console.error('⚠️ MisoClient initialization failed, using fallback error handling');
  }
})();

// Routes - No try-catch needed!
app.get('/api/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = await getUserById(id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  res.json({ user });
}, 'getUserById'));

// Error middleware (register last)
app.use(async (error: Error, req: Request, res: Response, _next: Function) => {
  await handleRouteError(error, req, res);
});

app.listen(3000);
```

**That's it!** All errors are automatically:
- Caught and formatted as RFC 7807 Problem Details
- Logged with full request context (IP, method, path, userAgent, correlationId, userId)
- Sent with proper `Content-Type: application/problem+json` header

## Route Handlers: Using asyncHandler (No Try-Catch!)

The `asyncHandler()` wrapper eliminates all try-catch boilerplate:

```typescript
import { asyncHandler, AppError } from '@aifabrix/miso-client';
import { Request, Response } from 'express';

// ✅ GOOD: No try-catch needed
app.get('/api/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  res.json({ user });
}, 'getUserById'));

// ❌ BAD: Don't do this - unnecessary try-catch
app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Benefits:**
- Errors automatically caught and handled
- RFC 7807 compliant responses
- Automatic error logging
- Operation name tracking for debugging

## Business Logic Errors: Using AppError

Throw `AppError` for business logic errors - it's automatically formatted:

```typescript
import { asyncHandler, AppError } from '@aifabrix/miso-client';
import { Request, Response } from 'express';

// Simple error
app.get('/api/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  res.json({ user });
}, 'getUserById'));

// Validation errors
app.post('/api/users', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email } = req.body;
  
  const validationErrors = [];
  if (!name) validationErrors.push({ field: 'name', message: 'Name is required' });
  if (!email) validationErrors.push({ field: 'email', message: 'Email is required' });
  if (email && !email.includes('@')) {
    validationErrors.push({ field: 'email', message: 'Invalid email format' });
  }
  
  if (validationErrors.length > 0) {
    throw new AppError('Validation failed', 422, true, validationErrors);
  }
  
  const user = await createUser({ name, email });
  res.status(201).json({ user });
}, 'createUser'));

// With custom error type and correlation ID
app.delete('/api/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    throw new AppError(
      'User not found',
      404,
      true,
      undefined,
      '/Errors/NotFound',
      req.originalUrl,
      req.headers['x-correlation-id'] as string
    );
  }
  
  await deleteUser(user.id);
  res.status(204).send();
}, 'deleteUser'));
```

**AppError automatically:**
- Maps status codes to error type URIs (`/Errors/NotFound`, `/Errors/BadRequest`, etc.)
- Formats as RFC 7807 Problem Details
- Includes validation errors if provided
- Preserves correlation IDs

## SDK Errors: Handling MisoClientError

When calling MisoClient methods, errors are thrown as `MisoClientError`:

```typescript
import { asyncHandler, AppError, MisoClientError } from '@aifabrix/miso-client';
import { Request, Response } from 'express';

app.get('/api/user', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new AppError('Authorization token required', 401);
  }
  
  try {
    const user = await misoClient.getUser(token);
    res.json({ user });
  } catch (error) {
    // Handle MisoClientError from SDK
    if (error instanceof MisoClientError) {
      // Use structured error response if available
      if (error.errorResponse) {
        throw new AppError(
          error.errorResponse.title,
          error.errorResponse.statusCode,
          true,
          error.errorResponse.errors?.map(e => ({ field: '', message: e })),
          error.errorResponse.type,
          error.errorResponse.instance,
          error.errorResponse.correlationId
        );
      }
      // Fallback for non-structured errors
      throw new AppError(error.message, error.statusCode || 500);
    }
    // Re-throw other errors to be handled by error middleware
    throw error;
  }
}, 'getUser'));
```

**Or simplify by letting asyncHandler handle it:**

```typescript
// Even simpler - let asyncHandler handle MisoClientError automatically
app.get('/api/user', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new AppError('Authorization token required', 401);
  }
  
  // MisoClientError is automatically caught and formatted by asyncHandler
  const user = await misoClient.getUser(token);
  res.json({ user });
}, 'getUser'));
```

## Error Logger Setup: Configuring with MisoClient

Configure error logging once at app startup:

```typescript
import { MisoClient, loadConfig, setErrorLogger } from '@aifabrix/miso-client';
import { Request } from 'express';

// Initialize MisoClient
const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// Configure error logger
setErrorLogger({
  async logError(message, options) {
    const req = (options as { req?: Request })?.req;
    
    if (req && misoClient) {
      // Automatic context extraction via forRequest()
      // Extracts: IP, method, path, userAgent, correlationId, userId, sessionId
      await misoClient.log
        .forRequest(req)
        .error(message, (options as { stack?: string })?.stack);
    } else if (misoClient) {
      // Fallback for non-Express contexts
      await misoClient.log.error(message, options as Record<string, unknown>);
    } else {
      // Final fallback to console
      console.error('[ERROR]', message);
      if ((options as { stack?: string })?.stack) {
        console.error('[ERROR] Stack:', (options as { stack?: string }).stack);
      }
    }
  }
});
```

**What `forRequest(req)` automatically extracts:**
- `ipAddress` - Client IP (handles proxy headers)
- `method` - HTTP method (GET, POST, etc.)
- `path` - Request path
- `userAgent` - Browser/client user agent
- `correlationId` - From `x-correlation-id` header
- `userId` - Extracted from JWT token in `Authorization` header
- `sessionId` - Extracted from JWT token

## Complete Example: Full Express App

Here's a complete Express app with error handling:

```typescript
import express from 'express';
import { 
  MisoClient, 
  loadConfig, 
  asyncHandler, 
  AppError, 
  handleRouteError, 
  setErrorLogger 
} from '@aifabrix/miso-client';
import { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Initialize MisoClient
let misoClient: MisoClient | null = null;

(async () => {
  try {
    const config = loadConfig();
    misoClient = new MisoClient(config);
    await misoClient.initialize();
    
    // Configure error logger
    setErrorLogger({
      async logError(message, options) {
        const req = (options as { req?: Request })?.req;
        if (req && misoClient) {
          await misoClient.log
            .forRequest(req)
            .error(message, (options as { stack?: string })?.stack);
        } else if (misoClient) {
          await misoClient.log.error(message, options as Record<string, unknown>);
        }
      }
    });
    
    console.log('✅ MisoClient initialized');
  } catch (error) {
    console.error('⚠️ MisoClient initialization failed:', error);
  }
})();

// Helper function to get user (simulated)
async function getUserById(id: string) {
  // Simulate database lookup
  if (id === '1') {
    return { id: '1', name: 'John Doe', email: 'john@example.com' };
  }
  return null;
}

// Routes with error handling
app.get('/api/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  
  if (misoClient) {
    await misoClient.log.forRequest(req).info(`Fetching user: ${id}`);
  }
  
  const user = await getUserById(id);
  
  if (!user) {
    if (misoClient) {
      await misoClient.log.forRequest(req).addContext('level', 'warning').info(`User not found: ${id}`);
    }
    throw new AppError('User not found', 404);
  }
  
  res.json({ user });
}, 'getUserById'));

app.post('/api/users', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email } = req.body;
  
  // Validation
  const validationErrors = [];
  if (!name) validationErrors.push({ field: 'name', message: 'Name is required' });
  if (!email) validationErrors.push({ field: 'email', message: 'Email is required' });
  
  if (validationErrors.length > 0) {
    throw new AppError('Validation failed', 422, true, validationErrors);
  }
  
  // Create user logic here...
  const user = { id: '2', name, email };
  
  if (misoClient) {
    await misoClient.log.forRequest(req).info(`User created: ${user.id}`);
  }
  
  res.status(201).json({ user });
}, 'createUser'));

// 404 handler
app.use((req: Request, res: Response) => {
  throw new AppError('Route not found', 404);
});

// Error middleware (must be last)
app.use(async (error: Error, req: Request, res: Response, _next: Function) => {
  await handleRouteError(error, req, res);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Factory Function Pattern

For better dependency injection and testability:

```typescript
import { Request, Response } from 'express';
import { MisoClient, asyncHandler, AppError } from '@aifabrix/miso-client';

// Factory function: Accept misoClient, return route handler
export function getUserById(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    if (misoClient) {
      await misoClient.log.forRequest(req).info(`Fetching user: ${id}`);
    }
    
    const user = await getUserByIdFromDB(id);
    
    if (!user) {
      if (misoClient) {
        await misoClient.log.forRequest(req).addContext('level', 'warning').info(`User not found: ${id}`);
      }
      throw new AppError('User not found', 404);
    }
    
    res.json({ user });
  }, 'getUserById');
}

// Register route
app.get('/api/users/:id', getUserById(misoClient));
```

**Benefits:**
- Dependency injection (MisoClient passed at registration)
- Easy to test (can pass null or mock)
- Reusable route handlers
- No try-catch boilerplate

## Error Response Format

All errors are automatically formatted as RFC 7807 Problem Details:

```json
{
  "type": "/Errors/NotFound",
  "title": "Not Found",
  "statusCode": 404,
  "detail": "User not found",
  "instance": "/api/users/999",
  "correlationId": "req-123-456",
  "errors": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

**Headers:**
- `Content-Type: application/problem+json`
- `X-Correlation-ID: req-123-456` (if provided)

## Summary

**Minimal Setup:**
1. Initialize MisoClient once
2. Configure `setErrorLogger()` with MisoClient logger
3. Wrap routes with `asyncHandler()`
4. Throw `AppError` for business logic errors
5. Register error middleware with `handleRouteError()`

**No Extra Code Needed:**
- ❌ No try-catch blocks
- ❌ No manual error formatting
- ❌ No manual error logging
- ❌ No manual correlation ID handling

**See Also:**
- [Error Handling Reference](../reference-errors.md) - Complete error handling guide
- [Express Middleware Examples](./express-middleware.md) - More Express patterns
