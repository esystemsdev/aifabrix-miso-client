# Configuration

Required .env only; optional Redis, client token URI, and log level. Prefer `loadConfig()` from environment.

## Required

Set these in `.env` (or environment) for the SDK to work:

```bash
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
```

Load in code:

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();
```

`loadConfig()` reads the variables above and throws if any required value is missing.

## Optional: Redis

For caching (roles, permissions, token validation):

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

If Redis is not set or connection fails, the SDK still works and uses the controller only (no cache). See [redis.md](redis.md).

## Optional: Client token URI

Backend route that returns a client token for the frontend. Default used internally is `/api/v1/auth/token`. To use a different path (e.g. for DataClient):

```bash
MISO_CLIENT_TOKEN_URI=/api/client-token
```

See [backend-client-token.md](backend-client-token.md).

## Optional: Log level

```bash
MISO_LOG_LEVEL=info
```

Values: `debug`, `info`, `warn`, `error`. Default is typically `info`.

## Optional: Event emission mode

When you embed the SDK and want to **handle logs yourself** (e.g. save to your own DB) instead of sending them to the controller, set `emitEvents: true`. Logs are then emitted as Node.js events; no HTTP or Redis is used for logging.

```bash
MISO_EMIT_EVENTS=true
```

Or in config:

```typescript
const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true,
});
await client.initialize();

client.log.on('log', (logEntry) => { /* save to your DB */ });
client.log.on('log:batch', (logEntries) => { /* batch insert */ });
```

Use the same logging API (`client.log.info`, `logger.audit`, etc.); only the destination changes. See `examples/event-emission-mode.example.ts` in the repository for a full example.

## Optional: Encryption

For `client.encryption.encrypt` / `decrypt`:

```bash
ENCRYPTION_KEY=your-32-byte-key
```

See [encryption.md](encryption.md).

## Optional: Cache TTL

Override default 15-minute cache TTL (seconds) for roles, permissions, token validation:

```typescript
const client = new MisoClient({
  ...loadConfig(),
  cache: {
    roleTTL: 900,
    permissionTTL: 900,
    tokenValidationTTL: 900,
  },
});
```

## Manual configuration

When you cannot use `.env` (e.g. config from another source):

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  redis: { host: 'localhost', port: 6379 },
  logLevel: 'info',
});
```

Never hardcode secrets; use environment variables or a secure config store.

## Public and private controller URLs

For different browser vs server URLs (e.g. public HTTPS for browser, private URL for server):

- `controllerUrl` – fallback used when others are not set
- `controllerPublicUrl` – used in browser (e.g. Vite/React)
- `controllerPrivateUrl` – used on server (e.g. Node/Express)

Set via env or config. The SDK picks the right one by environment. See the full configuration reference in the repository for Keycloak, audit, and advanced options.
