# Troubleshooting

Common issues and fixes: connection, auth, Redis, CORS.

## Connection

### Controller unreachable

- Confirm **MISO_CONTROLLER_URL** is correct and reachable from your environment (no typo, right protocol, right host/port).
- Test: `curl -I <MISO_CONTROLLER_URL>/health` (or the controller’s health endpoint).
- Check firewall/network: the app server must be allowed to open outbound connections to the controller.

### SSL/TLS errors

- Update Node and system CA certificates.
- For **development only** with self-signed certs you can set `NODE_TLS_REJECT_UNAUTHORIZED=0`; never use this in production.

## Authentication

### Token validation fails

- Ensure the request sends the user JWT: `Authorization: Bearer <token>`.
- Check token format (JWT has three dot-separated parts).
- Confirm the token is not expired (decode the JWT payload and check `exp`).
- Verify **MISO_CLIENTID** and **MISO_CLIENTSECRET** are correct and that the controller can validate the token (same Keycloak/realm as the token issuer).

### Client token / “Failed to get environment token”

- Backend only: ensure **MISO_CLIENTID** and **MISO_CLIENTSECRET** are set and valid in the environment that runs the backend.
- Ensure the controller’s token endpoint (e.g. `/api/auth/token`) is reachable from the backend and returns 200 with a token.
- For frontend: never use client secret in the browser; use a backend route that returns a client token (see [backend-client-token.md](backend-client-token.md)).

### User info not returned

- Call **validateToken** first; if it returns false, **getUser** may not return data.
- Ensure the token is the same one issued for your app / realm.

## Redis

### Redis connection failed

- SDK continues to work without Redis: it falls back to the controller (no cache).
- To use Redis: set **REDIS_HOST** and **REDIS_PORT** (and **REDIS_PASSWORD** if required). Check that Redis is running and reachable: `redis-cli -h <host> -p <port> ping`.
- If Redis is optional for you, you can leave it unset and rely on controller-only mode.

### Slow role/permission checks

- Add Redis and optional cache TTL tuning so roles/permissions are cached. See [redis.md](redis.md) and [configuration.md](configuration.md).

## CORS

### Browser CORS errors when calling controller or API

CORS is required for **all** cross-origin browser requests—whether the request is authenticated or not. The SDK does not set CORS headers; your server (or the controller) must.

- The **controller** (or the API the browser calls) must allow your frontend origin (e.g. `Access-Control-Allow-Origin`). If you send credentials (cookies, `credentials: 'include'`), also set `Access-Control-Allow-Credentials: true`.
- **Unauthenticated endpoints:** Same CORS policy applies; the browser still checks origin before the request.
- In development, a proxy (e.g. Vite proxy, or your backend proxying to the controller) can avoid CORS by having the browser call your app’s origin only.
- Ensure the backend client-token route is on the same origin as the frontend or that its CORS policy allows the frontend origin.

## Configuration

### Invalid or missing config

- Use **loadConfig()** so required env vars are validated at startup; it throws if **MISO_CLIENTID**, **MISO_CLIENTSECRET**, or **MISO_CONTROLLER_URL** are missing.
- Do not log **MISO_CLIENTSECRET** (or any secret); log only non-sensitive settings (e.g. controller URL, client ID) when debugging.

## Getting help

- Check the docs: [quick-start](quick-start.md), [authentication](authentication.md), [backend-client-token](backend-client-token.md), [errors](errors.md), [redis](redis.md), [configuration](configuration.md).
- Open an issue in the repository with: SDK version, Node version, what you did, what you expected, and the error message or logs (with secrets removed).
