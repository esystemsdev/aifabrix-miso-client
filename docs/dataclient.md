# DataClient

Browser-compatible HTTP client for front-end apps. Use zero-config (backend route + autoInitializeDataClient) or manual config. Main methods only.

## Security

**Never put `clientSecret` in browser code.** Use the server-provided client token: backend exposes one route that returns a token; the frontend uses that token. See [backend-client-token.md](backend-client-token.md).

## Zero-config (recommended)

**Backend:** One route with the SDK helper.

```typescript
import {
  MisoClient,
  loadConfig,
  createClientTokenEndpoint,
} from "@aifabrix/miso-client";

const client = new MisoClient(loadConfig());
await client.initialize();

app.get(
  "/api/client-token",
  createClientTokenEndpoint(client, {
    clientTokenUri: "/api/client-token",
    expiresIn: 1800,
  }),
);
```

**Frontend:** Initialize once (e.g. at app bootstrap). DataClient fetches config and token from your backend.

```typescript
import { autoInitializeDataClient, DataClient } from "@aifabrix/miso-client";

const dataClient = await autoInitializeDataClient({
  clientTokenUri: "/api/client-token",
});
```

Use the returned `dataClient` for all requests.

## Manual config

When you need custom settings (e.g. different baseUrl, cache, retry):

```typescript
import { DataClient } from "@aifabrix/miso-client";

const dataClient = new DataClient({
  baseUrl: "https://api.example.com",
  misoConfig: {
    controllerUrl: "https://controller.aifabrix.ai",
    clientId: "ctrl-dev-my-app",
    clientToken: initialToken, // from your backend
    clientTokenExpiresAt: expiresAt,
    onClientTokenRefresh: async () => {
      const res = await fetch("/api/client-token", { credentials: "include" });
      const data = await res.json();
      return { token: data.token, expiresIn: data.expiresIn };
    },
  },
  cache: { enabled: true, defaultTTL: 600 },
  retry: { enabled: true, maxRetries: 3 },
});
```

Do not set `clientSecret` in browser config; use `clientToken` + `onClientTokenRefresh` only.

