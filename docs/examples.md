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

```typescript
import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();

// Load configuration from .env file
const client = new MisoClient(loadConfig());

await client.initialize();

// Simple authentication middleware
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

### Role-Based Authorization Middleware

```typescript
// Simple role-based authorization middleware
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

// Simple permission-based authorization middleware
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

// Usage examples
app.get('/admin', authMiddleware, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin panel' });
});

app.delete('/posts/:id', authMiddleware, requirePermission('delete:posts'), (req, res) => {
  res.json({ message: 'Post deleted' });
});
```

### Complete Express.js Application

```typescript
import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
app.use(express.json());

const client = new MisoClient(loadConfig());

await client.initialize();

// Middleware
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const user = await client.getUser(token);
      req.user = user;
    } catch (error) {
      // Token might be invalid, continue without user
    }
  }
  next();
});

// Routes
app.get('/posts', async (req, res) => {
  try {
    await client.log.info('Posts accessed', {
      userId: req.user?.id,
      ip: req.ip
    });
    res.json({ posts: [] });
  } catch (error) {
    await client.log.error('Failed to fetch posts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/posts', authMiddleware, requirePermission('create:posts'), async (req, res) => {
  try {
    await client.log.audit('post.created', 'posts', {
      userId: req.user?.id,
      postTitle: req.body.title
    });
    res.json({ message: 'Post created' });
  } catch (error) {
    await client.log.error('Failed to create post', { error: error.message });
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## React Authentication

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

        // Check for existing token in localStorage
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
      const response = await client.login({ redirect: window.location.href });
      // Redirect to login URL
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
          <Route path="/posts" element={
            <ProtectedRoute requiredPermission="edit:posts">
              <PostEditor />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

## Next.js API Routes

### API Route with Authentication

```typescript
// pages/api/posts.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

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

### Middleware for Next.js

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());

await client.initialize();

export async function middleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  // Skip authentication for public routes
  if (request.nextUrl.pathname.startsWith('/api/public')) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  try {
    const isValid = await client.validateToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = await client.getUser(token);

    // Add user to headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user?.id || '');
    requestHeaders.set('x-user-roles', JSON.stringify(user?.roles || []));

    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  } catch (error) {
    await client.log.error('Middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: request.nextUrl.pathname
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  matcher: '/api/:path*'
};
```

## NestJS Guards

### Authentication Guard

```typescript
// auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

@Injectable()
export class AuthGuard implements CanActivate {
  private client: MisoClient;

  constructor() {
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
```

### Usage in Controller

```typescript
// posts.controller.ts
import { Controller, Get, Post, UseGuards, SetMetadata, Request } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { RoleGuard } from './role.guard';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  private readonly client: MisoClient;

  constructor(private readonly postsService: PostsService) {
    this.client = new MisoClient(loadConfig());
    this.client.initialize();
  }

  @Get()
  async findAll(@Request() req) {
    await this.client.log.info('Posts accessed', { userId: req.user.id });
    return this.postsService.findAll();
  }

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

```typescript
// miso-plugin.ts
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

interface MisoPluginOptions {
  controllerUrl: string;
  clientId: string;
  clientSecret: string;
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
}

const misoPlugin: FastifyPluginAsync<MisoPluginOptions> = async (fastify, options) => {
  const client = new MisoClient(options);
  await client.initialize();

  // Decorate fastify instance
  fastify.decorate('miso', client);

  // Add authentication hook
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

  // Add logging hook
  fastify.addHook('onResponse', async (request: FastifyRequest, reply) => {
    await client.log.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      userId: request.user?.id
    });
  });
};

// Usage in main file
import Fastify from 'fastify';

const fastify = Fastify();

await fastify.register(misoPlugin, {
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!
});

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

### Job Processing with Authentication

```typescript
// job-processor.ts
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

      // Simulate job processing
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
    switch (job.type) {
      case 'email':
        await this.sendEmail(job.data);
        break;
      case 'report':
        await this.generateReport(job.data);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private async sendEmail(data: any) {
    // Email sending logic
  }

  private async generateReport(data: any) {
    // Report generation logic
  }
}

// Usage
const processor = new JobProcessor();

// Process jobs from queue
setInterval(async () => {
  const jobs = await getJobsFromQueue(); // Your queue implementation
  for (const job of jobs) {
    await processor.processJob(job);
  }
}, 5000);
```

## Error Handling

### Comprehensive Error Handling

```typescript
import { MisoClient, loadConfig, MisoClientError } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());

await client.initialize();

class ErrorHandler {
  async handleAuthError(error: any, context: any) {
    await client.log.error('Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      context
    });

    // Determine appropriate response
    if (error.message.includes('token')) {
      return { status: 401, message: 'Invalid token' };
    }

    if (error.message.includes('permission')) {
      return { status: 403, message: 'Insufficient permissions' };
    }

    return { status: 500, message: 'Internal server error' };
  }

  async handleBusinessError(error: any, context: any) {
    await client.log.error('Business logic error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context
    });

    return { status: 400, message: 'Bad request' };
  }

  async handleSystemError(error: any, context: any) {
    await client.log.error('System error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      context
    });

    return { status: 500, message: 'Internal server error' };
  }
}

// Usage in Express route
app.post('/api/data', async (req, res) => {
  const errorHandler = new ErrorHandler();

  try {
    const token = client.getToken(req);

    if (!token) {
      const response = await errorHandler.handleAuthError(new Error('No token provided'), {
        path: req.path,
        method: req.method
      });
      return res.status(response.status).json({ error: response.message });
    }

    const isValid = await client.validateToken(token);
    if (!isValid) {
      const response = await errorHandler.handleAuthError(new Error('Invalid token'), {
        path: req.path,
        method: req.method
      });
      return res.status(response.status).json({ error: response.message });
    }

    // Business logic here
    const result = await processData(req.body);
    res.json(result);
  } catch (error) {
    let response;

    if (error instanceof AuthError) {
      response = await errorHandler.handleAuthError(error, { path: req.path });
    } else if (error instanceof BusinessError) {
      response = await errorHandler.handleBusinessError(error, { path: req.path });
    } else {
      response = await errorHandler.handleSystemError(error, { path: req.path });
    }

    res.status(response.status).json({ error: response.message });
  }
});
```

### Handling Structured Errors

The SDK provides structured error responses following RFC 7807. Here's how to handle them:

#### Basic Structured Error Handling

```typescript
import { MisoClient, MisoClientError } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

try {
  const token = 'your-token';
  const user = await client.getUser(token);
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    // Structured error response available
    console.error('Error Type:', error.errorResponse.type);
    console.error('Error Title:', error.errorResponse.title);
    console.error('Error Messages:', error.errorResponse.errors);
    console.error('Status Code:', error.errorResponse.statusCode);
    console.error('Instance URI:', error.errorResponse.instance);
    
    // Error message is automatically set from title or first error
    console.error('Message:', error.message);
  } else if (error instanceof MisoClientError) {
    // Fallback for non-structured errors (backward compatibility)
    console.error('Error Body:', error.errorBody);
    console.error('Status Code:', error.statusCode);
  }
}
```

#### Express Route with Structured Error Handling

```typescript
import express from 'express';
import { MisoClient, MisoClientError } from '@aifabrix/miso-client';

const app = express();
const client = new MisoClient(loadConfig());
await client.initialize();

app.get('/api/user', async (req, res) => {
  try {
    const token = client.getToken(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await client.getUser(token);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    if (error instanceof MisoClientError) {
      // Check for structured error response
      if (error.errorResponse) {
        // Use structured error details
        return res.status(error.errorResponse.statusCode).json({
          error: error.errorResponse.title,
          errors: error.errorResponse.errors,
          type: error.errorResponse.type,
          instance: error.errorResponse.instance
        });
      } else {
        // Fallback to status code and error body
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
          error: error.message,
          details: error.errorBody
        });
      }
    }

    // Unknown error
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Error Handler Utility with Structured Errors

```typescript
import { MisoClientError, ErrorResponse } from '@aifabrix/miso-client';

class StructuredErrorHandler {
  handleError(error: unknown, defaultMessage: string = 'An error occurred') {
    if (error instanceof MisoClientError) {
      // Structured error response
      if (error.errorResponse) {
        return {
          statusCode: error.errorResponse.statusCode,
          message: error.errorResponse.title,
          errors: error.errorResponse.errors,
          type: error.errorResponse.type,
          instance: error.errorResponse.instance
        };
      }
      
      // Non-structured error (backward compatibility)
      return {
        statusCode: error.statusCode || 500,
        message: error.message || defaultMessage,
        errors: error.errorBody ? [String(error.errorBody)] : [defaultMessage]
      };
    }

    // Generic error
    return {
      statusCode: 500,
      message: error instanceof Error ? error.message : defaultMessage,
      errors: [error instanceof Error ? error.message : defaultMessage]
    };
  }
}

// Usage
const errorHandler = new StructuredErrorHandler();

app.post('/api/data', async (req, res) => {
  try {
    const result = await processRequest(req);
    res.json(result);
  } catch (error) {
    const errorResponse = errorHandler.handleError(error);
    res.status(errorResponse.statusCode).json({
      error: errorResponse.message,
      errors: errorResponse.errors,
      ...(errorResponse.type && { type: errorResponse.type }),
      ...(errorResponse.instance && { instance: errorResponse.instance })
    });
  }
});
```

#### Logging Structured Errors

```typescript
import { MisoClient, MisoClientError } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

async function processWithErrorLogging<T>(
  operation: () => Promise<T>,
  context: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Log structured error details
    if (error instanceof MisoClientError) {
      const logContext = {
        ...context,
        errorMessage: error.message,
        statusCode: error.statusCode
      };

      // Add structured error details if available
      if (error.errorResponse) {
        logContext.errorType = error.errorResponse.type;
        logContext.errorTitle = error.errorResponse.title;
        logContext.errors = error.errorResponse.errors;
        logContext.instance = error.errorResponse.instance;
      } else if (error.errorBody) {
        logContext.errorBody = error.errorBody;
      }

      await client.log.error('Operation failed', logContext);
    } else {
      // Generic error logging
      await client.log.error('Operation failed', {
        ...context,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    throw error;
  }
}

// Usage
await processWithErrorLogging(
  async () => await client.validateToken(token),
  { operation: 'validateToken', userId: 'user-123' }
);
```

## Testing

### Unit Tests with Mocks

```typescript
// miso-client.test.ts
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Mock the HTTP client
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
    getRoles: jest.fn().mockResolvedValue(['user', 'admin']),
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

  it('should get user information', async () => {
    const user = await client.getUser('valid-token');
    expect(user).toEqual({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user', 'admin']
    });
  });

  it('should check user roles', async () => {
    const hasAdminRole = await client.hasRole('valid-token', 'admin');
    expect(hasAdminRole).toBe(true);
  });
});
```

### Integration Tests

```typescript
// integration.test.ts
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

describe('MisoClient Integration', () => {
  let client: MisoClient;

  beforeAll(async () => {
    client = new MisoClient({
      controllerUrl: process.env.TEST_MISO_CONTROLLER_URL!,
      clientId: process.env.TEST_MISO_CLIENTID!,
      clientSecret: process.env.TEST_MISO_CLIENTSECRET!
    });
    await client.initialize();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should connect to Redis', () => {
    expect(client.isRedisConnected()).toBe(true);
  });

  it('should handle invalid tokens gracefully', async () => {
    const isValid = await client.validateToken('invalid-token');
    expect(isValid).toBe(false);
  });

  it('should log events successfully', async () => {
    await expect(client.log.info('Test message')).resolves.not.toThrow();
  });
});
```

## Pagination

### Parse Pagination Params from Query String

```typescript
import { parsePaginationParams } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse pagination from query string: ?page=2&page_size=25
  const { currentPage, pageSize } = parsePaginationParams(req.query);
  
  console.log(`Page: ${currentPage}, Size: ${pageSize}`);
  // Output: Page: 2, Size: 25
  
  // Use in your database query or API call
  // const offset = (currentPage - 1) * pageSize;
});
```

### Create Paginated Response

```typescript
import { createPaginatedListResponse } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', async (req, res) => {
  // Parse pagination params
  const { currentPage, pageSize } = parsePaginationParams(req.query);
  
  // Fetch data (example)
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
  // Returns: {
  //   meta: {
  //     totalItems: 120,
  //     currentPage: 2,
  //     pageSize: 25,
  //     type: 'application'
  //   },
  //   data: [...]
  // }
});
```

### Apply Pagination to Array (for Mocks/Tests)

```typescript
import { applyPaginationToArray, createPaginatedListResponse } from '@aifabrix/miso-client';

// Mock data for testing
const mockApplications = [
  { id: 1, name: 'App 1', status: 'active' },
  { id: 2, name: 'App 2', status: 'active' },
  { id: 3, name: 'App 3', status: 'inactive' },
  // ... 47 more items
];

// Apply pagination
const page1 = applyPaginationToArray(mockApplications, 1, 25);
// Returns: first 25 items

const page2 = applyPaginationToArray(mockApplications, 2, 25);
// Returns: items 26-50

// Create full paginated response for testing
const response = createPaginatedListResponse(
  page1,
  mockApplications.length,
  1,
  25,
  'application'
);
```

## Filtering

### Using FilterBuilder for Dynamic Filtering

```typescript
import { FilterBuilder, buildQueryString } from '@aifabrix/miso-client';

// Build filters dynamically based on user input
function buildFilters(status?: string, region?: string, dateFrom?: string) {
  const filterBuilder = new FilterBuilder();
  
  if (status) {
    filterBuilder.add('status', 'eq', status);
  }
  
  if (region) {
    filterBuilder.add('region', 'in', [region]);
  }
  
  if (dateFrom) {
    filterBuilder.add('created_at', 'gte', dateFrom);
  }
  
  return filterBuilder;
}

// Usage in Express route
app.get('/api/applications', (req, res) => {
  const { status, region, dateFrom } = req.query;
  
  const filterBuilder = buildFilters(
    status as string,
    region as string,
    dateFrom as string
  );
  
  const queryString = filterBuilder.toQueryString();
  // Returns: "filter=status:eq:active&filter=region:in:eu&filter=created_at:gte:2024-01-01"
  
  // Use queryString in API call
  const url = `/api/applications?${queryString}`;
});
```

### Parse Filter Params from Query String

```typescript
import { parseFilterParams } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse filters from query string: ?filter=status:eq:active&filter=region:in:eu,us
  const filters = parseFilterParams(req.query);
  
  // Returns: [
  //   { field: 'status', op: 'eq', value: 'active' },
  //   { field: 'region', op: 'in', value: ['eu', 'us'] }
  // ]
  
  // Use filters in your database query
  filters.forEach(filter => {
    console.log(`${filter.field} ${filter.op} ${filter.value}`);
  });
});
```

### Build Query String from FilterQuery

```typescript
import { FilterBuilder, buildQueryString } from '@aifabrix/miso-client';

