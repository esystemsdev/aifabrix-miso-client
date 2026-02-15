# Authorization

How to check roles and permissions. Minimal examples only.

## Roles

```typescript
const roles = await client.getRoles(token);
// e.g. ['admin', 'user']

const isAdmin = await client.hasRole(token, 'admin');
const canEdit = await client.hasAnyRole(token, ['admin', 'editor']);
const hasBoth = await client.hasAllRoles(token, ['admin', 'manager']);
```

Roles are cached (Redis if configured). See [redis.md](redis.md).

## Permissions

```typescript
const permissions = await client.getPermissions(token);
const canDelete = await client.hasPermission(token, 'delete:posts');
const canModify = await client.hasAnyPermission(token, ['edit:posts', 'delete:posts']);
const hasAll = await client.hasAllPermissions(token, ['read:users', 'write:users']);
```

Permissions are also cached.

## Refresh from controller

To bypass cache and get fresh data:

```typescript
const freshRoles = await client.refreshRoles(token);
const freshPermissions = await client.refreshPermissions(token);
```

## Clear cache for a user

```typescript
await client.clearRolesCache(token);
await client.clearPermissionsCache(token);
```

## Summary

| Need | Method |
|------|--------|
| All roles | `client.getRoles(token)` |
| Has role | `client.hasRole(token, role)` |
| Any of roles | `client.hasAnyRole(token, roles)` |
| All roles | `client.hasAllRoles(token, roles)` |
| All permissions | `client.getPermissions(token)` |
| Has permission | `client.hasPermission(token, permission)` |
| Refresh roles | `client.refreshRoles(token)` |
| Refresh permissions | `client.refreshPermissions(token)` |

See [authentication.md](authentication.md) for token and user, [redis.md](redis.md) for cache behavior.
