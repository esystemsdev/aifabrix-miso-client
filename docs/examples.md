# Examples

Practical examples demonstrating how to use the AI Fabrix Miso Client SDK in various scenarios.

## Table of Contents

- [Express.js Middleware](#expressjs-middleware)
- [React Authentication](#react-authentication)
- [Next.js API Routes](#nextjs-api-routes)
- [NestJS Guards](#nestjs-guards)
- [Fastify Plugin](#fastify-plugin)
- [Background Jobs](#background-jobs)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Pagination](#pagination)
- [Filtering](#filtering)
- [Sorting](#sorting)
- [Snake_case Error Handling](#snake_case-error-handling)
- [Event Emission Mode](#event-emission-mode)

## Express.js Middleware

### Basic Authentication Middleware

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
    await client.log.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method
    });
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

### Role-Based Authorization Middleware

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
        await client.log.audit('access.denied', 'authorization', {
          userId: req.user?.id,
          requiredRole: role,
          path: req.path
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
        await client.log.audit('access.denied', 'authorization', {
          userId: req.user?.id,
          requiredPermission: permission,
          path: req.path
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

## React Authentication

**You need to:** Add authentication to your React application with context and protected routes.

**Here's how:** Create an authentication context and protected route component.

### Authentication Context

```typescript
// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { MisoClient, loadConfig, UserInfo } from '@aifabrix/miso-client';

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [client] = useState(() => new MisoClient(loadConfig()));

  useEffect(() => {
    const initAuth = async () => {
      try {
        await client.initialize();

        const token = localStorage.getItem('auth_token');
        if (token) {
          const isValid = await client.validateToken(token);
          if (isValid) {
            const userInfo = await client.getUser(token);
            setUser(userInfo);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('auth_token');
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [client]);

  const login = async () => {
    try {
      const response = await client.login({ redirect: 'https://myapp.com/dashboard' });
      window.location.href = response.data.loginUrl;
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await client.logout({ token });
        await client.log.audit('user.logout', 'authentication', {
          userId: user?.id,
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false;
  };

  const hasPermission = async (permission: string): Promise<boolean> => {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    try {
      return await client.hasPermission(token, permission);
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      hasRole,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Protected Route Component

```typescript
// ProtectedRoute.tsx
import React from 'react';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallback = <div>Access Denied</div>
}: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, hasPermission } = useAuth();
  const [hasRequiredPermission, setHasRequiredPermission] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (requiredPermission) {
      hasPermission(requiredPermission).then(setHasRequiredPermission);
    } else {
      setHasRequiredPermission(true);
    }
  }, [requiredPermission, hasPermission]);

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback}</>;
  }

  if (requiredPermission && hasRequiredPermission === false) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminPanel />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

## Next.js API Routes

**You need to:** Add authentication to Next.js API routes.

**Here's how:** Validate tokens and check permissions in API route handlers.

```typescript
// pages/api/posts.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient(loadConfig());
await client.initialize();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    switch (req.method) {
      case 'GET':
        await client.log.info('Posts fetched', { userId: user?.id });
        return res.status(200).json({ posts: [] });

      case 'POST':
        const canCreate = await client.hasPermission(token, 'create:posts');
        if (!canCreate) {
          await client.log.audit('access.denied', 'posts', {
            userId: user?.id,
            action: 'create'
          });
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        await client.log.audit('post.created', 'posts', {
          userId: user?.id,
          postTitle: req.body.title
        });
        return res.status(201).json({ message: 'Post created' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    await client.log.error('API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      method: req.method,
      path: req.url
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

## NestJS Guards

**You need to:** Create authentication and authorization guards for NestJS.

**Here's how:** Implement guards that validate tokens and check roles/permissions.

### Authentication Guard

```typescript
// auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

@Injectable()
export class AuthGuard implements CanActivate {
  private client: MisoClient;

  constructor() {
    // ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
    this.client = new MisoClient(loadConfig());
    this.client.initialize();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const isValid = await this.client.validateToken(token);
      if (!isValid) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.client.getUser(token);
      request.user = user;
      return true;
    } catch (error) {
      await this.client.log.error('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: request.url
      });
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
```

### Role Guard

```typescript
// role.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

@Injectable()
export class RoleGuard implements CanActivate {
  private client: MisoClient;

  constructor(private reflector: Reflector) {
    this.client = new MisoClient(loadConfig());
    this.client.initialize();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new ForbiddenException('No token provided');
    }

    try {
      const hasAnyRole = await this.client.hasAnyRole(token, requiredRoles);
      if (!hasAnyRole) {
        await this.client.log.audit('access.denied', 'authorization', {
          userId: request.user?.id,
          requiredRoles,
          path: request.url
        });
        throw new ForbiddenException('Insufficient permissions');
      }

      return true;
    } catch (error) {
      await this.client.log.error('Role check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requiredRoles,
        userId: request.user?.id
      });
      throw new ForbiddenException('Role check failed');
    }
  }
}

// Usage in Controller
@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  @Post()
  @UseGuards(RoleGuard)
  @SetMetadata('roles', ['admin', 'editor'])
  async create(@Request() req, @Body() createPostDto: CreatePostDto) {
    await this.client.log.audit('post.created', 'posts', {
      userId: req.user.id,
      postTitle: createPostDto.title
    });
    return this.postsService.create(createPostDto);
  }
}
```

## Fastify Plugin

**You need to:** Add authentication to Fastify applications.

**Here's how:** Create a Fastify plugin that decorates the instance with MisoClient.

```typescript
// miso-plugin.ts
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const misoPlugin: FastifyPluginAsync = async (fastify) => {
  // ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
  const client = new MisoClient(loadConfig());
  await client.initialize();

  fastify.decorate('miso', client);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const isValid = await client.validateToken(token);
        if (isValid) {
          const user = await client.getUser(token);
          request.user = user;
        }
      } catch (error) {
        // Token might be invalid, continue without user
      }
    }
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply) => {
    await client.log.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      userId: request.user?.id
    });
  });
};

