# Redis

Redis is optional. When configured, the SDK caches roles, permissions, token validation, user info, and encryption responses to reduce controller calls. When Redis is unavailable, the SDK falls back to the controller.

## What is cached

- **Token validation** – per user, configurable TTL (default up to 15 minutes).
- **User info** – per user, default TTL 5 minutes (`userTTL`).
- **Roles** – per user, default TTL 15 minutes.
- **Permissions** – per user, default TTL 15 minutes.
- **Encryption** – encrypt/decrypt results by input hash; default TTL 5 minutes (`encryptionCacheTTL`). Set to `0` to disable. With key rotation, use a lower TTL or disable cache.

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

- **Roles / permissions:** default 900 seconds (15 minutes). Configurable via `config.cache.roleTTL`, `config.cache.permissionTTL`.
- **Token validation:** configurable via `config.cache.tokenValidationTTL` (max TTL).
- **User info:** default 300 seconds (5 minutes). Configurable via `config.cache.userTTL`.
- **Encryption:** default 300 seconds (5 minutes). Configurable via `config.cache.encryptionCacheTTL` (set to `0` to disable).
- Keys follow patterns like `roles:{userId}`, `permissions:{userId}`, and `encryption:encrypt:*` / `encryption:decrypt:*` (hashed).

For high throughput, you can increase TTLs where consistency allows; for key rotation or strict freshness, lower encryption TTL or set `encryptionCacheTTL: 0`.

## Performance and reducing controller calls

- **Redis:** Use Redis when running multiple processes so cache is shared and controller call volume is reduced.
- **Encryption cache:** When `encryptionCacheTTL` is set (default 300s), repeated encrypt/decrypt of the same value and parameter name is served from cache. Disable with `encryptionCacheTTL: 0` if you need no caching (e.g. frequent key rotation).
- **Audit log batching:** Set `audit.batchSize` and/or `audit.batchInterval` in config so audit logs are queued and sent in batches (defaults: batch size 10, interval 100 ms when batching is enabled). This reduces log endpoint calls. See [audit-and-logging.md](audit-and-logging.md).

See [configuration.md](configuration.md) for cache options and [authorization.md](authorization.md) for role/permission APIs.
