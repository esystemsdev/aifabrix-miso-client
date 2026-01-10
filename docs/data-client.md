# DataClient Browser Wrapper

The **DataClient** is a browser-compatible HTTP client wrapper around MisoClient that provides enhanced HTTP capabilities for React, Vue, and other front-end applications. It includes ISO 27001 compliant audit logging, automatic data masking, caching, retry logic, and more.

> **📖 For complete API reference, see [DataClient API Reference](./reference-dataclient.md)**

## Quick Start

### Installation

DataClient is included in the `@aifabrix/miso-client` package:

```bash
npm install @aifabrix/miso-client
```

### Zero-Config Setup (Recommended)

For the simplest setup with zero configuration, use the auto-initialization helpers:

**Server-side (one line):**

```typescript
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// One line - automatically includes DataClient config in response
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
```

**Client-side (one line):**

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - automatically fetches config and initializes DataClient
const dataClient = await autoInitializeDataClient();
```

**What happens:**

1. Server endpoint automatically enriches the token response with DataClient configuration
2. Client automatically fetches config from the server endpoint
3. DataClient is initialized with server-provided configuration
4. No environment variables needed in frontend build
5. Configuration is cached for faster subsequent page loads

### Manual Setup

Use manual setup when you need custom configuration:

```typescript
import { DataClient } from '@aifabrix/miso-client';

const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientTokenUri: '/api/v1/auth/client-token',
  },
  cache: {
    enabled: true,
    defaultTTL: 600,
  },
  retry: {
    enabled: true,
    maxRetries: 5,
  },
});
```

### ⚠️ Security Warning: Browser Usage

**IMPORTANT:** Never expose `clientSecret` in browser/client-side code. Client secrets are sensitive credentials that should only be used in server-side environments.

For browser applications, use the **Server-Provided Client Token Pattern** (zero-config setup above).

## Basic Usage

### Making HTTP Requests

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

const dataClient = await autoInitializeDataClient();

// GET request with caching
const users = await dataClient.get<User[]>('/api/users');

// POST request
const newUser = await dataClient.post<User>('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// PUT request
const updatedUser = await dataClient.put<User>('/api/users/123', {
  name: 'Jane Doe',
});

// DELETE request
await dataClient.delete('/api/users/123');
```

### Authentication & Authorization

```typescript
// Validate token
const isValid = await dataClient.validateToken();

// Get user info
const user = await dataClient.getUser();

// Check permissions
const hasPermission = await dataClient.hasPermission('users:read');

// Check roles
const hasRole = await dataClient.hasRole('admin');
```

### React Example

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';
import { useEffect, useState } from 'react';

function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const dataClient = await autoInitializeDataClient();
        const data = await dataClient.get('/api/users');
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## Features

- **ISO 27001 Compliant Audit Logging** - Automatic audit trail for all HTTP requests with sensitive data masking
- **Response Caching** - In-memory cache with configurable TTL for GET requests
- **Automatic Retry** - Exponential backoff retry logic for retryable errors
- **Request Deduplication** - Prevents duplicate concurrent requests
- **Request Metrics** - Track response times, error rates, and cache performance
- **Browser Compatibility** - Works in React, Vue, Angular, and other front-end frameworks
- **SSR Support** - Graceful degradation for server-side rendering

## See Also

- [DataClient API Reference](./reference-dataclient.md) - Complete API reference with detailed method signatures
- [Getting Started Guide](./getting-started.md) - Quick start tutorial
- [Configuration Guide](./configuration.md) - Configuration options
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
