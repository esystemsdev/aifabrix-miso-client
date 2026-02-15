# Backend Client Token

Expose a client token to the frontend via one backend route. The frontend never sees `clientId` or `clientSecret`; it only receives a short-lived token and a refresh mechanism.

## Why

- **Security:** `clientSecret` stays on the server. Browsers only get a token.
- **Compliance:** Aligns with “server-provided client token” pattern (same idea as the Python SDK).

## Environment variables

On the backend, ensure these are set (e.g. in `.env`):

```bash
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
```

Never expose `MISO_CLIENTSECRET` to the frontend.

## Backend: one route

Use the SDK helper to add a route that returns a client token (and optional DataClient config):

```typescript
import { MisoClient, loadConfig, createClientTokenEndpoint } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

app.get('/api/client-token', createClientTokenEndpoint(client, {
  clientTokenUri: '/api/client-token',
  expiresIn: 1800,
}));
```

Or return only token and expiry yourself:

```typescript
const token = await client.getEnvironmentToken();
res.json({ token, expiresIn: 1800 });
```

**Response shape:**

- `token` (string) – client token for `x-client-token` header
- `expiresIn` (number) – seconds until expiry
- `config` (optional) – DataClient config when using `createClientTokenEndpoint` with `includeConfig: true` (default)

The frontend uses this to call the controller (e.g. via DataClient) without ever having the secret.

## Frontend: one-liner setup

The frontend fetches config and token from your backend and uses DataClient for API calls:

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

const dataClient = await autoInitializeDataClient({ clientTokenUri: '/api/client-token' });
// dataClient uses the backend route for token and refresh
```

Use the same path as your backend route (`/api/client-token`). DataClient will call it for the token and when refresh is needed.

See [dataclient.md](dataclient.md) for full DataClient options and [quick-start.md](quick-start.md) for minimal backend + frontend flow.
