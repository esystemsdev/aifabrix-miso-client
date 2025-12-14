# Troubleshooting

Common issues and solutions when using the AI Fabrix Miso Client SDK.

## Table of Contents

- [Connection Issues](#connection-issues)
- [Authentication Problems](#authentication-problems)
- [Redis Connection Issues](#redis-connection-issues)
- [Performance Issues](#performance-issues)
- [Configuration Errors](#configuration-errors)
- [Logging Issues](#logging-issues)
- [Browser-Specific Issues](#browser-specific-issues)
- [Debugging Tips](#debugging-tips)
- [Getting Help](#getting-help)

## Connection Issues

### Controller Connection Failed

**You need to:** Fix connection issues with the controller.

**Here's how:** Verify configuration and test connectivity.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const config = loadConfig(); // Automatically loads from .env
console.log('Controller URL:', config.controllerUrl);

const client = new MisoClient(config);
```

**What happens:**

- `loadConfig()` validates all required environment variables
- Throws error if `MISO_CLIENTID` or `MISO_CLIENTSECRET` not set
- Automatically loads `MISO_CONTROLLER_URL` from environment

**Test connectivity:**

```bash
# Test if controller is reachable
curl -I https://controller.aifabrix.ai/health

# Test from your application environment
ping controller.aifabrix.ai
```

**Check firewall settings:**

```bash
# Check if port is blocked
telnet controller.aifabrix.ai 443

# Check firewall rules
sudo ufw status
```

### SSL/TLS Certificate Issues

**You need to:** Fix SSL certificate verification errors.

**Here's how:** Update Node.js and CA certificates.

```bash
# Update to latest Node.js version
node --version
npm install -g n
n latest

# On Ubuntu/Debian
sudo apt-get update && sudo apt-get install ca-certificates

# On CentOS/RHEL
sudo yum update ca-certificates
```

**Development only (self-signed certificates):**

```typescript
// Only for development with self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

## Authentication Problems

### Token Validation Failed

**You need to:** Fix token validation failures.

**Here's how:** Check token format and debug validation.

```typescript
// Verify token format
const token = req.headers.authorization?.replace('Bearer ', '');

if (!token) {
  console.error('No token provided');
  return;
}

// Check if token looks like a JWT
const parts = token.split('.');
if (parts.length !== 3) {
  console.error('Invalid token format');
  return;
}
```

**Debug token validation:**

```typescript
try {
  const isValid = await client.validateToken(token);
  console.log('Token validation result:', isValid);

  if (!isValid) {
    const user = await client.getUser(token);
    console.log('User info:', user);
  }
} catch (error) {
  console.error('Token validation error:', error);
}
```

**Check token expiration:**

```typescript
// Decode JWT payload (for debugging)
function decodeJWT(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token payload:', payload);
    console.log('Expires at:', new Date(payload.exp * 1000));
    console.log('Current time:', new Date());
    return payload;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}
```

### User Information Not Retrieved

**You need to:** Fix issues retrieving user information.

**Here's how:** Verify token validity first, then fetch user info.

```typescript
const isValid = await client.validateToken(token);
if (!isValid) {
  console.error('Token is invalid, cannot get user info');
  return;
}

const user = await client.getUser(token);
console.log('User info:', user);
```

## Redis Connection Issues

### Redis Connection Failed

**You need to:** Fix Redis connection failures.

**Here's how:** Check Redis server status and configuration.

**Check Redis server status:**

```bash
# Check if Redis is running
redis-cli ping

# Check Redis status
systemctl status redis

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

**Verify Redis configuration:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient(loadConfig());

await client.initialize();
console.log('Redis connected:', client.isRedisConnected());
```

**Test Redis connection manually:**

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 -a your-password ping

# Test specific database
redis-cli -h localhost -p 6379 -a your-password -n 0 ping
```

**Handle Redis failures gracefully:**

```typescript
try {
  await client.initialize();
} catch (error) {
  console.warn('Redis connection failed, using controller fallback:', error);
  // Client will automatically fall back to controller
}
```

**What happens:**

- SDK automatically falls back to controller when Redis fails
- No errors thrown - graceful degradation
- Cache operations skipped, direct controller calls used

### Redis Performance Issues

**You need to:** Improve Redis performance.

**Here's how:** Monitor Redis and optimize configuration.

**Monitor Redis performance:**

```bash
# Check Redis memory usage
redis-cli info memory

# Check Redis performance
redis-cli --latency

# Monitor Redis commands
redis-cli monitor
```

**Optimize cache configuration:**

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  cache: {
    roleTTL: 300, // Shorter TTL for better performance
    permissionTTL: 300
  }
});
```

## Performance Issues

### Slow Authentication Checks

**You need to:** Improve authentication performance.

**Here's how:** Enable Redis caching and optimize cache TTL.

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  cache: {
    roleTTL: 600, // 10 minutes
    permissionTTL: 300 // 5 minutes
  }
});
```

**Batch permission checks:**

```typescript
// Instead of multiple individual checks
const permissions = await client.getPermissions(token);
const hasCreatePermission = permissions.includes('create:posts');
const hasEditPermission = permissions.includes('edit:posts');
```

### Memory Usage Issues

**You need to:** Monitor and reduce memory usage.

**Here's how:** Add memory monitoring and properly dispose resources.

```typescript
// Add memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB'
  });
}, 60000);
```

**Properly dispose resources:**

```typescript
// Always disconnect when done
process.on('SIGINT', async () => {
  await client.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await client.disconnect();
  process.exit(0);
});
```

## Configuration Errors

### Invalid Configuration

**You need to:** Fix configuration errors.

**Here's how:** Validate configuration at startup.

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
// loadConfig() automatically validates required variables
const config = loadConfig(); // Throws error if invalid
const client = new MisoClient(config);
```

**Check environment variables:**

```typescript
// Log configuration (without sensitive data)
console.log('Configuration:', {
  controllerUrl: process.env.MISO_CONTROLLER_URL,
  clientId: process.env.MISO_CLIENTID,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT
  // Don't log passwords or secrets!
});
```

### Missing Environment Variables

**You need to:** Fix missing environment variables.

**Here's how:** Use `loadConfig()` which validates all required variables.

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
// loadConfig() throws error if MISO_CLIENTID or MISO_CLIENTSECRET not set
const config = loadConfig();
const client = new MisoClient(config);
```

**What happens:**

- `loadConfig()` automatically validates all required environment variables
- Throws clear error messages if variables are missing
- No need for manual validation

## Logging Issues

### Event Emission Mode Not Working

**You need to:** Fix event emission mode when `emitEvents = true`.

**Here's how:** Verify configuration and register event listeners before logging.

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true // Ensure this is set to true
});

await client.initialize();

// Register event listeners BEFORE using logger
client.log.on('log', (logEntry: LogEntry) => {
  console.log('Log event received:', logEntry);
  // Save to database
});

// Now use logger - events will be emitted
await client.log.info('Test message');
```

**Check environment variable:**

```bash
# .env file
MISO_EMIT_EVENTS=true
```

**What happens:**

- When `emitEvents = true`, logs are emitted as events
- HTTP/Redis operations are completely skipped
- Event listeners must be registered before logging operations

→ [Event Emission Mode Guide](configuration.md#event-emission-mode)

### Logs Not Appearing

**You need to:** Fix missing log output.

**Here's how:** Check log level configuration and test logging.

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  logLevel: 'debug' // Ensure appropriate log level
});

// Test different log levels
await client.log.info('Test info message');
await client.log.error('Test error message');
await client.log.audit('test.action', 'test-resource', { test: true });
```

**Test controller logging endpoint:**

```bash
# Test controller logging endpoint
curl -X POST https://controller.aifabrix.ai/logs \
  -H "Content-Type: application/json" \
  -d '{"level":"info","message":"test","environment":"dev","application":"test-app"}'
```

### Log Performance Issues

**You need to:** Improve logging performance.

**Here's how:** Use appropriate log levels and batch operations.

```typescript
// Production: Use warn or error only
const client = new MisoClient({
  ...loadConfig(),
  logLevel: 'warn'
});
```

## Browser-Specific Issues

### CORS Issues

**You need to:** Fix CORS policy errors.

**Here's how:** Configure CORS on controller or use proxy in development.

**Configure CORS on Controller:**

```typescript
// Controller should allow your domain
app.use(
  cors({
    origin: ['https://yourdomain.com', 'http://localhost:3000'],
    credentials: true
  })
);
```

**Use proxy in development:**

```javascript
// package.json
{
  "proxy": "https://controller.aifabrix.ai"
}
```

### Token Storage Issues

**You need to:** Fix token persistence issues.

**Here's how:** Use secure token storage and handle expiration.

```typescript
// Store token securely
function storeToken(token: string) {
  // Use httpOnly cookies in production
  if (process.env.NODE_ENV === 'production') {
    // Set httpOnly cookie
    document.cookie = `auth_token=${token}; secure; httpOnly; sameSite=strict`;
  } else {
    // Use localStorage in development
    localStorage.setItem('auth_token', token);
  }
}

// Check token expiration
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}
```

## Debugging Tips

### Enable Debug Logging

```typescript
// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient({
  ...loadConfig(),
  logLevel: 'debug'
});

