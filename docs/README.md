# Miso Client SDK – Documentation Index

What to read when.

## Core (main points, simple only)

| Topic | Doc | When to read |
|-------|-----|--------------|
| **Quick start** | [quick-start.md](quick-start.md) | First-time setup: install, .env, init, validate + getUser |
| **Backend client token** | [backend-client-token.md](backend-client-token.md) | Expose a client token to the frontend (one route + frontend one-liner) |
| **Authentication** | [authentication.md](authentication.md) | Token, validate, user, login/logout |
| **Authorization** | [authorization.md](authorization.md) | Roles and permissions (getRoles, hasRole, hasPermission) |
| **Audit and logging** | [audit-and-logging.md](audit-and-logging.md) | Audit events, error logs, request context |
| **Errors** | [errors.md](errors.md) | Express pattern: asyncHandler, handleRouteError, AppError, MisoClientError |
| **Redis** | [redis.md](redis.md) | Optional cache for roles/permissions; fallback to controller |
| **Pagination, filter, sorting** | [pagination-filter-sorting.md](pagination-filter-sorting.md) | How to use pagination, filter, and sort (simple only) |
| **Encryption** | [encryption.md](encryption.md) | How to use encrypt/decrypt (simple only) |

## Support

| Topic | Doc | When to read |
|-------|-----|--------------|
| **Configuration** | [configuration.md](configuration.md) | Required .env and optional settings |
| **DataClient** | [dataclient.md](dataclient.md) | Browser client: zero-config (backend route + autoInitializeDataClient), main methods |
| **Troubleshooting** | [troubleshooting.md](troubleshooting.md) | Connection, auth, Redis, CORS |

## Examples

See [examples/README.md](examples/README.md) for testing and minimal examples.