// Usage
import Fastify from 'fastify';
const fastify = Fastify();
await fastify.register(misoPlugin);

fastify.get('/posts', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  const canRead = await fastify.miso.hasPermission(token, 'read:posts');
  if (!canRead) {
    return reply.status(403).send({ error: 'Insufficient permissions' });
  }

  return { posts: [] };
});
```

## Background Jobs

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

## Error Handling

**You need to:** Handle SDK errors gracefully with structured error responses.

**Here's how:** Use MisoClientError to access structured error details.

### Basic Error Handling

```typescript
import { MisoClient, loadConfig, MisoClientError } from '@aifabrix/miso-client';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient(loadConfig());
await client.initialize();

try {
  const user = await client.getUser(token);
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    console.error('Error Type:', error.errorResponse.type);
    console.error('Error Title:', error.errorResponse.title);
    console.error('Error Messages:', error.errorResponse.errors);
    console.error('Status Code:', error.errorResponse.statusCode);
  } else if (error instanceof MisoClientError) {
    console.error('Error Body:', error.errorBody);
    console.error('Status Code:', error.statusCode);
  }
}
```

### Express Error Handler

```typescript
import express from 'express';
import { MisoClientError } from '@aifabrix/miso-client';

app.get('/api/user', async (req, res) => {
  try {
    const user = await client.getUser(token);
    res.json(user);
  } catch (error) {
    if (error instanceof MisoClientError) {
      if (error.errorResponse) {
        return res.status(error.errorResponse.statusCode).json({
          error: error.errorResponse.title,
          errors: error.errorResponse.errors,
          type: error.errorResponse.type,
          instance: error.errorResponse.instance
        });
      } else {
        return res.status(error.statusCode || 500).json({
          error: error.message,
          details: error.errorBody
        });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**What happens:**

- SDK automatically parses RFC 7807 structured error responses
- Provides detailed error information including type, title, and specific error messages
- Falls back to legacy error format for backward compatibility

## Testing

**You need to:** Test your application with mocked MisoClient.

**Here's how:** Mock the SDK methods in your tests.

### Unit Tests with Mocks

```typescript
// miso-client.test.ts
import { MisoClient } from '@aifabrix/miso-client';

jest.mock('@aifabrix/miso-client', () => ({
  MisoClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    validateToken: jest.fn().mockResolvedValue(true),
    getUser: jest.fn().mockResolvedValue({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user', 'admin']
    }),
    hasRole: jest.fn().mockResolvedValue(true),
    hasPermission: jest.fn().mockResolvedValue(true),
    log: {
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      audit: jest.fn().mockResolvedValue(undefined)
    }
  }))
}));

describe('MisoClient', () => {
  let client: MisoClient;

  beforeEach(() => {
    client = new MisoClient({
      controllerUrl: 'https://test.controller.com',
      clientId: 'ctrl-test-app',
      clientSecret: 'test-secret'
    });
  });

  it('should validate token', async () => {
    const isValid = await client.validateToken('valid-token');
    expect(isValid).toBe(true);
  });
});
```

## Pagination

**You need to:** Parse pagination parameters and create paginated responses.

**Here's how:** Use pagination utilities from the SDK.

### Parse and Use Pagination

```typescript
import { parsePaginationParams, createPaginatedListResponse } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', async (req, res) => {
  // Parse pagination from query string: ?page=2&page_size=25
  const { currentPage, pageSize } = parsePaginationParams(req.query);
  
  // Fetch data
  const allItems = await fetchAllApplications();
  const totalItems = allItems.length;
  const pageItems = allItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  // Create paginated response
  const response = createPaginatedListResponse(
    pageItems,
    totalItems,
    currentPage,
    pageSize,
    'application'
  );
  
  res.json(response);
  // Returns: { meta: { totalItems, currentPage, pageSize, type }, data: [...] }
});
```

## Filtering

**You need to:** Build and parse filter queries for dynamic filtering.

**Here's how:** Use FilterBuilder to construct filters and parse them from query strings.

```typescript
import { FilterBuilder, parseFilterParams, buildQueryString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse filters from query string: ?filter=status:eq:active&filter=region:in:eu,us
  const filters = parseFilterParams(req.query);
  
  // Build complete query with filters, sort, pagination
  const filterBuilder = new FilterBuilder();
  filters.forEach(filter => {
    filterBuilder.add(filter.field, filter.op, filter.value);
  });
  
  const queryString = buildQueryString({
    filters: filterBuilder.build(),
    sort: ['-updated_at', 'name'],
    page: 1,
    pageSize: 25
  });
  
  // Use queryString in API call
  const url = `/api/applications?${queryString}`;
});
```

## Sorting

**You need to:** Parse and build sort parameters.

**Here's how:** Use sort utilities to handle query string sorting.

```typescript
import { parseSortParams, buildSortString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse sort from query string: ?sort=-updated_at&sort=name
  const sortOptions = parseSortParams(req.query);
  // Returns: [{ field: 'updated_at', order: 'desc' }, { field: 'name', order: 'asc' }]
  
  // Convert to query string format
  const sortStrings = buildSortString(sortOptions);
  // Returns: ['-updated_at', 'name']
  
  // Use in API call
  const url = `/api/applications?sort=${sortStrings.join('&sort=')}`;
});
```

## Snake_case Error Handling

**You need to:** Handle errors in snake_case format for API compatibility.

**Here's how:** Use snake_case error utilities.

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

## Event Emission Mode

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

→ [Event Emission Mode Guide](configuration.md#event-emission-mode)  
→ [Event Emission Mode Example](../examples/event-emission-mode.example.ts)
