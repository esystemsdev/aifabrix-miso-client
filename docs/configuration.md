# Configuration Guide

Complete guide to configuring the AI Fabrix Miso Client SDK.

## Table of Contents

- [Why Use .env?](#why-use-env)
- [Basic Configuration](#basic-configuration)
- [Redis Configuration](#redis-configuration)
- [Environment Variables](#environment-variables)
- [Cache Configuration](#cache-configuration)
- [Logging Configuration](#logging-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Configuration Examples](#configuration-examples)
- [Best Practices](#best-practices)

## Why Use .env?

**Recommended approach:** Use environment variables in a `.env` file with `loadConfig()`.

### The Simple Way (Recommended)

```bash
# .env file
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
REDIS_HOST=localhost
```

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Automatically loads from .env - that's it!
const client = new MisoClient(loadConfig());
await client.initialize();
```

**Benefits:**
- ✅ No configuration boilerplate
- ✅ Easy environment switching (dev/test/prod)
- ✅ Keeps secrets out of code
- ✅ Standard practice across frameworks
- ✅ Team-friendly
- ✅ CI/CD ready

### When to Use Manual Configuration

Use manual configuration when:
- You need dynamic configuration
- Config comes from an external service
- You're integrating with an existing config system
- You have special requirements

**Example:**

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-secret',
  redis: {
    host: 'localhost',
    port: 6379,
  },
});
```

**Most developers use .env.** The rest of this guide covers both approaches.

---

## Basic Configuration

### Required Configuration

The following configuration options are required for the MisoClient to function:

```typescript
interface MisoClientConfig {
  controllerUrl: string; // Required: AI Fabrix controller URL
  clientId: string; // Required: Client ID (e.g., 'ctrl-dev-my-app')
  clientSecret: string; // Required: Client secret
  redis?: RedisConfig; // Optional: Redis configuration for caching
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Optional: Logging level
  cache?: {
    roleTTL?: number; // Optional: Role cache TTL in seconds (default: 900)
    permissionTTL?: number; // Optional: Permission cache TTL in seconds (default: 900)
  };
}
```

**Example:**

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: 'your-client-secret-here'
});
```

**Recommended:** Use `loadConfig()` to load from `.env` automatically:

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
```

### Configuration Details

#### `controllerUrl`

- **Type**: `string`
- **Required**: Yes
- **Description**: The base URL of your AI Fabrix controller instance
- **Examples**:
  - `https://controller.aifabrix.ai`
  - `https://miso.yourcompany.com`
  - `http://localhost:3000` (for development)

#### `clientId`

- **Type**: `string`
- **Required**: Yes
- **Description**: Client ID for authenticating with the controller
- **Examples**:
  - `'ctrl-dev-my-app'`
  - `'ctrl-pro-production-app'`
- **Security**: Store in environment variables, never hardcode

#### `clientSecret`

- **Type**: `string`
- **Required**: Yes
- **Description**: Client secret for authenticating with the controller
- **Security**: Store in environment variables, never hardcode
- **Note**: The client token is automatically fetched and managed by the SDK

## Redis Configuration

Redis is optional but recommended for improved performance through caching.

### RedisConfig Interface

```typescript
interface RedisConfig {
  host: string; // Required: Redis host
  port: number; // Required: Redis port
  password?: string; // Optional: Redis password
  db?: number; // Optional: Redis database number
  keyPrefix?: string; // Optional: Key prefix
}
```

### Redis Configuration Options

#### `host`

- **Type**: `string`
- **Required**: Yes
- **Description**: Redis server hostname or IP address
- **Examples**:
  - `'localhost'`
  - `'redis.example.com'`
  - `'192.168.1.100'`

#### `port`

- **Type**: `number`
- **Required**: Yes
- **Description**: Redis server port
- **Default**: `6379`
- **Examples**:
  - `6379` (standard Redis port)
  - `6380` (Redis with TLS)
  - `16379` (custom port)

#### `password`

- **Type**: `string`
- **Required**: No
- **Description**: Redis authentication password
- **Security**: Store in environment variables, never hardcode

#### `db`

- **Type**: `number`
- **Required**: No
- **Description**: Redis database number (0-15)
- **Default**: `0`

#### `keyPrefix`

- **Type**: `string`
- **Required**: No
- **Description**: Prefix for all Redis keys
- **Default**: `'miso:'`
- **Examples**:
  - `'miso:'`
  - `'myapp:miso:'`
  - `'prod:miso:'`

### Redis Configuration Examples

#### Basic Redis Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
  redis: {
    host: 'localhost',
    port: 6379
  }
});
```

#### Redis with Authentication

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET,
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 1,
    keyPrefix: 'prod:miso:'
  }
});
```

#### Redis Cluster Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET,
  redis: {
    host: 'redis-cluster.example.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'cluster:miso:'
  }
});
```

## Environment Variables

You can configure the client using environment variables for better security and flexibility.

### Environment Variable Names

```bash
# Required
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret-here

# Optional: Logging level
MISO_LOG_LEVEL=info

# Optional Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
REDIS_KEY_PREFIX=miso:

# Optional Logging
MISO_LOG_LEVEL=info
```

### Loading Configuration from Environment

```typescript
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  environment: process.env.MISO_ENVIRONMENT as 'dev' | 'tst' | 'pro',
  applicationKey: process.env.MISO_APPLICATION_KEY!,
  applicationId: process.env.MISO_APPLICATION_ID!,
  apiKey: process.env.MISO_API_KEY,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'miso:'
  },
  logLevel: process.env.MISO_LOG_LEVEL as any
});
```

### Environment-Specific Configuration

#### Development Environment

```bash
# .env.development
MISO_CONTROLLER_URL=http://localhost:3000
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-dev-secret
REDIS_HOST=localhost
REDIS_PORT=6379
MISO_LOG_LEVEL=debug
```

#### Test Environment

```bash
# .env.test
MISO_CONTROLLER_URL=https://test-controller.aifabrix.ai
MISO_CLIENTID=ctrl-test-my-app
MISO_CLIENTSECRET=your-test-secret
REDIS_HOST=test-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=test-password
MISO_LOG_LEVEL=info
```

#### Production Environment

```bash
# .env.production
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
MISO_CLIENTID=ctrl-pro-my-app
MISO_CLIENTSECRET=your-prod-secret
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=secure-password
REDIS_DB=1
REDIS_KEY_PREFIX=prod:miso:
MISO_LOG_LEVEL=warn
```

## Cache Configuration

Configure caching behavior for roles and permissions.

### Cache Configuration Interface

```typescript
interface CacheConfig {
  roleTTL?: number; // Role cache TTL in seconds
  permissionTTL?: number; // Permission cache TTL in seconds
}
```

### Cache Configuration Options

#### `roleTTL`

- **Type**: `number`
- **Required**: No
- **Description**: Time-to-live for role cache in seconds
- **Default**: `900` (15 minutes)
- **Recommended**: `300` - `1800` (5-30 minutes)

#### `permissionTTL`

- **Type**: `number`
- **Required**: No
- **Description**: Time-to-live for permission cache in seconds
- **Default**: `900` (15 minutes)
- **Recommended**: `300` - `1800` (5-30 minutes)

### Cache Configuration Examples

#### Short Cache Duration (High Security)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'pro',
  applicationKey: 'secure-app',
  cache: {
    roleTTL: 300, // 5 minutes
    permissionTTL: 300 // 5 minutes
  }
});
```

