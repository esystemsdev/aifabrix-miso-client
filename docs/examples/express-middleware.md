# Express.js Middleware Examples

> **📖 For detailed authentication API reference, see [Authentication Reference](../reference-authentication.md)**

Practical examples for using the AI Fabrix Miso Client SDK with Express.js middleware.

## Basic Authentication Middleware

**You need to:** Protect Express routes with authentication middleware.

**Here's how:** Create middleware that validates tokens and attaches user info to requests.

```typescript
import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient(loadConfig());
await client.initialize();

export async function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const token = client.getToken(req);

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const isValid = await client.validateToken(token);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await client.getUser(token);
    req.user = user;
    next();
  } catch (error) {
    // Use fluent API with request context (auto-extracts IP, method, path, etc.)
    await client.log
      .withRequest(req)
      .error('Authentication middleware error', error instanceof Error ? error.stack : undefined);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Usage
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Hello authenticated user!', user: req.user });
});
```

**What happens:**

1. Middleware extracts token from request headers
2. Validates token with controller
3. Fetches user info and attaches to request
4. Calls next() to continue request processing

## Role-Based Authorization Middleware

> **📖 For detailed authorization API reference, see [Authorization Reference](../reference-authorization.md)**

**You need to:** Protect routes based on user roles or permissions.

**Here's how:** Create reusable middleware functions for role and permission checks.

```typescript
export function requireRole(role: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const token = client.getToken(req);
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const hasRole = await client.hasRole(token, role);
      if (!hasRole) {
        await client.log
          .withRequest(req)
          .audit('access.denied', 'authorization', {
            requiredRole: role
          });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      await client.log.error('Role check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        role,
        userId: req.user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requirePermission(permission: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const token = client.getToken(req);
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const hasPermission = await client.hasPermission(token, permission);
      if (!hasPermission) {
        await client.log
          .withRequest(req)
          .audit('access.denied', 'authorization', {
            requiredPermission: permission
          });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      await client.log.error('Permission check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        permission,
        userId: req.user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Usage
app.get('/admin', authMiddleware, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin panel' });
});

app.delete('/posts/:id', authMiddleware, requirePermission('delete:posts'), (req, res) => {
  res.json({ message: 'Post deleted' });
});
```

## Factory Function Pattern for Route Handlers

**You need to:** Create route handlers that have access to MisoClient instance for logging and error handling.

**Here's how:** Use factory functions that accept `misoClient` and return route handlers wrapped with `asyncHandler()`.

**✅ BEST PRACTICE: Factory functions allow dependency injection of MisoClient while maintaining clean route definitions.**

```typescript
import { Request, Response } from 'express';
import { MisoClient, asyncHandler, AppError, handleRouteError, setErrorLogger } from '@aifabrix/miso-client';

// Initialize MisoClient once at app startup
let misoClient: MisoClient | null = null;

// Configure error logger after MisoClient initialization
misoClient.initialize()
  .then(async () => {
    setErrorLogger({
      async logError(message, options) {
        const req = (options as { req?: Request })?.req;
        if (req && misoClient) {
          // Use forRequest() for automatic context extraction
          await misoClient.log
            .forRequest(req)
            .error(message, (options as { stack?: string })?.stack);
        } else if (misoClient) {
          // Fallback for non-Express contexts
          await misoClient.log.error(message, options as Record<string, unknown>);
        }
      }
    });
  });

// Factory function pattern: Accept misoClient, return route handler
export function getUsers(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Log using MisoClient logger if available
    if (misoClient) {
      await misoClient.log.forRequest(req).info('Fetching users list');
    }
    
    const users = await fetchUsers();
    res.json({ users, count: users.length });
  }, 'getUsers'); // Operation name for error tracking
}

export function getUserById(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await findUserById(id);

    if (!user) {
      // Log warning before throwing error
      if (misoClient) {
        await misoClient.log
          .forRequest(req)
          .addContext('level', 'warning')
          .info(`User not found: ${id}`);
      }
      // Throw AppError - asyncHandler will format as RFC 7807
      throw new AppError('User not found', 404);
    }

    if (misoClient) {
      await misoClient.log.forRequest(req).info(`Fetching user: ${id}`);
    }

    res.json({ user });
  }, 'getUserById');
}

export function createUser(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body;

    if (!name || !email) {
      if (misoClient) {
        await misoClient.log.forRequest(req).info('Create user failed: Name and email are required');
      }
      throw new AppError('Name and email are required', 400);
    }

    const newUser = await createUserInDatabase({ name, email });

    if (misoClient) {
      await misoClient.log.forRequest(req).info(`User created: ${newUser.id}`);
    }

    res.status(201).json({ user: newUser });
  }, 'createUser');
}

// Register routes with factory functions
app.get('/api/users', getUsers(misoClient));
app.get('/api/users/:id', getUserById(misoClient));
app.post('/api/users', createUser(misoClient));

// Error middleware (must be registered last)
app.use(async (error: Error | unknown, req: Request, res: Response, _next: Function): Promise<void> => {
  await handleRouteError(error, req, res);
});
```

