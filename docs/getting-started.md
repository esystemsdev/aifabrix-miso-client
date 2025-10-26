# Getting Started

This guide will help you get up and running with the AI Fabrix Miso Client SDK quickly.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **NPM**: Version 9.0.0 or higher
- **AI Fabrix Controller**: Access to an AI Fabrix controller instance
- **Redis** (Optional): For caching and improved performance

## Installation

Install the SDK using your preferred package manager:

```bash
# Using npm
npm install @aifabrix/miso-client

# Using yarn
yarn add @aifabrix/miso-client

# Using pnpm
pnpm add @aifabrix/miso-client
```

## Basic Setup

### 1. Import the SDK

```typescript
import { MisoClient } from '@aifabrix/miso-client';
```

### 2. Create Client Instance

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev', // or 'tst', 'pro'
  applicationKey: 'your-application-key'
});
```

### 3. Initialize the Client

```typescript
await client.initialize();
console.log('MisoClient initialized successfully');
```

## Complete Example

Here's a complete example showing basic usage:

```typescript
import { MisoClient } from '@aifabrix/miso-client';

async function main() {
  // Create client instance
  const client = new MisoClient({
    controllerUrl: 'https://controller.aifabrix.ai',
    environment: 'dev',
    applicationKey: 'my-app',
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'your-redis-password' // Optional
    },
    logLevel: 'info'
  });

  try {
    // Initialize the client
    await client.initialize();
    console.log('✅ Client initialized successfully');

    // Example: Validate a user token
    const userToken = 'your-jwt-token-here';
    const isValid = await client.validateToken(userToken);

    if (isValid) {
      console.log('✅ Token is valid');

      // Get user information
      const user = await client.getUser(userToken);
      console.log('👤 User:', user);

      // Check user roles
      const roles = await client.getRoles(userToken);
      console.log('🔑 User roles:', roles);

      // Check specific role
      const isAdmin = await client.hasRole(userToken, 'admin');
      console.log('👑 Is admin:', isAdmin);

      // Log an event
      await client.log.info('User accessed application', {
        userId: user?.id,
        username: user?.username
      });
    } else {
      console.log('❌ Token is invalid');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Clean up
    await client.disconnect();
    console.log('🔌 Client disconnected');
  }
}

// Run the example
main().catch(console.error);
```

## Configuration Options

### Required Configuration

```typescript
const config = {
  controllerUrl: 'https://controller.aifabrix.ai', // AI Fabrix controller URL
  environment: 'dev', // Environment: 'dev' | 'tst' | 'pro'
  applicationKey: 'your-app-key' // Your application identifier
};
```

### Optional Configuration

```typescript
const config = {
  // ... required config above ...

  // Redis configuration (optional)
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0,
    keyPrefix: 'miso:'
  },

  // Logging configuration
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'

  // Cache configuration
  cache: {
    roleTTL: 900, // Role cache TTL in seconds (default: 15 minutes)
    permissionTTL: 900 // Permission cache TTL in seconds (default: 15 minutes)
  }
};
```

## Environment Variables

You can also configure the client using environment variables:

```bash
# Required
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
MISO_ENVIRONMENT=dev
MISO_APPLICATION_KEY=your-app-key

# Optional
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
MISO_LOG_LEVEL=info
```

```typescript
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  environment: process.env.MISO_ENVIRONMENT as 'dev' | 'tst' | 'pro',
  applicationKey: process.env.MISO_APPLICATION_KEY!,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  logLevel: process.env.MISO_LOG_LEVEL as any
});
```

## Browser Usage

The SDK also works in browser environments:

```typescript
// In a React component
import { MisoClient } from '@aifabrix/miso-client';
import { useEffect, useState } from 'react';

function App() {
  const [client, setClient] = useState<MisoClient | null>(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const misoClient = new MisoClient({
      controllerUrl: 'https://controller.aifabrix.ai',
      environment: 'dev',
      applicationKey: 'my-react-app',
    });

    misoClient.initialize().then(() => {
      setClient(misoClient);
    });

    return () => {
      misoClient.disconnect();
    };
  }, []);

  const handleLogin = () => {
    if (client) {
      // In browser, this will redirect to login page
      client.login(window.location.href);
    }
  };

  return (
    <div>
      <button onClick={handleLogin}>Login</button>
      {user && <p>Welcome, {user.username}!</p>}
    </div>
  );
}
```

## Next Steps

Now that you have the basic setup working, explore these topics:

- **[API Reference](api-reference.md)** - Complete API documentation
- **[Configuration](configuration.md)** - Detailed configuration options
- **[Examples](examples.md)** - Practical usage examples
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

## Common Patterns

### Middleware Pattern (Express.js)

```typescript
import { Request, Response, NextFunction } from 'express';
import { MisoClient } from '@aifabrix/miso-client';

const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  environment: process.env.MISO_ENVIRONMENT as any,
  applicationKey: process.env.MISO_APPLICATION_KEY!
});

// Authentication middleware
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const isValid = await client.validateToken(token);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = await client.getUser(token);
  req.user = user;
  next();
}

// Role-based authorization middleware
export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const hasRole = await client.hasRole(token, role);
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
```

### Error Handling

```typescript
try {
  const isValid = await client.validateToken(token);
  if (!isValid) {
    throw new Error('Invalid token');
  }

  const user = await client.getUser(token);
  // ... use user data
} catch (error) {
  // Log the error
  await client.log.error('Authentication failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    token: token.substring(0, 10) + '...' // Log partial token for debugging
  });

  // Handle the error appropriately
  console.error('Authentication error:', error);
}
```

## Support

If you encounter any issues:

1. Check the **[Troubleshooting](troubleshooting.md)** guide
2. Review the **[API Reference](api-reference.md)** for detailed method documentation
3. Open an issue on [GitHub](https://github.com/aifabrix/aifabrix-miso/issues)
4. Contact support at <support@aifabrix.ai>
