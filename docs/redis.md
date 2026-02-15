# Redis

Redis is optional. When configured, the SDK caches roles and permissions (and token validation) to reduce controller calls. When Redis is unavailable, the SDK falls back to the controller.

## What is cached

- **Token validation** – per user, default TTL 15 minutes.
- **Roles** – per user, default TTL 15 minutes.
- **Permissions** – per user, default TTL 15 minutes.

Cache is cleared on logout for that user.

## Configuration

In `.env` (optional):

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

If these are not set, the SDK does not use Redis and every check goes to the controller.

## Behavior

- If Redis is configured and connected: read/write cache; use controller on cache miss or when refreshing.
- If Redis is not configured or connection fails: use controller only (no cache). The SDK still works.

You do not need to change application code when Redis is missing; fallback is automatic.

## TTL and cache keys

- Default TTL: 900 seconds (15 minutes). Configurable via `config.cache` (e.g. `roleTTL`, `permissionTTL`, `tokenValidationTTL`).
- Keys follow patterns like `roles:{userId}` and `permissions:{userId}`.

See [configuration.md](configuration.md) for cache options and [authorization.md](authorization.md) for role/permission APIs.