// Build complete query with filters, sort, pagination
const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('region', 'in', ['eu', 'us']);

const queryString = buildQueryString({
  filters: filterBuilder.build(),
  sort: ['-updated_at', 'name'],
  page: 1,
  pageSize: 25
});

// Returns: "filter=status:eq:active&filter=region:in:eu,us&sort=-updated_at&sort=name&page=1&page_size=25"

// Use in API call
const url = `/api/applications?${queryString}`;
```

### Apply Filters Locally (for Mocks/Tests)

```typescript
import { applyFilters, FilterBuilder } from '@aifabrix/miso-client';

// Mock data
const mockApplications = [
  { id: 1, status: 'active', region: 'eu' },
  { id: 2, status: 'active', region: 'us' },
  { id: 3, status: 'inactive', region: 'eu' },
];

// Build filters
const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('region', 'eq', 'eu');

// Apply filters locally
const filtered = applyFilters(mockApplications, filterBuilder.build());
// Returns: [{ id: 1, status: 'active', region: 'eu' }]
```

### Combined Filter + Pagination + Sort

```typescript
import {
  FilterBuilder,
  buildQueryString,
  parsePaginationParams,
  parseFilterParams,
  parseSortParams,
  buildSortString
} from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse all query params
  const { currentPage, pageSize } = parsePaginationParams(req.query);
  const filters = parseFilterParams(req.query);
  const sortOptions = parseSortParams(req.query);
  
  // Build complete query
  const filterBuilder = new FilterBuilder();
  filters.forEach(filter => {
    filterBuilder.add(filter.field, filter.op, filter.value);
  });
  
  const sortStrings = buildSortString(sortOptions);
  
  const queryString = buildQueryString({
    filters: filterBuilder.build(),
    sort: sortStrings,
    page: currentPage,
    pageSize: pageSize
  });
  
  // Use queryString in API call or database query
  const url = `/api/applications?${queryString}`;
  
  // ... fetch and return data
});
```

## Sorting

### Parse Sort Params from Query String

```typescript
import { parseSortParams } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse sort from query string: ?sort=-updated_at&sort=name
  const sortOptions = parseSortParams(req.query);
  
  // Returns: [
  //   { field: 'updated_at', order: 'desc' },
  //   { field: 'name', order: 'asc' }
  // ]
  
  // Use in your database query
  sortOptions.forEach(sort => {
    console.log(`Sort by ${sort.field} ${sort.order}`);
  });
});
```

### Build Sort String from SortOption[]

```typescript
import { buildSortString } from '@aifabrix/miso-client';

