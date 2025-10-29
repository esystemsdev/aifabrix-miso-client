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
- [Error Codes](#error-codes)
- [Getting Help](#getting-help)

## Connection Issues

### Controller Connection Failed

**Symptoms:**

- `Failed to connect to controller`
- `Network error` or `ECONNREFUSED`
- Timeout errors

**Possible Causes:**

1. Incorrect controller URL
2. Network connectivity issues
3. Controller service is down
4. Firewall blocking connections

**Solutions:**

1. **Verify Controller URL**:

   ```typescript
   import { MisoClient, loadConfig } from '@aifabrix/miso-client';
   
   // Check if URL is correct
   console.log('Controller URL:', process.env.MISO_CONTROLLER_URL);

   // Test connectivity - loadConfig() automatically loads from .env
   const client = new MisoClient(loadConfig());
   ```

2. **Test Network Connectivity**:

   ```bash
   # Test if controller is reachable
   curl -I https://controller.aifabrix.ai/health

   # Test from your application environment
   ping controller.aifabrix.ai
   ```

3. **Check Firewall Settings**:

   ```bash
   # Check if port is blocked
   telnet controller.aifabrix.ai 443

   # Check firewall rules
   sudo ufw status
   ```

4. **Verify Environment Variables**:

   ```typescript
   import { loadConfig } from '@aifabrix/miso-client';
   
   // LoadConfig validates all required variables automatically
   const config = loadConfig(); // Throws error if MISO_CLIENTID or MISO_CLIENTSECRET not set
   ```

### SSL/TLS Certificate Issues

**Symptoms:**

- `SSL certificate verification failed`
- `CERT_UNTRUSTED` errors
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

**Solutions:**

1. **Update Node.js**:

   ```bash
   # Update to latest Node.js version
   node --version
   npm install -g n
   n latest
   ```

2. **Update CA Certificates**:

   ```bash
   # On Ubuntu/Debian
   sudo apt-get update && sudo apt-get install ca-certificates

   # On CentOS/RHEL
   sudo yum update ca-certificates
   ```

3. **Configure SSL Options** (Development Only):

   ```typescript
   // Only for development with self-signed certificates
   process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
   ```

## Authentication Problems

### Token Validation Failed

**Symptoms:**

- `validateToken()` returns `false`
- `401 Unauthorized` errors
- `Invalid token` messages

**Possible Causes:**

1. Expired token
2. Malformed token
3. Wrong token format
4. Controller authentication issues

**Solutions:**

1. **Check Token Format**:

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

2. **Debug Token Validation**:

   ```typescript
   try {
     const isValid = await client.validateToken(token);
     console.log('Token validation result:', isValid);

     if (!isValid) {
       // Try to get more details
       const user = await client.getUser(token);
       console.log('User info:', user);
     }
   } catch (error) {
     console.error('Token validation error:', error);
   }
   ```

3. **Check Token Expiration**:

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

**Symptoms:**

- `getUser()` returns `null`
- User object is incomplete
- Missing user roles

**Solutions:**

1. **Verify Token Validity First**:

   ```typescript
   const isValid = await client.validateToken(token);
   if (!isValid) {
     console.error('Token is invalid, cannot get user info');
     return;
   }

   const user = await client.getUser(token);
   console.log('User info:', user);
   ```

2. **Check Controller Response**:

   ```typescript
   // Enable debug logging
   const client = new MisoClient(loadConfig());
   ```

## Redis Connection Issues

### Redis Connection Failed

**Symptoms:**

- `Failed to connect to Redis`
- `ECONNREFUSED` for Redis
- Cache operations fail silently

**Possible Causes:**

1. Redis server is not running
2. Wrong Redis configuration
3. Network connectivity issues
4. Authentication failures

**Solutions:**

1. **Check Redis Server Status**:

   ```bash
   # Check if Redis is running
   redis-cli ping

   # Check Redis status
   systemctl status redis

   # Check Redis logs
   tail -f /var/log/redis/redis-server.log
   ```

2. **Verify Redis Configuration**:

   ```typescript
   const client = new MisoClient({
     controllerUrl: process.env.MISO_CONTROLLER_URL!,
     environment: 'dev',
     applicationKey: 'test-app',
     redis: {
       host: 'localhost', // Verify host
       port: 6379, // Verify port
       password: 'your-password', // Verify password
       db: 0 // Verify database
     }
   });

   // Test Redis connection
   await client.initialize();
   console.log('Redis connected:', client.isRedisConnected());
   ```

3. **Test Redis Connection Manually**:

   ```bash
   # Test Redis connection
   redis-cli -h localhost -p 6379 -a your-password ping

   # Test specific database
   redis-cli -h localhost -p 6379 -a your-password -n 0 ping
   ```

4. **Handle Redis Failures Gracefully**:

   ```typescript
   try {
     await client.initialize();
   } catch (error) {
     console.warn('Redis connection failed, using controller fallback:', error);
     // Client will automatically fall back to controller
   }
   ```

### Redis Performance Issues

**Symptoms:**

- Slow cache operations
- High Redis memory usage
- Timeout errors

**Solutions:**

1. **Monitor Redis Performance**:

   ```bash
   # Check Redis memory usage
   redis-cli info memory

   # Check Redis performance
   redis-cli --latency

   # Monitor Redis commands
   redis-cli monitor
   ```

2. **Optimize Cache Configuration**:

   ```typescript
   const client = new MisoClient({
     // ... other config
     cache: {
       roleTTL: 300, // Shorter TTL for better performance
       permissionTTL: 300 // Shorter TTL for better performance
     }
   });
   ```

3. **Configure Redis Connection Pool**:

   ```typescript
   // The SDK automatically handles connection pooling
   // But you can monitor connection status
   setInterval(() => {
     console.log('Redis connected:', client.isRedisConnected());
   }, 30000);
   ```

## Performance Issues

### Slow Authentication Checks

**Symptoms:**

- `validateToken()` takes too long
- High response times
- Timeout errors

**Solutions:**

1. **Enable Redis Caching**:

   ```typescript
   const client = new MisoClient({
     controllerUrl: process.env.MISO_CONTROLLER_URL!,
     environment: 'pro',
     applicationKey: 'my-app',
     redis: {
       host: process.env.REDIS_HOST!,
       port: parseInt(process.env.REDIS_PORT!),
       password: process.env.REDIS_PASSWORD
     }
   });
   ```

2. **Optimize Cache TTL**:

   ```typescript
   const client = new MisoClient({
     // ... other config
     cache: {
       roleTTL: 600, // 10 minutes
       permissionTTL: 300 // 5 minutes
     }
   });
   ```

3. **Batch Permission Checks**:

   ```typescript
   // Instead of multiple individual checks
   const permissions = await client.getPermissions(token);
   const hasCreatePermission = permissions.includes('create:posts');
   const hasEditPermission = permissions.includes('edit:posts');
   ```

### Memory Usage Issues

**Symptoms:**

- High memory consumption
- Memory leaks
- Out of memory errors

**Solutions:**

1. **Monitor Memory Usage**:

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

2. **Properly Dispose Resources**:

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

**Symptoms:**

- `Invalid configuration` errors
- Client initialization fails
- Unexpected behavior

**Solutions:**

1. **Validate Configuration**:

   ```typescript
   function validateConfig(config: any): config is MisoClientConfig {
     if (!config.controllerUrl) {
       throw new Error('controllerUrl is required');
     }
     if (!config.environment || !['dev', 'tst', 'pro'].includes(config.environment)) {
       throw new Error('environment must be dev, tst, or pro');
     }
     if (!config.applicationKey) {
       throw new Error('applicationKey is required');
     }
     return true;
   }

   const config = {
     controllerUrl: process.env.MISO_CONTROLLER_URL!,
     environment: process.env.MISO_ENVIRONMENT as any,
     applicationKey: process.env.MISO_APPLICATION_KEY!
   };

   validateConfig(config);
   const client = new MisoClient(config);
   ```

2. **Check Environment Variables**:

   ```typescript
   // Log configuration (without sensitive data)
   console.log('Configuration:', {
     controllerUrl: process.env.MISO_CONTROLLER_URL,
     environment: process.env.MISO_ENVIRONMENT,
     applicationKey: process.env.MISO_APPLICATION_KEY,
     redisHost: process.env.REDIS_HOST,
     redisPort: process.env.REDIS_PORT
     // Don't log passwords!
   });
   ```

### Missing Environment Variables

**Symptoms:**

- `undefined` values in configuration
- Runtime errors
- Application crashes

**Solutions:**

1. **Use Default Values**:

   ```typescript
   const client = new MisoClient({
     controllerUrl: process.env.MISO_CONTROLLER_URL || 'https://controller.aifabrix.ai',
     environment: (process.env.MISO_ENVIRONMENT as any) || 'dev',
     applicationKey: process.env.MISO_APPLICATION_KEY || 'default-app',
     redis: {
       host: process.env.REDIS_HOST || 'localhost',
       port: parseInt(process.env.REDIS_PORT || '6379'),
       password: process.env.REDIS_PASSWORD
     }
   });
   ```

2. **Validate Required Variables**:

   ```typescript
   const requiredEnvVars = ['MISO_CONTROLLER_URL', 'MISO_ENVIRONMENT', 'MISO_APPLICATION_KEY'];

   for (const envVar of requiredEnvVars) {
     if (!process.env[envVar]) {
       throw new Error(`${envVar} environment variable is required`);
     }
   }
   ```

## Logging Issues

### Logs Not Appearing

**Symptoms:**

- No log output
- Missing audit trails
- Silent failures

**Solutions:**

1. **Check Log Level Configuration**:

   ```typescript
   const client = new MisoClient({
     // ... other config
     logLevel: 'debug' // Ensure appropriate log level
   });
   ```

2. **Test Logging**:

   ```typescript
   // Test different log levels
   await client.log.info('Test info message');
   await client.log.error('Test error message');
   await client.log.audit('test.action', 'test-resource', { test: true });
   ```

3. **Check Controller Logging Endpoint**:

   ```bash
   # Test controller logging endpoint
   curl -X POST https://controller.aifabrix.ai/logs \
     -H "Content-Type: application/json" \
     -d '{"level":"info","message":"test","environment":"dev","application":"test-app"}'
   ```

### Log Performance Issues

**Symptoms:**

- Slow logging operations
- High I/O usage
- Application slowdown

**Solutions:**

1. **Use Appropriate Log Levels**:

   ```typescript
   // Production: Use warn or error only
   const client = new MisoClient({
     // ... other config
     logLevel: 'warn'
   });
   ```

2. **Batch Log Operations**:

   ```typescript
   // Instead of logging immediately
   const logQueue: any[] = [];

   function queueLog(level: string, message: string, context?: any) {
     logQueue.push({ level, message, context, timestamp: new Date() });
   }

   // Process logs in batches
   setInterval(async () => {
     if (logQueue.length > 0) {
       const logs = logQueue.splice(0, 100); // Process 100 at a time
       for (const log of logs) {
         await client.log[log.level](log.message, log.context);
       }
     }
   }, 5000);
   ```

## Browser-Specific Issues

### CORS Issues

**Symptoms:**

- `CORS policy` errors
- `Access-Control-Allow-Origin` errors
- Requests blocked by browser

**Solutions:**

1. **Configure CORS on Controller**:

   ```typescript
   // Controller should allow your domain
   app.use(
     cors({
       origin: ['https://yourdomain.com', 'http://localhost:3000'],
       credentials: true
     })
   );
   ```

2. **Use Proxy in Development**:

   ```javascript
   // package.json
   {
     "proxy": "https://controller.aifabrix.ai"
   }
   ```

### Token Storage Issues

**Symptoms:**

- Tokens not persisted
- Login required on every page refresh
- Security warnings

**Solutions:**

1. **Use Secure Token Storage**:

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
   ```

2. **Handle Token Expiration**:

   ```typescript
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
const client = new MisoClient({
  controllerUrl: process.env.MISO_CONTROLLER_URL!,
  environment: 'dev',
  applicationKey: 'debug-app',
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

## Getting Help

### Self-Service Resources

1. **Check Documentation**:
   - [Getting Started](getting-started.md)
   - [API Reference](api-reference.md)
   - [Configuration](configuration.md)
   - [Examples](examples.md)

2. **Enable Debug Logging**:

   ```typescript
   const client = new MisoClient({
     // ... config
     logLevel: 'debug'
   });
   ```

3. **Test with Minimal Configuration**:

   ```typescript
   const client = new MisoClient({
     controllerUrl: 'https://controller.aifabrix.ai',
     environment: 'dev',
     applicationKey: 'test-app'
   });
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
     environment: config.environment,
     applicationKey: config.applicationKey,
     redisHost: config.redis?.host,
     redisPort: config.redis?.port
   });
   ```

3. **Error Details**:

   ```typescript
   try {
     // Your code here
   } catch (error) {
     console.error('Full error:', {
       message: error.message,
       stack: error.stack,
       name: error.name
     });
   }
   ```

4. **Steps to Reproduce**:
   - Clear steps to reproduce the issue
   - Expected vs actual behavior
   - Any relevant logs or error messages

This troubleshooting guide should help you resolve most common issues with the AI Fabrix Miso Client SDK. If you continue to experience problems, please reach out to our support team with the information requested above.
