# Authorization API Reference

Complete API reference for authorization methods (roles and permissions) in the MisoClient SDK.

## Table of Contents

- [Role Methods](#role-methods)
- [Permission Methods](#permission-methods)
- [Cache Management](#cache-management)
- [Examples](#examples)
- [See Also](#see-also)

## Role Methods

### `getRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]>`

Gets all roles for a user (cached in Redis if available).

**Parameters:**

- `token` - JWT token
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to array of role names

**Example:**

```typescript
const roles = await client.getRoles(token);
console.log('User roles:', roles); // ['admin', 'user', 'editor']

// With custom auth strategy
const strategy = client.createAuthStrategy(['client-token']);
const roles = await client.getRoles(token, strategy);
```

### `hasRole(token: string, role: string, authStrategy?: AuthStrategy): Promise<boolean>`

Checks if user has a specific role.

**Parameters:**

- `token` - JWT token
- `role` - Role name to check
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to `true` if user has the role

**Example:**

```typescript
const isAdmin = await client.hasRole(token, 'admin');
if (isAdmin) {
  console.log('User is an admin');
}
```

### `hasAnyRole(token: string, roles: string[], authStrategy?: AuthStrategy): Promise<boolean>`

Checks if user has any of the specified roles.

**Parameters:**

- `token` - JWT token
- `roles` - Array of role names
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to `true` if user has any of the roles

**Example:**

```typescript
const canEdit = await client.hasAnyRole(token, ['admin', 'editor']);
if (canEdit) {
  console.log('User can edit content');
}
```

### `hasAllRoles(token: string, roles: string[], authStrategy?: AuthStrategy): Promise<boolean>`

Checks if user has all of the specified roles.

**Parameters:**

- `token` - JWT token
- `roles` - Array of role names
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to `true` if user has all roles

**Example:**

```typescript
const isSuperAdmin = await client.hasAllRoles(token, ['admin', 'superuser']);
if (isSuperAdmin) {
  console.log('User is a super admin');
}
```

### `refreshRoles(token: string, authStrategy?: AuthStrategy): Promise<string[]>`

Force refreshes roles from controller (bypasses cache).

**Parameters:**

- `token` - JWT token
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to fresh array of role names

**Example:**

```typescript
const freshRoles = await client.refreshRoles(token);
console.log('Fresh roles:', freshRoles);
```

### `clearRolesCache(token: string, authStrategy?: AuthStrategy): Promise<void>`

Clears cached roles for a user.

**Parameters:**

- `token` - JWT token
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise that resolves when cache is cleared

**Example:**

```typescript
await client.clearRolesCache(token);
console.log('Roles cache cleared');
```

## Permission Methods

### `getPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]>`

Gets all permissions for a user (cached in Redis if available).

**Parameters:**

- `token` - JWT token
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to array of permission names

**Example:**

```typescript
const permissions = await client.getPermissions(token);
console.log('User permissions:', permissions);
```

### `hasPermission(token: string, permission: string, authStrategy?: AuthStrategy): Promise<boolean>`

Checks if user has a specific permission.

**Parameters:**

- `token` - JWT token
- `permission` - Permission name to check
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to `true` if user has the permission

**Example:**

```typescript
const canDelete = await client.hasPermission(token, 'delete:posts');
if (canDelete) {
  console.log('User can delete posts');
}
```

### `hasAnyPermission(token: string, permissions: string[], authStrategy?: AuthStrategy): Promise<boolean>`

Checks if user has any of the specified permissions.

**Parameters:**

- `token` - JWT token
- `permissions` - Array of permission names
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to `true` if user has any permission

**Example:**

```typescript
const canModify = await client.hasAnyPermission(token, ['edit:posts', 'delete:posts']);
if (canModify) {
  console.log('User can modify posts');
}
```

### `hasAllPermissions(token: string, permissions: string[], authStrategy?: AuthStrategy): Promise<boolean>`

Checks if user has all of the specified permissions.

**Parameters:**

- `token` - JWT token
- `permissions` - Array of permission names
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to `true` if user has all permissions

**Example:**

```typescript
const canManage = await client.hasAllPermissions(token, [
  'create:posts',
  'edit:posts',
  'delete:posts'
]);
if (canManage) {
  console.log('User can fully manage posts');
}
```

### `refreshPermissions(token: string, authStrategy?: AuthStrategy): Promise<string[]>`

Force refreshes permissions from controller (bypasses cache).

**Parameters:**

- `token` - JWT token
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise resolving to fresh array of permission names

**Example:**

```typescript
const freshPermissions = await client.refreshPermissions(token);
console.log('Fresh permissions:', freshPermissions);
```

### `clearPermissionsCache(token: string, authStrategy?: AuthStrategy): Promise<void>`

Clears cached permissions for a user.

**Parameters:**

- `token` - JWT token
- `authStrategy` - Optional authentication strategy override

**Returns:** Promise that resolves when cache is cleared

**Example:**

```typescript
await client.clearPermissionsCache(token);
console.log('Permissions cache cleared');
```

## Cache Management

Roles and permissions are cached in Redis (if available) with a default TTL of 15 minutes. Cache keys are based on the user ID extracted from the JWT token.

**Cache Behavior:**

- Roles and permissions are automatically cached after first retrieval
- Cache persists for 15 minutes (configurable via `cache.roleTTL` and `cache.permissionTTL` in config)
- Use `refreshRoles()` or `refreshPermissions()` to bypass cache and fetch fresh data
- Use `clearRolesCache()` or `clearPermissionsCache()` to manually clear cache
- Cache is automatically cleared when Redis connection is lost

## Examples

### Role-Based Authorization Middleware

```typescript
import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
const client = new MisoClient(loadConfig());
await client.initialize();

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

// Usage
app.get('/admin', authMiddleware, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin panel' });
});
```

### Permission Checks

```typescript
import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
const client = new MisoClient(loadConfig());
await client.initialize();

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
app.delete('/posts/:id', authMiddleware, requirePermission('delete:posts'), (req, res) => {
  res.json({ message: 'Post deleted' });
});
```

### Protected Routes

```typescript
import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
const client = new MisoClient(loadConfig());
await client.initialize();

app.get('/posts', authMiddleware, async (req, res) => {
  const token = client.getToken(req);
  
  // Check if user can read posts
  const canRead = await client.hasPermission(token, 'read:posts');
  if (!canRead) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  // Check if user has admin or editor role
  const canEdit = await client.hasAnyRole(token, ['admin', 'editor']);
  
  const posts = await fetchPosts();
  res.json({ posts, canEdit });
});
```

### React Component Example

```typescript
import { useEffect, useState } from 'react';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

function UserManagement() {
  const [canManageUsers, setCanManageUsers] = useState(false);

  useEffect(() => {
    async function checkPermissions() {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const hasPermission = await client.hasAllPermissions(token, [
        'read:users',
        'write:users',
        'delete:users'
      ]);
      setCanManageUsers(hasPermission);
    }
    checkPermissions();
  }, []);

  if (!canManageUsers) {
    return <div>You don't have permission to manage users.</div>;
  }

  return <div>User Management UI...</div>;
}
```

## See Also

- [Authentication Reference](./reference-authentication.md) - User authentication and token validation
- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [DataClient Reference](./reference-dataclient.md#authorization-methods) - Browser client authorization methods
- [Examples Guide](./examples.md) - Framework-specific examples
- **Example Files:**
  - [RBAC Example](../examples/step-4-rbac.ts) - Role-based access control usage