// Convert SortOption[] to query string format
const sortOptions = [
  { field: 'updated_at', order: 'desc' },
  { field: 'name', order: 'asc' }
];

const sortStrings = buildSortString(sortOptions);
// Returns: ['-updated_at', 'name']

// Use in query string
const queryString = `sort=${sortStrings.join('&sort=')}`;
// Returns: "sort=-updated_at&sort=name"
```

### Dynamic Sorting in API Route

```typescript
import { parseSortParams, buildSortString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse sort params with defaults
  const defaultSort = [{ field: 'created_at', order: 'desc' as const }];
  const sortOptions = req.query.sort 
    ? parseSortParams(req.query)
    : defaultSort;
  
  // Convert to query string format for API call
  const sortStrings = buildSortString(sortOptions);
  
  // Use in API call
  const url = `/api/applications?sort=${sortStrings.join('&sort=')}`;
  
  // ... fetch and return data
});
```

## Snake_case Error Handling

### Using ApiErrorException

```typescript
import { ApiErrorException, ErrorResponseSnakeCase } from '@aifabrix/miso-client';

async function fetchApplication(id: string) {
  try {
    // Some API call that might throw ApiErrorException
    const response = await fetch(`/api/applications/${id}`);
    
    if (!response.ok) {
      const errorData: ErrorResponseSnakeCase = await response.json();
      throw new ApiErrorException(errorData);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ApiErrorException) {
      console.error('Status code:', error.status_code);
      console.error('Errors:', error.errors);
      console.error('Type:', error.type);
      console.error('Request key:', error.request_key);
      
      // Handle specific error codes
      if (error.status_code === 404) {
        throw new Error('Application not found');
      }
      
      throw error;
    }
    throw error;
  }
}
```

### Using transform_error_to_snake_case

```typescript
import { transform_error_to_snake_case } from '@aifabrix/miso-client';
import axios from 'axios';

