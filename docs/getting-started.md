# Getting Started Guide

Complete guide to getting started with the AI Fabrix Miso Client SDK. This document expands on the [README Quick Start](../README.md) with detailed steps and explanations.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step-by-Step Activation](#step-by-step-activation)
- [Complete Configuration](#complete-configuration)
- [Common Patterns](#common-patterns)
- [Next Steps](#next-steps)

## Prerequisites

Before starting, ensure you have:

- **Node.js**: Version 18.0.0 or higher
- **NPM**: Version 9.0.0 or higher
- **AI Fabrix Builder**: [Install guide](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/QUICK-START.md)
- **Docker Desktop**: For running Keycloak and Redis

---

## Step-by-Step Activation

### Step 1: Set Up Your Environment

The Miso Client SDK requires two infrastructure components:

1. **Keycloak** - For user authentication and token generation
2. **AI Fabrix Miso Controller** - For role management, permissions, and logging

#### Install Infrastructure

If you haven't already, install the AI Fabrix Builder:

```bash
npm install -g @aifabrix/builder
```

#### Start Core Services

```bash
# Start PostgreSQL and Redis
aifabrix up
```

**First time?** This downloads Docker images and takes 2-3 minutes.

**What starts:**
- PostgreSQL at `localhost:5432`
- Redis at `localhost:6379`

#### Install Keycloak

```bash
# Create Keycloak app
aifabrix create keycloak --port 8082 --database --template platform

# Build Keycloak
aifabrix build keycloak

# Run Keycloak
aifabrix run keycloak
```

**Access Keycloak:** http://localhost:8082  
**Admin login:** admin / admin123

#### Install Miso Controller

```bash
# Create controller
aifabrix create miso-controller --port 3000 --database --redis --template platform

# Build controller
aifabrix build miso-controller

# Run controller
aifabrix run miso-controller
```

**Access Controller:** http://localhost:3000

→ [Complete Infrastructure Guide](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/INFRASTRUCTURE.md)

---

### Step 2: Install Miso Client

```bash
npm install @aifabrix/miso-client
```

**What you get:**
- TypeScript/JavaScript client library
- Type definitions included
- Works in Node.js and browser environments
- Full TypeScript support

**Alternative package managers:**

```bash
# Yarn
yarn add @aifabrix/miso-client

# PNPM
pnpm add @aifabrix-miso-client
```

---

### Step 3: Activate Authentication

Authentication validates user tokens from Keycloak.

#### Basic Setup

```typescript
import { MisoClient } from '@aifabrix/miso-client';

// Create client instance
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
});

// Initialize (connects to Redis if configured)
await client.initialize();
```

#### Validate User Token

```typescript
async function authenticateUser(req, res, next) {
  // Extract token from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Validate token with controller
  const isValid = await client.validateToken(token);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Get user information
  const user = await client.getUser(token);
  
  // Attach user to request
  req.user = user;
  next();
}
```

**What happens:**
1. SDK sends token to Miso Controller
2. Controller validates with Keycloak
3. Returns user info if valid
4. Uses Redis cache for repeated lookups

**User information includes:**
- `id` - User GUID
- `username` - Username
- `email` - Email address
- `firstName` - First name
- `lastName` - Last name
- `roles` - Array of role names

→ [Complete Authentication Example](../examples/step-3-authentication.ts)

---

### Step 4: Activate RBAC (Role-Based Access Control)

RBAC checks user roles to control access to features.

#### Add Redis for Caching

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
  redis: {
    host: 'localhost',
    port: 6379,
    // password: 'optional-password',
  },
});
```

**Why Redis?** Roles are cached for 15 minutes (configurable), making repeated checks fast.

#### Check User Roles

```typescript
// Get all roles for a user
const roles = await client.getRoles(token);
console.log('User roles:', roles); // ['user', 'admin', 'editor']

// Check for specific role
const isAdmin = await client.hasRole(token, 'admin');
if (isAdmin) {
  // Show admin features
}

// Check for any of multiple roles
const canManage = await client.hasAnyRole(token, ['admin', 'manager', 'editor']);
if (canManage) {
  // Show management features
}
```

#### Example: Role-Based Middleware

```typescript
function requireRole(role) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    const hasRole = await client.hasRole(token, role);
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Usage
app.get('/admin', requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin panel' });
});
```

**What happens:**
1. SDK checks Redis cache for user roles
2. If cache miss, queries controller
3. Caches result for 15 minutes (configurable via `cache.roleTTL`)
4. Returns true/false

**Without Redis:** Role checks still work but go directly to controller (slower).

→ [Complete RBAC Example](../examples/step-4-rbac.ts)

---

### Step 5: Activate Logging

Logging sends application events to the Miso Controller for centralized monitoring.

#### Add API Key

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
  apiKey: 'dev-my-app-my-app-id-123-a1b2c3d4e5f6', // NEW
  redis: { host: 'localhost', port: 6379 },
});
```

**API key format:** `{environment}-{applicationKey}-{applicationId}-{randomString}`

**Get your API key:** Contact your AI Fabrix administrator or configure in the Miso Controller interface.

#### Log Application Events

```typescript
// Log informational messages
await client.log.info('User logged in', {
  userId: user?.id,
  username: user?.username,
  timestamp: new Date().toISOString(),
});

// Log errors
await client.log.error('Database connection failed', {
  error: err.message,
  stack: err.stack,
  database: 'production-db',
});

// Log warnings
await client.log.warn('High resource usage detected', {
  cpu: 85,
  memory: 92,
  server: 'server-123',
});

// Log debug information (only if logLevel is 'debug')
await client.log.debug('Processing request', {
  requestId: req.id,
  path: req.path,
});
```

#### Configure Log Levels

```typescript
const client = new MisoClient({
  // ... other config
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
});
```

**Log level hierarchy:**
- `debug` - All messages including debug info (development)
- `info` - Informational messages and above (default)
- `warn` - Warnings and errors only (production)
- `error` - Errors only (high-performance)

**What happens to logs:**
1. SDK sends logs to Miso Controller
2. Controller stores logs in database
3. Logs are queryable via controller interface
4. Redis used for rate limiting and buffering

→ [Complete Logging Example](../examples/step-5-logging.ts)  
→ [Logging Reference](api-reference.md#logger-service)

---

### Step 6: Activate Audit

Audit trails record important user actions for compliance and security.

#### Complete Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
  apiKey: 'dev-my-app-my-app-id-123-a1b2c3d4e5f6',
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'optional-password',
    keyPrefix: 'miso:', // Optional key prefix
  },
  logLevel: 'info',
  cache: {
    roleTTL: 900,        // 15 minutes
    permissionTTL: 900, // 15 minutes
  },
});
```

#### Create Audit Trails

```typescript
// Audit: Authentication events
await client.log.audit('user.login', 'authentication', {
  userId: user?.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString(),
});