**Key Benefits:**

1. **Dependency Injection**: MisoClient is injected at route registration time, not hardcoded
2. **Automatic Error Handling**: `asyncHandler()` wraps all route handlers for consistent error handling
3. **RFC 7807 Compliance**: All errors automatically formatted as RFC 7807 Problem Details
4. **Automatic Logging**: Request context (IP, method, path, userAgent, correlationId, userId) automatically extracted
5. **Operation Tracking**: Operation names help track errors in logs
6. **No Try-Catch Boilerplate**: `asyncHandler()` eliminates need for manual try-catch blocks

**Pattern Structure:**

```typescript
// 1. Factory function accepts misoClient
export function routeHandler(misoClient: MisoClient | null) {
  // 2. Return asyncHandler-wrapped route handler
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // 3. Use misoClient for logging (check if null)
    if (misoClient) {
      await misoClient.log.forRequest(req).info('Operation message');
    }
    
    // 4. Business logic here
    // ...
    
    // 5. Throw AppError for business logic errors
    if (!resource) {
      throw new AppError('Resource not found', 404);
    }
    
    res.json({ data });
  }, 'operationName'); // 6. Operation name for error tracking
}
```

**Error Handling:**

- All errors thrown in route handlers are automatically caught by `asyncHandler()`
- Errors are formatted as RFC 7807 Problem Details via `handleRouteError()`
- Errors are logged with full context via configured error logger
- Correlation IDs are automatically extracted and included in error responses

**Logging Best Practices:**

```typescript
// ✅ Good: Use forRequest() for automatic context extraction
if (misoClient) {
  await misoClient.log.forRequest(req).info('Operation completed');
}

// ✅ Good: Add additional context
if (misoClient) {
  await misoClient.log
    .forRequest(req)
    .addContext('userId', userId)
    .addContext('action', 'update')
    .info('User updated');
}

// ✅ Good: Log warnings before throwing errors
if (misoClient) {
  await misoClient.log
    .forRequest(req)
    .addContext('level', 'warning')
    .info(`Resource not found: ${id}`);
}
throw new AppError('Resource not found', 404);
```

## Error Logger Configuration

**You need to:** Configure error logging to use MisoClient logger with automatic request context extraction.

**Here's how:** Use `setErrorLogger()` after MisoClient initialization to configure error logging.

```typescript
import { MisoClient, loadConfig, setErrorLogger } from '@aifabrix/miso-client';
import { Request } from 'express';

// Initialize MisoClient once at app startup
const misoClient = new MisoClient(loadConfig());

misoClient.initialize()
  .then(async () => {
    // Configure error logger to use MisoClient logger with forRequest()
    setErrorLogger({
      async logError(message, options) {
        const req = (options as { req?: Request })?.req;
        if (req && misoClient) {
          // Use forRequest() for automatic context extraction
          await misoClient.log
            .forRequest(req)
            .error(message, (options as { stack?: string })?.stack);
        } else if (misoClient) {
          // Fallback for non-Express contexts
          await misoClient.log.error(message, options as Record<string, unknown>);
        } else {
          // Final fallback to console if MisoClient not available
          console.error('[ERROR]', message);
          if ((options as { stack?: string })?.stack) {
            console.error('[ERROR] Stack:', (options as { stack?: string }).stack);
          }
        }
      }
    });
  });
```

**Benefits:**

- Automatic request context extraction (IP, method, path, correlationId, userId)
- RFC 7807 compliant error logging
- Graceful fallback when MisoClient unavailable
- ISO 27001 compliant audit logging

## MisoClient Fallback Behavior

**You need to:** Handle scenarios where MisoClient is not initialized or unavailable.

**Here's how:** Use conditional checks and graceful fallbacks in route handlers.

**Pattern:**

```typescript
export function getUsers(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Conditional logging - works with or without MisoClient
    if (misoClient) {
      await misoClient.log.forRequest(req).info('Fetching users list');
    }
    
    // Business logic continues regardless of MisoClient availability
    const users = await fetchUsers();
    res.json({ users, count: users.length });
  }, 'getUsers');
}
```

**Fallback Levels:**

1. **Route Handlers**: Check `if (misoClient)` before logging
2. **Error Logger**: Multiple fallback levels (MisoClient → console)
3. **Server Startup**: Server starts immediately, MisoClient initializes asynchronously

**Benefits:**

- Server starts even if MisoClient initialization fails
- Routes continue to function without MisoClient
- Logging is optional, not required
- Graceful degradation for development/testing

**See Also:**

- [Error Handling Reference](../reference-errors.md) - Complete error handling guide
- [Express Utilities Reference](../reference-utilities.md) - Express utility functions
