# MisoClient API Reference

Complete API reference for the MisoClient class - the main client that provides access to all SDK functionality.

## Table of Contents

- [Constructor](#constructor)
- [Initialization Methods](#initialization-methods)
- [Configuration Methods](#configuration-methods)
- [Origin Validation](#origin-validation)
- [Examples](#examples)
- [See Also](#see-also)

## Constructor

```typescript
constructor(config: MisoClientConfig)
```

Creates a new MisoClient instance with the provided configuration.

**Parameters:**

- `config` - Configuration object (see [Configuration Types](./reference-types.md#misoclientconfig))

**Example:**

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Recommended: Use loadConfig() to load from .env
const client = new MisoClient(loadConfig());

// Or manually:
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret'
});
```

## Initialization Methods

### `initialize(): Promise<void>`

Initializes the client and establishes connections (Redis if configured).

**Returns:** Promise that resolves when initialization is complete

**Example:**

```typescript
await client.initialize();
console.log('Client ready');
```

### `disconnect(): Promise<void>`

Disconnects from Redis and cleans up resources.

**Returns:** Promise that resolves when disconnection is complete

**Example:**

```typescript
await client.disconnect();
```

### `isInitialized(): boolean`

Checks if the client has been initialized.

**Returns:** `true` if initialized, `false` otherwise

**Example:**

```typescript
if (client.isInitialized()) {
  // Client is ready to use
}
```

## Configuration Methods

### `getConfig(): MisoClientConfig`

Gets the current configuration (returns a copy).

**Returns:** Configuration object

**Example:**

```typescript
const config = client.getConfig();
console.log('Controller URL:', config.controllerUrl);
```

### `isRedisConnected(): boolean`

Checks if Redis is connected.

**Returns:** `true` if Redis is connected, `false` otherwise

**Example:**

```typescript
if (client.isRedisConnected()) {
  console.log('Using Redis caching');
} else {
  console.log('Using controller fallback');
}
```

## Origin Validation

### `validateOrigin(req: Request, allowedOrigins?: string[]): OriginValidationResult`

Validates request origin against configured allowed origins. Uses `allowedOrigins` from client configuration if not provided. This method is useful for CORS validation and securing API endpoints.

**Parameters:**

- `req` - Express Request object
- `allowedOrigins` - Optional array of allowed origins (defaults to `config.allowedOrigins`). Supports wildcard ports like `http://localhost:*`

**Returns:** `OriginValidationResult` object with:

- `valid: boolean` - Whether the origin is allowed
- `error?: string` - Optional error message if validation fails

**Features:**

- Case-insensitive matching
- Trailing slash normalization
- Wildcard port support (`http://localhost:*` matches any port)
- Falls back to `referer` header if `origin` header is missing
- Returns `{ valid: true }` if no `allowedOrigins` are configured (backward compatibility)

**Example:**

```typescript
import { MisoClient, Request } from '@aifabrix/miso-client';
import express from 'express';

const app = express();
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  allowedOrigins: [
    'https://myapp.com',
    'http://localhost:*', // Wildcard port support
  ],
});

// Middleware using config allowedOrigins
app.use('/api/protected', (req, res, next) => {
  const result = client.validateOrigin(req);
  
  if (!result.valid) {
    return res.status(403).json({
      error: 'Forbidden',
      message: result.error,
    });
  }
  
  next();
});

// Override with custom origins
app.use('/api/custom', (req, res, next) => {
  const result = client.validateOrigin(req, [
    'https://custom-domain.com',
  ]);
  
  if (!result.valid) {
    return res.status(403).json({ error: result.error });
  }
  
  next();
});
```

**Wildcard Port Example:**

```typescript
const client = new MisoClient({
  ...config,
  allowedOrigins: ['http://localhost:*'], // Matches any port
});

// All of these will pass validation:
// - http://localhost:3000
// - http://localhost:8080
// - http://localhost:5000
```

**See Also:**

- [Standalone Utilities](./reference-utilities.md#standalone-utilities) - Standalone `validateOrigin` utility function
- [Configuration Guide](./configuration.md) - Complete configuration documentation

## Examples

### Basic Initialization

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Initialize with environment variables
const client = new MisoClient(loadConfig());
await client.initialize();

// Check if initialized
if (client.isInitialized()) {
  console.log('Client ready');
}

// Get configuration
const config = client.getConfig();
console.log('Controller URL:', config.controllerUrl);
```

### Configuration Example

```typescript
import { MisoClient } from '@aifabrix/miso-client';

const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  controllerPublicUrl: 'https://controller.aifabrix.ai',
  controllerPrivateUrl: 'http://miso-controller:3010',
  clientId: 'ctrl-dev-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET,
  redis: {
    host: 'localhost',
    port: 6379,
  },
  logLevel: 'info',
  allowedOrigins: [
    'https://myapp.com',
    'http://localhost:*',
  ],
});

await client.initialize();
```

### Origin Validation Example

```typescript
import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
const client = new MisoClient(loadConfig());
await client.initialize();

// Protect routes with origin validation
app.use('/api/protected', (req, res, next) => {
  const result = client.validateOrigin(req);
  
  if (!result.valid) {
    return res.status(403).json({
      error: 'Forbidden',
      message: result.error,
    });
  }
  
  next();
});
```

## Authentication & Authorization Methods

MisoClient provides access to authentication and authorization methods via `client.auth`, `client.roles`, `client.permissions`, and direct methods. For complete documentation, see:

- **[Authentication Reference](./reference-authentication.md)** - Token validation, login, logout, token refresh, user info
- **[Authorization Reference](./reference-authorization.md)** - Roles and permissions management

**Quick Reference:**

- `client.validateToken(token)` - Validate JWT token (with caching)
- `client.refreshToken(refreshToken)` - Refresh user access token
- `client.login(params)` - Initiate login flow
- `client.logout(params)` - Logout user (clears token cache)
- `client.getUser(token)` - Get user information
- `client.getRoles(token)` - Get user roles (cached)
- `client.hasRole(token, role)` - Check if user has role (cached)
- `client.getPermissions(token)` - Get user permissions (cached)
- `client.hasPermission(token, permission)` - Check if user has permission (cached)

## See Also

- [Configuration Types](./reference-types.md#misoclientconfig) - Complete type definitions
- [Authentication Methods](./reference-authentication.md) - User authentication, token validation, token refresh
- [Authorization Methods](./reference-authorization.md) - Roles and permissions
- [Service Classes](./reference-services.md) - Logging, caching, encryption services
- [Standalone Utilities](./reference-utilities.md#standalone-utilities) - Utility functions
- [Configuration Guide](./configuration.md) - Configuration best practices
- [Getting Started Guide](./getting-started.md) - Quick start tutorial
- [Examples](./examples/README.md) - Framework-specific examples
- **Example Files:**
  - [Environment Config Example](../examples/env-config-example.ts) - Configuration from .env file
  - [Manual Config Example](../examples/manual-config-example.ts) - Manual configuration setup