await client.log.audit('user.logout', 'authentication', {
  userId: user?.id,
  sessionDuration: 3600, // seconds
});

// Audit: Permission checks
await client.log.audit('access.denied', 'authorization', {
  userId: user?.id,
  requiredRole: 'admin',
  attemptedResource: '/admin/users',
  reason: 'User does not have admin role',
});

// Audit: Content changes
await client.log.audit('post.created', 'content', {
  userId: user?.id,
  postId: 'post-123',
  postTitle: req.body.title,
  category: req.body.category,
});

await client.log.audit('user.deleted', 'administration', {
  userId: user?.id, // Who performed the action
  deletedUserId: 'user-456', // Who was deleted
  reason: 'Policy violation',
  archived: true,
});

// Audit: Role changes
await client.log.audit('role.assigned', 'authorization', {
  userId: user?.id,
  targetUserId: 'user-789',
  role: 'editor',
  assignedBy: user?.id,
});
```

**What to audit:**
- ✅ Authentication events (login, logout)
- ✅ Authorization decisions (access granted/denied)
- ✅ Sensitive operations (user deletion, role changes)
- ✅ Content creation/modification/deletion
- ✅ Configuration changes
- ✅ Financial transactions
- ✅ Data exports

**Audit structure:**
```typescript
await client.log.audit('event.name', 'event.category', {
  // Required: Who
  userId: user?.id,
  
  // Required: What
  resourceId: 'resource-123',
  resourceType: 'post',
  
  // Optional: Context
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString(),
  
  // Optional: Additional data
  metadata: { /* custom fields */ },
});
```

→ [Complete Audit Example](../examples/step-6-audit.ts)

---

## Complete Configuration

### Environment Variables

```bash
# Required
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
MISO_ENVIRONMENT=dev
MISO_APPLICATION_KEY=my-app
MISO_APPLICATION_ID=my-app-id-123