// Enable detailed logging
await client.log.debug('Debug message', { context: 'debug' });
```

### Monitor Client Status

```typescript
// Monitor client status
setInterval(() => {
  console.log('Client Status:', {
    initialized: client.isInitialized(),
    redisConnected: client.isRedisConnected(),
    config: client.getConfig()
  });
}, 30000);
```

### Test Individual Components

```typescript
// Test individual services
async function testServices() {
  try {
    // Test authentication
    const isValid = await client.validateToken('test-token');
    console.log('Auth test:', isValid);

    // Test Redis
    console.log('Redis status:', client.isRedisConnected());

    // Test logging
    await client.log.info('Test log message');
    console.log('Logging test: OK');
  } catch (error) {
    console.error('Service test failed:', error);
  }
}
```

## Error Codes

### Common HTTP Status Codes

| Code | Meaning               | Solution               |
| ---- | --------------------- | ---------------------- |
| 200  | Success               | Normal operation       |
| 401  | Unauthorized          | Check token validity   |
| 403  | Forbidden             | Check user permissions |
| 404  | Not Found             | Check controller URL   |
| 500  | Internal Server Error | Check controller logs  |

### Common Error Messages

| Error            | Cause                 | Solution               |
| ---------------- | --------------------- | ---------------------- |
| `ECONNREFUSED`   | Connection refused    | Check network/firewall |
| `ENOTFOUND`      | DNS resolution failed | Check hostname         |
| `ETIMEDOUT`      | Connection timeout    | Check network latency  |
| `CERT_UNTRUSTED` | SSL certificate issue | Update certificates    |

### Structured Error Responses

**You need to:** Handle structured error responses from the controller.

**Here's how:** Use MisoClientError to access structured error details.

```typescript
import { MisoClientError } from '@aifabrix/miso-client';

