# Authentication

How to work with tokens, validate them, get user info, and handle login/logout. Minimal examples only.

## Get token from request

```typescript
const token = client.getToken(req); // Reads Authorization: Bearer <token>
```

Use this in middleware or route handlers to obtain the user JWT. `getToken(req)` only reads **`req.headers.authorization`** (with or without a `Bearer ` prefix).

### Custom header or cookie (e.g. `miso_token`)

If your platform sends the token under a different name (e.g. header `miso_token` or a cookie), read it yourself and pass the string to the SDK:

```typescript
const token = req.headers["miso_token"] ?? req.cookies?.miso_token ?? null;
if (token) {
  const isValid = await client.validateToken(token);
  const user = await client.getUser(token);
}
```

The SDK accepts the token string for `validateToken`, `getUser`, `logout`, etc.; it does not read custom headers or cookies for you.

## Validate token

```typescript
const isValid = await client.validateToken(token);
if (!isValid) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

Results are cached by user (default TTL 15 min). See [redis.md](redis.md).

## Get user info

```typescript
const user = await client.getUser(token);
if (user) {
  console.log(user.username, user.id);
}
```

Returns user object or `null` if invalid.

## Login

Get a login URL and redirect the user to Keycloak. The controller validates the redirect URL against your app.

```typescript
const response = await client.login({
  redirect: "https://myapp.com/dashboard", // Where to send user after login
  state: "optional-csrf-state",
});
// Redirect browser to response.loginUrl
window.location.href = response.loginUrl;
```

After authentication, the controller redirects the user to your `redirect` URL.

## Logout

Invalidate the user token and clear token-validation cache:

```typescript
await client.logout({ token });
```

## Token refresh

Exchange a refresh token for a new access token (or use cookie-first refresh without payload):

```typescript
const response = await client.refreshToken(refreshToken);
if (response) {
  console.log(response.accessToken, response.expiresIn);
}
```

Cookie-first browser flow can call the same endpoint with no `refreshToken` body:

```typescript
const response = await client.refreshToken();
```

Returns `null` on error.

## Browser session restore and cleanup

For browser clients, prefer cookie-backed session restore before explicit refresh:

- Configure `onSessionRestore` in DataClient for cookie-first recovery.
- Keep `onTokenRefresh` as fallback for refresh endpoint integration.
- Use `clearCachedBrowserAuthState` callback (or built-in default cleanup) when restore/refresh fails.

This keeps refresh/session secrets outside browser-accessible storage and keeps browser access-token handling runtime-memory-only.

### Browser UI helpers (4.16+)

Shared helpers for React apps (miso-ui, dataplane app-ui) — avoid duplicating `fetch` to controller auth routes:

```typescript
import {
  AUTH_CONTROLLER_PATHS,
  createBrowserSessionClient,
  createCookieSessionCallbacks,
  ensureBrowserAccessToken,
  resolveBrowserApiBaseUrl,
  alignLoopbackHostnameWithPage,
  recoverBrowserSessionWithStaleCleanup,
  isUnauthorizedApiError,
  isInactiveTokenMessage,
  extractClientTokenFromUrl,
  removeClientTokenFromUrl,
} from "@aifabrix/miso-client";

const getBaseUrl = () =>
  alignLoopbackHostnameWithPage(
    resolveBrowserApiBaseUrl({
      explicitMisoApiBaseUrl: import.meta.env.VITE_MISO_API_BASE_URL,
      configuredApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      pageOrigin: window.location.origin,
      basePath: import.meta.env.BASE_URL,
    }),
  );

const sessionClient = createBrowserSessionClient({ getBaseUrl });
const { onSessionRestore, onTokenRefresh } = createCookieSessionCallbacks({
  getBaseUrl,
  onAccessToken: async (result) => {
    /* keep result.accessToken in app runtime memory only */
  },
});
// result includes access-token expiry metadata only (no refreshToken field)

// After full page load when HttpOnly refresh cookie exists:
await ensureBrowserAccessToken({
  getBaseUrl,
  getAccessToken: () => null,
  onAccessToken: async (result) => {
    /* store access token */
  },
});

// Silent recovery (refresh → restore → clear stale → retry):
const recovered = await recoverBrowserSessionWithStaleCleanup({
  client: sessionClient,
  clearStaleState: () => {
    /* clear app runtime token state + SDK caches */
  },
});
```

| Helper                                              | Use when                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `resolveBrowserApiBaseUrl`                          | UI and API on different dev ports — use page origin so Vite/nginx proxies `/api` |
| `alignLoopbackHostnameWithPage`                     | `localhost` vs `127.0.0.1` must match the tab the user signed in with            |
| `createCookieSessionCallbacks`                      | Wire DataClient `onSessionRestore` / `onTokenRefresh`                            |
| `recoverBrowserSessionWithStaleCleanup`             | Request-level or manual silent re-auth                                           |
| `isUnauthorizedApiError` / `isInactiveTokenMessage` | Classify 401 and inactive-token errors                                           |

Paths: `AUTH_CONTROLLER_PATHS` (`session`, `refresh`, `login`, `callback`, `logout`, `clientToken`). See [dataclient.md](dataclient.md#enterprise-auth-flow).

## Summary

| Need                 | Method                               |
| -------------------- | ------------------------------------ |
| Token from request   | `client.getToken(req)`               |
| Check if token valid | `client.validateToken(token)`        |
| User info            | `client.getUser(token)`              |
| Login URL            | `client.login({ redirect, state? })` |
| Logout               | `client.logout({ token })`           |
| Refresh token        | `client.refreshToken(refreshToken?)` |

See [quick-start.md](quick-start.md) for init and [authorization.md](authorization.md) for roles and permissions.