#### Long Cache Duration (High Performance)

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'dev-app',
  cache: {
    roleTTL: 1800, // 30 minutes
    permissionTTL: 1800 // 30 minutes
  }
});
```

#### Custom Cache Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'pro',
  applicationKey: 'my-app',
  cache: {
    roleTTL: 600, // 10 minutes for roles
    permissionTTL: 300 // 5 minutes for permissions
  }
});
```

## Logging Configuration

Configure logging behavior and levels.

### Log Level Options

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

#### `debug`

- **Description**: Logs all messages including debug information
- **Use Case**: Development and debugging
- **Performance**: Lowest performance due to verbose logging

#### `info`

- **Description**: Logs informational messages and above
- **Use Case**: General application logging
- **Performance**: Good balance of information and performance

#### `warn`

- **Description**: Logs warning messages and errors only
- **Use Case**: Production environments
- **Performance**: High performance, minimal logging

#### `error`

- **Description**: Logs only error messages
- **Use Case**: Critical production environments
- **Performance**: Highest performance, minimal logging

### Logging Configuration Examples

#### Development Logging

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'dev-app',
  logLevel: 'debug'
});
```

#### Production Logging

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'pro',
  applicationKey: 'prod-app',
  logLevel: 'warn'
});
```

#### Conditional Logging

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: process.env.NODE_ENV === 'production' ? 'pro' : 'dev',
  applicationKey: 'my-app',
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
});
```

## Advanced Configuration

### Custom HTTP Client Configuration

The SDK uses axios internally. You can extend the configuration by accessing the HttpClient:

```typescript
import { HttpClient } from '@aifabrix/miso-client';