try {
  await client.validateToken(token);
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    // Access structured error details
    console.error('Error Type:', error.errorResponse.type);
    console.error('Error Title:', error.errorResponse.title);
    console.error('Error Messages:', error.errorResponse.errors);
    console.error('Status Code:', error.errorResponse.statusCode);
    console.error('Instance URI:', error.errorResponse.instance);
    
    // The error message is automatically set from title or first error
    console.error('Message:', error.message);
  } else if (error instanceof MisoClientError) {
    // Fallback for non-structured errors (backward compatibility)
    console.error('Error Body:', error.errorBody);
    console.error('Status Code:', error.statusCode);
  }
}
```

**What happens:**

- SDK automatically parses RFC 7807-style structured error responses
- Provides detailed error information including type, title, and specific error messages
- Falls back to legacy error format for backward compatibility

## Getting Help

### Self-Service Resources

1. **Check Documentation**:
   - [Getting Started](getting-started.md)
   - [API Reference](api-reference.md)
   - [Configuration](configuration.md)
   - [Examples](examples.md)

2. **Enable Debug Logging**:

   ```typescript
   // ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
   const client = new MisoClient({
     ...loadConfig(),
     logLevel: 'debug'
   });
   ```

3. **Test with Minimal Configuration**:

   ```typescript
   // ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
   const client = new MisoClient(loadConfig());
   ```

### Community Support

1. **GitHub Issues**: [https://github.com/aifabrix/aifabrix-miso/issues](https://github.com/aifabrix/aifabrix-miso/issues)
2. **Documentation**: [https://docs.aifabrix.ai](https://docs.aifabrix.ai)

### Professional Support

1. **Email**: <support@aifabrix.ai>
2. **Enterprise Support**: Available for enterprise customers

### Reporting Issues

When reporting issues, please include:

1. **Environment Information**:

   ```bash
   node --version
   npm --version
   ```

2. **Configuration** (without sensitive data):

   ```typescript
   console.log('Config:', {
     controllerUrl: config.controllerUrl,
     clientId: config.clientId,
     redisHost: config.redis?.host,
     redisPort: config.redis?.port
     // Don't log clientSecret!
   });
   ```

3. **Error Details**:

   ```typescript
   import { MisoClientError } from '@aifabrix/miso-client';

   try {
     // Your code here
   } catch (error) {
     if (error instanceof MisoClientError) {
       console.error('Full error:', {
         message: error.message,
         stack: error.stack,
         name: error.name,
         statusCode: error.statusCode,
         errorResponse: error.errorResponse,
         errorBody: error.errorBody
       });
     } else {
       console.error('Full error:', {
         message: error.message,
         stack: error.stack,
         name: error.name
       });
     }
   }
   ```

4. **Steps to Reproduce**:
   - Clear steps to reproduce the issue
   - Expected vs actual behavior
   - Any relevant logs or error messages