async function callApi(url: string) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    // Transform any error to standardized snake_case format
    const standardizedError = transform_error_to_snake_case(error);
    
    console.error('Error status:', standardizedError.status_code);
    console.error('Error messages:', standardizedError.errors);
    console.error('Error type:', standardizedError.type);
    console.error('Instance:', standardizedError.instance);
    
    // Handle based on status code
    if (standardizedError.status_code === 401) {
      // Redirect to login
    } else if (standardizedError.status_code === 403) {
      // Show forbidden message
    }
    
    throw standardizedError;
  }
}
```

### Using handle_api_error_snake_case

```typescript
import { handle_api_error_snake_case } from '@aifabrix/miso-client';
import axios from 'axios';

async function callApi(url: string) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    // Transform and throw as ApiErrorException
    handle_api_error_snake_case(error);
    // This will never return (throws ApiErrorException)
  }
}
```

### Express Error Handler with Snake_case Errors

```typescript
import { ApiErrorException, transform_error_to_snake_case } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

// Error handler middleware
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ApiErrorException) {
    // Already a snake_case ApiErrorException
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
  
  // Transform other errors to snake_case format
  const standardizedError = transform_error_to_snake_case(err);
  
  res.status(standardizedError.status_code || 500).json({
    error: standardizedError
  });
});
```

### ErrorResponseSnakeCase Type Usage

```typescript
import { ErrorResponseSnakeCase, ErrorEnvelope } from '@aifabrix/miso-client';