# Optional: API key for logging
MISO_API_KEY=dev-my-app-my-app-id-123-a1b2c3d4e5f6

# Optional: Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0

# Optional: Logging
MISO_LOG_LEVEL=info
```

### Load Configuration

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Auto-load from environment variables
const client = new MisoClient(loadConfig());

// Or manually
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  environment: process.env.MISO_ENVIRONMENT as 'dev' | 'tst' | 'pro',
  applicationKey: process.env.MISO_APPLICATION_KEY!,
  applicationId: process.env.MISO_APPLICATION_ID!,
  apiKey: process.env.MISO_API_KEY,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});
```

### TypeScript Configuration

```typescript
interface MisoClientConfig {
  controllerUrl: string;
  environment: 'dev' | 'tst' | 'pro';
  applicationKey: string;
  applicationId: string;
  apiKey?: string;
  redis?: RedisConfig;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  cache?: {
    roleTTL?: number;
    permissionTTL?: number;
  };
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}
```

→ [Complete Configuration Reference](configuration.md)

---

## Common Patterns

### Express.js Middleware

```typescript
// auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { MisoClient } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const isValid = await client.validateToken(token);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await client.getUser(token);
    req.user = user;
    
    await client.log.info('Request authenticated', {
      userId: user?.id,
      path: req.path,
      method: req.method,
    });
    
    next();
  } catch (error) {
    await client.log.error('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    });
    res.status(500).json({ error: 'Authentication error' });
  }
}

// role.middleware.ts
export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    const hasRole = await client.hasRole(token, role);
    if (!hasRole) {
      await client.log.audit('access.denied', 'authorization', {
        userId: req.user?.id,
        requiredRole: role,
        path: req.path,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// permission.middleware.ts
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    const hasPermission = await client.hasPermission(token, permission);
    if (!hasPermission) {
      await client.log.audit('access.denied', 'authorization', {
        userId: req.user?.id,
        requiredPermission: permission,
        path: req.path,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Usage in routes
app.get('/admin', authMiddleware, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only' });
});

app.post('/posts', authMiddleware, requirePermission('create:posts'), (req, res) => {
  res.json({ message: 'Post created' });
});
```

→ [More Express Examples](examples.md#expressjs-middleware)

### Error Handling

```typescript
async function handleRequest(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    // Validate authentication
    const isValid = await client.validateToken(token);
    if (!isValid) {
      await client.log.audit('access.denied', 'authentication', {
        reason: 'Invalid token',
        ip: req.ip,
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await client.getUser(token);
    
    // Check permissions
    const canEdit = await client.hasPermission(token, 'edit:content');
    if (!canEdit) {
      await client.log.audit('access.denied', 'authorization', {
        userId: user?.id,
        requiredPermission: 'edit:content',
      });
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Business logic
    const result = await performOperation();
    
    await client.log.info('Operation completed', {
      userId: user?.id,
      operation: 'edit:content',
    });
    
    res.json(result);
  } catch (error) {
    await client.log.error('Request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

→ [More Error Handling Examples](examples.md#error-handling)

---

## Next Steps

### Learn More
- [API Reference](api-reference.md) - Complete API documentation
- [Configuration Guide](configuration.md) - All configuration options
- [Examples](examples.md) - Framework-specific examples
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

### Framework Guides
- [Express.js](examples.md#expressjs-middleware) - API authentication
- [React](examples.md#react-authentication) - Frontend authentication
- [Next.js](examples.md#nextjs-api-routes) - Server-side rendering
- [NestJS](examples.md#nestjs-guards) - Decorator-based auth
- [Fastify](examples.md#fastify-plugin) - Plugin architecture

---

## Support

For help and questions:

- **Email**: <support@esystemsnordic.com>
- **Documentation**: [https://github.com/esystemsdev/aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client)
- **Issues**: [https://github.com/esystemsdev/aifabrix-miso-client/issues](https://github.com/esystemsdev/aifabrix-miso-client/issues)
