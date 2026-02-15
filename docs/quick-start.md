# Quick Start

Install, configure with .env, initialize the client, and validate tokens and get user info in a few steps.

## Prerequisites

- Node.js 18+
- Keycloak and Miso Controller running (or use [AI Fabrix Builder](https://github.com/esystemsdev/aifabrix-builder))

## 1. Install

```bash
npm install @aifabrix/miso-client
```

## 2. Configure (.env)

Create a `.env` file in your project root with **required** variables only for a minimal start:

```bash
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
```

Optional but recommended: Redis for caching.

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

See [configuration.md](configuration.md) for all options.

## 3. Initialize

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();
```

## 4. Client token route (backend)

Your backend must expose a route that returns a client token so the frontend (e.g. DataClient) can call the controller without using `clientSecret`. One route is enough:

```typescript
import { createClientTokenEndpoint } from '@aifabrix/miso-client';

app.get('/api/client-token', createClientTokenEndpoint(client, {
  clientTokenUri: '/api/client-token',
  expiresIn: 1800,
}));
```

See [backend-client-token.md](backend-client-token.md) for details and frontend usage.

## 5. Validate token and get user

Get the user token from the request (e.g. `Authorization: Bearer <token>`), then validate and fetch user:

```typescript
const token = client.getToken(req);  // from Authorization header

if (!token) {
  return res.status(401).json({ error: 'Unauthorized' });
}

const isValid = await client.validateToken(token);
if (!isValid) {
  return res.status(401).json({ error: 'Unauthorized' });
}

const user = await client.getUser(token);
req.user = user;
next();
```

## Frontend (DataClient)

In the browser, use DataClient with the server-provided client token. No `clientSecret` in the frontend.

```typescript
import { DataClient, autoInitializeDataClient } from '@aifabrix/miso-client';

// One-time: fetches config (and token) from backend; use same path as your client-token route
const dataClient = await autoInitializeDataClient({ clientTokenUri: '/api/client-token' });
const users = await dataClient.get('/api/users');
```

See [dataclient.md](dataclient.md) for full options.

## Next steps

- [Authentication](authentication.md) – login, logout, refresh
- [Authorization](authorization.md) – roles and permissions
- [Audit and logging](audit-and-logging.md) – audit events and logs
- [Errors](errors.md) – asyncHandler, handleRouteError, AppError