// Handle envelope format errors
async function handleErrorResponse(response: Response) {
  const envelope: ErrorEnvelope = await response.json();
  const error: ErrorResponseSnakeCase = envelope.error;
  
  console.error('Error status:', error.status_code);
  console.error('Error messages:', error.errors);
  console.error('Error type:', error.type);
  console.error('Request key:', error.request_key);
  
  // Use error for logging or user feedback
  return error;
}
```

## Event Emission Mode

### Using Event Emission Mode in Your Application

When embedding the SDK directly in your own application, enable `emitEvents = true` to receive logs as Node.js events instead of HTTP calls. This eliminates HTTP overhead and allows saving logs directly to the database.

```typescript
import { MisoClient, loadConfig, LogEntry } from '@aifabrix/miso-client';
import { db } from './database';

// Create client with emitEvents enabled
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
    // Batch insert to database
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

### Complete Setup for Direct SDK Embedding

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
client.log.on('log', async (logEntry: LogEntry) => {
  try {
    await db.logs.insert({
      timestamp: logEntry.timestamp,
      level: logEntry.level,
      message: logEntry.message,
      context: logEntry.context,
      userId: logEntry.userId,
      correlationId: logEntry.correlationId,
      requestId: logEntry.requestId,
      sessionId: logEntry.sessionId,
      stackTrace: logEntry.stackTrace,
      environment: logEntry.environment,
      application: logEntry.application,
      applicationId: logEntry.applicationId
    });
  } catch (error) {
    console.error('Failed to save log:', error);
  }
});

// Batch event handler
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
        sessionId: entry.sessionId,
        stackTrace: entry.stackTrace,
        environment: entry.environment,
        application: entry.application,
        applicationId: entry.applicationId
      }))
    );
  } catch (error) {
    console.error('Failed to save batch logs:', error);
  }
});
```

**Configuration:**

```bash
# .env file
MISO_EMIT_EVENTS=true
```

**Benefits:**

- Zero HTTP overhead when embedding the SDK directly in your application
- Single codebase - use the same logger in both client and controller
- Direct database saves without HTTP round-trips
- Same payload structure as REST API for consistency

→ [Event Emission Mode Guide](configuration.md#event-emission-mode)  
→ [Event Emission Mode Example](../examples/event-emission-mode.example.ts)

---

These examples demonstrate various ways to integrate the AI Fabrix Miso Client SDK into different frameworks and scenarios. Each example includes proper error handling, logging, and authentication patterns.