**`baseUrl` is a full URL** and may include a virtual-directory path (e.g. `https://domain.com/data` for a dataplane, `https://domain.com/myapp` for a custom app, or `https://domain.com` for a root mount). **Prefer** putting the mount in `baseUrl` itself. For compatibility when you only have an origin plus a path segment, set optional **`basePath`** (e.g. `baseUrl: "https://domain.com"` + `basePath: "/data"`); the SDK merges once at init via `mergeRootUrlWithBasePath` and does not duplicate the segment if `baseUrl` already contains it. See [configuration.md](configuration.md#full-urls-and-virtual-directories).

## Main methods

**HTTP:**

```typescript
const users = await dataClient.get("/api/users");
const created = await dataClient.post("/api/users", { name: "Jane" });
const updated = await dataClient.put("/api/users/1", { name: "Jane Doe" });
await dataClient.patch("/api/users/1", { email: "jane@example.com" });
await dataClient.delete("/api/users/1");
```

**Auth (user token from your app, e.g. stored after login):**

```typescript
const isValid = await dataClient.validateToken();
const user = await dataClient.getUser();
const hasPerm = await dataClient.hasPermission("users:read");
const hasRole = await dataClient.hasRole("admin");
```

DataClient sends the user token from browser runtime state when calling these methods. Populate runtime state via OAuth callback/session restore/refresh hooks; browser flows must not depend on JS-readable persistent token storage.

### Token key contract (`miso_token`)

DataClient keeps browser user access-token state in runtime memory only.

`token`, `accessToken`, and `authToken` are legacy migration keys and are unsupported in the final cutover contract.

`tokenKeys` are retained only for deterministic cleanup compatibility (for example removing stale historical keys during logout/fail-closed cleanup). They are not an operational browser token source.

If your app needs explicit cleanup aliases, set **`tokenKeys`** explicitly:

```typescript
const dataClient = new DataClient({
  baseUrl: "https://api.example.com",
  misoConfig: {
    /* ... */
  },
  tokenKeys: ["my_custom_token"], // optional stale-key cleanup aliases
});
```

OAuth callback and restore/refresh flows return access-token material that the SDK keeps in runtime memory only for browser paths.

## When you need more than zero-config

`autoInitializeDataClient` returns a DataClient with minimal config (only `baseUrl` and `misoConfig` from the server response). It does **not** accept `tokenKeys`, `loginUrl`/`logoutUrl`, `audit` (e.g. `skipEndpoints`), or interceptors. If you need those, use the pattern below.

**1. Fetch token and config from your backend**  
Call your client-token endpoint (e.g. POST `/auth/client-token`) and optionally a config-only endpoint (e.g. GET `/auth/client-config`) for the login page. Response shape: `{ token?, expiresIn, config?: { baseUrl, controllerUrl, clientId, clientTokenUri } }`.

**2. Cache only non-token config**  
Persist only non-sensitive DataClient config (for example `miso:dataclient-config`). `x-client-token` material is runtime-memory-only in browser flows and must not be persisted in `localStorage`.

**3. Build a full DataClientConfig**

- `baseUrl`: your API (dataplane) base URL.
- `misoConfig`: controller URL (for validate, getUser, logs), `clientId`, `clientTokenUri`; add `onClientTokenRefresh` that calls your fetch so the client can refresh the client token.
- Add `tokenKeys`, `loginUrl`, `logoutUrl`, `audit` (e.g. `skipEndpoints` for auth routes), `cache`, `retry`, `timeout` as needed.

**4. Controller URL vs dataplane URL (two roots, one joiner)**

- **baseUrl** is the full URL of your own API (dataplane or custom app), e.g. `https://domain.com/data` or `https://domain.com/myapp`.
- **misoConfig.controllerUrl** / **controllerPublicUrl** is the full URL of the controller (auth, logs, validation), e.g. `https://domain.com/miso`.

Configure these as two **independent** full URLs. The SDK joins endpoint paths to each root with the same helper, so the same code works for any virtual directory mount (`/`, `/miso`, `/data`, `/myapp`, `/anything`).

If your backend returns both URLs, use them as-is. If the API sometimes returns the same origin as the app (e.g. in dev), resolve or override so validate/getUser/logs hit the real controller, not the dataplane.

Avoid double-prefix: do not put the same virtual-directory segment in **`baseUrl`** and again in **`basePath`**, and do not combine SDK `basePath` with an unrelated duplicate prefix from the host app. Prefer one full `baseUrl`; use optional `basePath` only for origin + path split. See [configuration.md](configuration.md#full-urls-and-virtual-directories).

**5. Interceptors**  
Use `dataClient.setInterceptors({ onRequest: async (url, options) => { ... } })` to add e.g. `X-Request-ID`, `Authorization: Bearer <token>` (from runtime auth state), and `X-Client-Token` when available.

**Summary:** One init with zero-config is enough when you only need default token keys and no custom audit or interceptors. When you need custom token keys, login/logout URLs, audit options, or request headers, fetch token/config yourself, persist only non-token config, keep `x-client-token` in runtime memory, then `new DataClient(fullConfig)` and optionally `setInterceptors`.

## React example (minimal)

```typescript
import { autoInitializeDataClient, DataClient } from '@aifabrix/miso-client';
import { useEffect, useState } from 'react';

function UsersList() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    (async () => {
      const dc = await autoInitializeDataClient({ clientTokenUri: '/api/client-token' });
      const data = await dc.get('/api/users');
      setUsers(data);
    })();
  }, []);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

## Features (short)

- Audit logging (ISO 27001 style) and masking for requests
- Caching and retry for GET/requests
- Token refresh via `onClientTokenRefresh`
- Works with React, Vue, Angular, etc.

See [backend-client-token.md](backend-client-token.md) and [quick-start.md](quick-start.md) for the full backend + frontend flow.

## Enterprise auth flow

For enterprise SSO flows, DataClient now supports a cookie-first recovery sequence:

1. On `401`, call optional `onSessionRestore` callback first (recommended).
2. If restore does not return a token, call `onTokenRefresh`.
3. Retry the original request once with refreshed/restored token.
4. If both fail, clear cached browser auth state and continue with login redirect flow.
5. Refresh checks are activity-driven (`mousemove`, `click`, `keydown`) with a 60-second cadence and no background polling loop.

Recommended config (SDK helpers — 4.16+):

```typescript
import {
  createCookieSessionCallbacks,
  resolveBrowserApiBaseUrl,
} from "@aifabrix/miso-client";

const getBaseUrl = () =>
  resolveBrowserApiBaseUrl({
    configuredApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    pageOrigin: window.location.origin,
  });

const cookieCallbacks = createCookieSessionCallbacks({
  getBaseUrl,
  onAccessToken: async (result) => {
    /* keep result.accessToken in runtime memory only */
  },
});
// callback result intentionally excludes refreshToken for browser flows

const dc = new DataClient({
  baseUrl: getBaseUrl() || "/api",
  preferCookieSessionRestore: true,
  onSessionRestore: cookieCallbacks.onSessionRestore,
  onTokenRefresh: cookieCallbacks.onTokenRefresh,
  misoConfig: {
    controllerUrl: "https://controller.example.com",
    clientId: "my-client",
  },
});
```

For silent recovery outside DataClient (e.g. custom retry), use `recoverBrowserSessionWithStaleCleanup` or `recoverBrowserSessionOrThrow` from the same package. See [authentication.md](authentication.md#browser-ui-helpers-416).

Notes:

- Keep refresh/session secrets in HttpOnly cookies; browser user access-token state must stay runtime-memory-only.
- Browser auth requests use runtime-memory token reads and deterministic stale-auth cleanup.
- In split-port dev, resolve API `baseUrl` with `resolveBrowserApiBaseUrl` so cookies and proxy paths stay on the UI origin.
- Public API outputs remain camelCase.