class CustomHttpClient extends HttpClient {
  constructor(config: MisoClientConfig) {
    super(config);

    // Add custom interceptors
    this.axios.interceptors.request.use(
      (config) => {
        // Add custom headers
        config.headers['X-Custom-Header'] = 'custom-value';
        return config;
      },
      (error) => Promise.reject(error)
    );
  }
}
```

### Custom Redis Configuration

For advanced Redis configurations, you can extend the RedisService:

```typescript
import { RedisService } from '@aifabrix/miso-client';
import Redis from 'ioredis';

class CustomRedisService extends RedisService {
  async connect(): Promise<void> {
    // Custom Redis connection logic
    this.redis = new Redis({
      host: this.config?.host,
      port: this.config?.port,
      password: this.config?.password,
      db: this.config?.db || 0,
      keyPrefix: this.config?.keyPrefix || 'miso:',

      // Custom Redis options
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,

      // Cluster configuration
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    });

    await this.redis.connect();
    this.connected = true;
  }
}
```

### Multi-Environment Configuration

```typescript
interface EnvironmentConfig {
  dev: MisoClientConfig;
  tst: MisoClientConfig;
  pro: MisoClientConfig;
}

const configs: EnvironmentConfig = {
  dev: {
    controllerUrl: 'http://localhost:3000',
    environment: 'dev',
    applicationKey: 'dev-app',
    redis: {
      host: 'localhost',
      port: 6379
    },
    logLevel: 'debug'
  },
  tst: {
    controllerUrl: 'https://test-controller.aifabrix.ai',
    environment: 'tst',
    applicationKey: 'test-app',
    redis: {
      host: 'test-redis.example.com',
      port: 6379,
      password: process.env.TEST_REDIS_PASSWORD
    },
    logLevel: 'info'
  },
  pro: {
    controllerUrl: 'https://controller.aifabrix.ai',
    environment: 'pro',
    applicationKey: 'prod-app',
    redis: {
      host: 'prod-redis.example.com',
      port: 6379,
      password: process.env.PROD_REDIS_PASSWORD,
      db: 1,
      keyPrefix: 'prod:miso:'
    },
    logLevel: 'warn',
    cache: {
      roleTTL: 600,
      permissionTTL: 300
    }
  }
};

const environment = process.env.NODE_ENV as keyof EnvironmentConfig;
const client = new MisoClient(configs[environment]);
```

## Configuration Examples

### Complete Configuration Examples

#### Minimal Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-dev-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET!
});
```

#### Full Configuration

```typescript
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  clientId: 'ctrl-pro-my-app',
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 1,
    keyPrefix: 'prod:miso:'
  },
  logLevel: 'warn',
  cache: {
    roleTTL: 600, // 10 minutes
    permissionTTL: 300 // 5 minutes
  }
});
```

#### Docker Configuration

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Recommended: Use loadConfig() which reads from .env
const client = new MisoClient(loadConfig());

// Or manually:
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  logLevel: process.env.MISO_LOG_LEVEL as any
});
```

#### Kubernetes Configuration

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Recommended: Use loadConfig() which reads from environment variables
const client = new MisoClient(loadConfig());

// Or manually:
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  clientId: process.env.MISO_CLIENTID!,
  clientSecret: process.env.MISO_CLIENTSECRET!,
  redis: {
    host: process.env.REDIS_SERVICE_HOST!,
    port: parseInt(process.env.REDIS_SERVICE_PORT!),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: `${process.env.POD_NAMESPACE}:miso:`
  },
  logLevel: 'info'
});
```

## Best Practices

### Security Best Practices

