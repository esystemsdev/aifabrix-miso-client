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
import { MisoClient, loadConfig } from "@aifabrix/miso-client";

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

client.log.on("log", (logEntry) => {
  /* save to your DB */
});
client.log.on("log:batch", (logEntries) => {
  /* batch insert */
});
```

Use the same logging API (`client.log.info`, `logger.audit`, etc.); only the destination changes. See `examples/event-emission-mode.example.ts` in the repository for a full example.

## Optional: Encryption

For `client.encryption.encrypt` / `decrypt`:

```bash
ENCRYPTION_KEY=your-32-byte-key
```

See [encryption.md](encryption.md).

## Optional: Cache TTL

Override default cache TTLs (seconds) for roles, permissions, token validation, user info, and encryption:

```typescript
const client = new MisoClient({
  ...loadConfig(),
  cache: {
    roleTTL: 900,
    permissionTTL: 900,
    tokenValidationTTL: 900,
    userTTL: 300,
    encryptionCacheTTL: 300, // 0 = disable encryption cache
  },
});
```

See [redis.md](redis.md) for performance and reducing controller calls (including audit log batching).

## Manual configuration

When you cannot use `.env` (e.g. config from another source):

```typescript
const client = new MisoClient({
  controllerUrl: "https://controller.aifabrix.ai",
  clientId: "ctrl-dev-my-app",
  clientSecret: "your-secret",
  redis: { host: "localhost", port: 6379 },
  logLevel: "info",
});
```

Never hardcode secrets; use environment variables or a secure config store.

## Public and private controller URLs

For different browser vs server URLs (e.g. public HTTPS for browser, private URL for server):

- `controllerUrl` – fallback used when others are not set
- `controllerPublicUrl` – used in browser (e.g. Vite/React)
- `controllerPrivateUrl` – used on server (e.g. Node/Express)

Set via env or config. The SDK picks the right one by environment. See the full configuration reference in the repository for Keycloak, audit, and advanced options.

## Full URLs and virtual directories

All controller URL fields are **full URLs**. They may include a virtual-directory path:

```bash
MISO_CONTROLLER_URL=https://domain.com/miso
```

The SDK joins API paths to the configured root with a single helper, so the same code works for any mount: `/`, `/miso`, `/data`, `/myapp`, `/anything`. Choose the path you deploy under and put it in the URL once.

| App                | Example public root        |
| ------------------ | -------------------------- |
| Controller         | `https://domain.com/miso`  |
| Dataplane / API    | `https://domain.com/data`  |
| Custom application | `https://domain.com/myapp` |
| Root mount         | `https://domain.com`       |

**Avoid double-prefix.** If `controllerPublicUrl` already ends with `/miso`, do **not** add a separate `basePath`-style prefix elsewhere. Keep the virtual-directory segment in the URL exactly once. Symptoms of a double-prefix bug are URLs like `…/miso/miso/api/v1/…`.

**Two roots, one joiner.** When you call your own backend (dataplane or a custom app) **and** the controller, configure two **independent** full URLs — one for each — and let the SDK join paths to each root separately. There is one join helper for everything; do not introduce a second URL-build path.

**Vite and React Router are host concerns.** miso-client never reads Vite config. In your host app, configure Vite `base` for static assets and React Router `basename` for in-app routes; configure the SDK with the **full backend URL** independently. The three settings can move together (same virtual directory) but they live in three different places.

For advanced cases where you need to compose URLs yourself (e.g. building an audit log link), the SDK exports the same helper it uses internally:

```typescript
import { joinApiRoot, normalizeRootUrl } from "@aifabrix/miso-client";

joinApiRoot("https://domain.com/miso", "/api/v1/health");
// "https://domain.com/miso/api/v1/health"
```

`joinApiRoot(root, path)` requires `path` to start with `/`. `normalizeRootUrl(root)` validates and trims trailing slashes; it accepts http/https only.
