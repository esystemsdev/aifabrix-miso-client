# DataClient

Browser-compatible HTTP client for front-end apps. Use zero-config (backend route + autoInitializeDataClient) or manual config. Main methods only.

## Security

**Never put `clientSecret` in browser code.** Use the server-provided client token: backend exposes one route that returns a token; the frontend uses that token. See [backend-client-token.md](backend-client-token.md).

## Zero-config (recommended)

**Backend:** One route with the SDK helper.

```typescript
import { MisoClient, loadConfig, createClientTokenEndpoint } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

app.get('/api/client-token', createClientTokenEndpoint(client, {
  clientTokenUri: '/api/client-token',
  expiresIn: 1800,
}));
```

**Frontend:** Initialize once (e.g. at app bootstrap). DataClient fetches config and token from your backend.

```typescript
import { autoInitializeDataClient, DataClient } from '@aifabrix/miso-client';

const dataClient = await autoInitializeDataClient({ clientTokenUri: '/api/client-token' });
```

Use the returned `dataClient` for all requests.

## Manual config

When you need custom settings (e.g. different baseUrl, cache, retry):

```typescript
import { DataClient } from '@aifabrix/miso-client';

const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientToken: initialToken,           // from your backend
    clientTokenExpiresAt: expiresAt,
    onClientTokenRefresh: async () => {
      const res = await fetch('/api/client-token', { credentials: 'include' });
      const data = await res.json();
      return { token: data.token, expiresIn: data.expiresIn };
    },
  },
  cache: { enabled: true, defaultTTL: 600 },
  retry: { enabled: true, maxRetries: 3 },
});
```

Do not set `clientSecret` in browser config; use `clientToken` + `onClientTokenRefresh` only.

## Main methods

**HTTP:**

```typescript
const users = await dataClient.get('/api/users');
const created = await dataClient.post('/api/users', { name: 'Jane' });
const updated = await dataClient.put('/api/users/1', { name: 'Jane Doe' });
await dataClient.patch('/api/users/1', { email: 'jane@example.com' });
await dataClient.delete('/api/users/1');
```

**Auth (user token from your app, e.g. stored after login):**

```typescript
const isValid = await dataClient.validateToken();
const user = await dataClient.getUser();
const hasPerm = await dataClient.hasPermission('users:read');
const hasRole = await dataClient.hasRole('admin');
```

DataClient sends the user token (e.g. from URL hash or your auth state) when calling these methods. Configure how the token is provided per your app (e.g. OAuth callback, storage).

### Custom token key (e.g. `miso_token`)

By default DataClient looks for the user token in localStorage under `token`, `accessToken`, or `authToken`. To use your own key (e.g. `miso_token`), set **`tokenKeys`**:

```typescript
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  tokenKeys: ['miso_token'],  // localStorage key(s) to read token from; first found is used
});
```

OAuth callback and redirect flows will store the token in these keys. Use the same `tokenKeys` with `autoInitializeDataClient` if you pass custom config.

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