1. **Never hardcode sensitive information**:

   ```typescript
   // ❌ Bad
   const client = new MisoClient({
     controllerUrl: 'https://controller.aifabrix.ai',
     clientId: 'ctrl-pro-my-app',
     clientSecret: 'hardcoded-secret', // Never do this!
     redis: {
       host: 'redis.example.com',
       port: 6379,
       password: 'hardcoded-password' // Never do this!
     }
   });

   // ✅ Good - Use loadConfig() or environment variables
   const client = new MisoClient(loadConfig());
   
   // ✅ Good - Or manually from env vars
   const client = new MisoClient({
     controllerUrl: process.env.MISO_CONTROLLER_URL!,
     clientId: process.env.MISO_CLIENTID!,
     clientSecret: process.env.MISO_CLIENTSECRET!,
     redis: {
       host: process.env.REDIS_HOST!,
       port: parseInt(process.env.REDIS_PORT!),
       password: process.env.REDIS_PASSWORD
     },
     logLevel: process.env.MISO_LOG_LEVEL as any
   });
   ```

2. **Use environment-specific configurations**:

   ```typescript
   const config = {
     dev: {
       /* dev config */
     },
     tst: {
       /* test config */
     },
     pro: {
       /* prod config */
     }
   };

   const environment = process.env.NODE_ENV as keyof typeof config;
   const client = new MisoClient(config[environment]);
   ```

3. **Validate configuration at startup**:

   ```typescript
   function validateConfig(config: MisoClientConfig): void {
     if (!config.controllerUrl) {
       throw new Error('MISO_CONTROLLER_URL is required');
     }
     if (!config.clientId) {
       throw new Error('MISO_CLIENTID is required');
     }
     if (!config.clientSecret) {
       throw new Error('MISO_CLIENTSECRET is required');
     }
   }

   // Recommended: Use loadConfig()
   const config = loadConfig();
   validateConfig(config);
   const client = new MisoClient(config);
   
   // Or manually:
   const manualConfig = {
     controllerUrl: process.env.MISO_CONTROLLER_URL!,
     clientId: process.env.MISO_CLIENTID!,
     clientSecret: process.env.MISO_CLIENTSECRET!
   };
   validateConfig(manualConfig);
   const client2 = new MisoClient(manualConfig);
   ```

### Performance Best Practices

1. **Configure appropriate cache TTL**:

   ```typescript
   // High-security applications
   cache: {
     roleTTL: 300,        // 5 minutes
     permissionTTL: 300, // 5 minutes
   }

   // High-performance applications
   cache: {
     roleTTL: 1800,       // 30 minutes
     permissionTTL: 1800, // 30 minutes
   }
   ```

2. **Use Redis for production**:

   ```typescript
   // Always use Redis in production
   const client = new MisoClient({
     // ... other config
     redis: {
       host: process.env.REDIS_HOST!,
       port: parseInt(process.env.REDIS_PORT!),
       password: process.env.REDIS_PASSWORD
     }
   });
   ```

3. **Configure appropriate log levels**:

   ```typescript
   // Development
   logLevel: 'debug';

   // Production
   logLevel: 'warn';
   ```

### Configuration Management

1. **Use configuration files**:

   ```typescript
   // config/miso.config.ts
   export const misoConfig = {
     dev: {
       controllerUrl: 'http://localhost:3000',
       environment: 'dev' as const,
       applicationKey: 'dev-app',
       logLevel: 'debug' as const
     },
     pro: {
       controllerUrl: 'https://controller.aifabrix.ai',
       environment: 'pro' as const,
       applicationKey: 'prod-app',
       logLevel: 'warn' as const
     }
   };
   ```

2. **Centralize configuration**:

   ```typescript
   // config/index.ts
   import { misoConfig } from './miso.config';

   export function getMisoConfig() {
     const environment = process.env.NODE_ENV as keyof typeof misoConfig;
     return misoConfig[environment];
   }
   ```

3. **Use configuration validation**:

   ```typescript
   import { z } from 'zod';

   const misoConfigSchema = z.object({
     controllerUrl: z.string().url(),
     environment: z.enum(['dev', 'tst', 'pro']),
     applicationKey: z.string().min(1),
     redis: z
       .object({
         host: z.string(),
         port: z.number().min(1).max(65535),
         password: z.string().optional()
       })
       .optional()
   });

   const config = misoConfigSchema.parse(process.env);
   const client = new MisoClient(config);
   ```

This configuration guide provides comprehensive information about all available configuration options and best practices for using the AI Fabrix Miso Client SDK effectively.
