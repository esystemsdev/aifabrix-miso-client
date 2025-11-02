# Getting Started with AI Fabrix Miso Client

Welcome! You're about to add enterprise-grade authentication, authorization, and logging to your application in just 30 seconds.

## Your Journey (The Simple Way)

When I built my first app with Miso Client, I thought it would be complicated. It wasn't. Here's the real story:

**Day 1:** I spent 30 seconds creating a `.env` file  
**Day 2:** Added 3 lines of code to my app  
**Day 3:** I had working authentication, roles, and logging  

Let me show you how.

---

## 🎯 What You'll Build

By the end of this guide, you'll have:

- ✅ User authentication with Keycloak
- ✅ Role-based access control (RBAC)
- ✅ Permission checking
- ✅ Centralized logging
- ✅ Audit trails for compliance
- ✅ Data encryption (optional)
- ✅ Generic caching (optional)

---

## 📋 Prerequisites

You'll need:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Keycloak running** - For user authentication
- **Miso Controller running** - For roles and logging
- **Redis (optional but recommended)** - For performance

**Don't have Keycloak or Controller yet?** Use the AI Fabrix Builder:

1. **Create your app:**
   ```bash
   aifabrix create myapp --port 3000 --database --language typescript
   ```

2. **Login to controller:**
   ```bash
   aifabrix login
   ```

3. **Register your application:**
   ```bash
   aifabrix app register myapp --environment dev
   ```

4. **Start development** - then deploy to Docker or Azure.

→ [Full Quick Start Guide](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/QUICK-START.md)

---

## ⚡ Step 1: Install (30 seconds)

```bash
npm install @aifabrix/miso-client
```

That's it. You now have the SDK.

---

## 🔧 Step 2: Configure with .env (30 seconds)

This is where I save you hours of frustration.

**Create a `.env` file in your project root:**

```bash
# Required - Your connection details
MISO_CLIENTID=ctrl-dev-my-awesome-app
MISO_CLIENTSECRET=your-secret-here
MISO_CONTROLLER_URL=http://localhost:3000

# Optional - Redis for better performance (highly recommended)
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional - Encryption key for data encryption (32-byte key in hex/base64/raw string)
ENCRYPTION_KEY=your-encryption-key-here

# Optional - Logging configuration
MISO_LOG_LEVEL=info

# Optional - API key for testing (bypasses OAuth2 - testing only!)
# API_KEY=test-api-key-123
```

**That's your entire configuration.** Copy your `MISO_CLIENTID` and `MISO_CLIENTSECRET` from your Miso Controller admin panel.

### 💡 Why .env?

When I started, I tried manual configuration. It was messy. With .env:
- ✅ No secrets in your code
- ✅ Easy environment switching (dev/test/prod)
- ✅ Team-friendly
- ✅ CI/CD ready

→ [Environment configuration example](../examples/env-config-example.ts)  
→ [Manual configuration example](../examples/manual-config-example.ts)  
→ [Advanced configuration options](configuration.md#manual-configuration)

---

## 💻 Step 3: Initialize (3 lines of code)

This is what your main file looks like:

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Load configuration from .env automatically
const client = new MisoClient(loadConfig());

// Initialize (connects to Redis if configured)
await client.initialize();

// You're ready! Start building.
```

**That's it.** Three lines and you're authenticated.

---

## 🔐 Step 4: Authenticate Users

Now let's use it. Here's the real-world scenario I had:

**My problem:** I needed to check if a user's login token was valid.

**Before (manual):** Call Keycloak API, parse tokens, handle errors... 😴

**Now:**

```typescript
async function authMiddleware(req, res, next) {
  // Get token from request (helper method)
  const token = client.getToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if valid
  const isValid = await client.validateToken(token);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Get user info
  const user = await client.getUser(token);
  req.user = user; // Attach to request
  next();
}
```

**What happens:**
1. User logs in at Keycloak → gets JWT token
2. User sends request with `Authorization: Bearer {token}`
3. Your app calls `validateToken()` → checks with controller
4. Controller validates with Keycloak → returns true/false
5. If valid, you get user info

**I love this because:**
- ✅ Token validation happens automatically
- ✅ User info is cached (faster next time)
- ✅ Works with any framework

→ [Complete authentication example](../examples/step-3-authentication.ts)  
→ [Quick start example](../examples/usage.ts)

---

## 👥 Step 5: Check User Roles

**My problem:** I needed to show admin features only to admins.

**Before:** Lookup user in database, check roles, write if statements... 😴

**Now:**

```typescript
// Check if user has specific role
const isAdmin = await client.hasRole(token, 'admin');
const isEditor = await client.hasRole(token, 'editor');

// Check for multiple roles
const canManage = await client.hasAnyRole(token, ['admin', 'manager']);

// Get all user roles
const userRoles = await client.getRoles(token);
console.log(userRoles); // ['user', 'admin']
```

**My real code:**

```typescript
app.get('/admin', authMiddleware, async (req, res) => {
  const token = client.getToken(req);
  
  // Check role
  const isAdmin = await client.hasRole(token, 'admin');
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  // Show admin panel
  res.json({ message: 'Welcome, admin!' });
});
```

**What happens:**
1. Check Redis cache first (⚡ fast)
2. If not cached, check controller (still fast)
3. Cache result for 15 minutes
4. Return true/false

**I love this because:**
- ✅ Roles are managed in one place (controller)
- ✅ Caching makes it super fast
- ✅ No database queries needed

→ [Complete RBAC example](../examples/step-4-rbac.ts)

---

## ✍️ Step 6: Add Logging

**My problem:** I needed to log important events for debugging and compliance.

**Before:** Configure multiple services, manage log files... 😴

**Now:**

**Note:** When embedding the SDK directly in your own application, enable `emitEvents = true` to receive logs as Node.js events instead of HTTP calls. See [Event Emission Mode](../docs/configuration.md#event-emission-mode) for details.

```typescript
// Log info
await client.log.info('User logged in', {
  userId: user?.id,
  username: user?.username,
});

// Log errors
await client.log.error('Database connection failed', {
  error: err.message,
  database: 'production-db',
});

// Log warnings
await client.log.warn('High CPU usage', {
  cpu: 85,
  memory: 92,
});

// Log debug info (only if logLevel is 'debug')
await client.log.debug('Processing request', {
  requestId: req.id,
  path: req.path,
});
```

**What happens:**
1. Logs go to Redis first (fast)
2. If Redis fails, fallback to controller HTTP
3. Controller stores logs centrally
4. You can query logs via controller interface

**I love this because:**
- ✅ Centralized logs for all apps
- ✅ No need to manage log files
- ✅ Automatic fallback if Redis is down

→ [Complete logging example](../examples/step-5-logging.ts)

---

## 📋 Step 7: Create Audit Trails

**My problem:** Compliance required audit logs for user actions.

**Before:** Build audit logging system... 😴

**Now:**

```typescript
// Audit: User logged in
await client.log.audit('user.login', 'authentication', {
  userId: user?.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

// Audit: Content created
await client.log.audit('post.created', 'content', {
  userId: user?.id,
  postId: 'post-123',
  postTitle: req.body.title,
});

// Audit: Access denied
await client.log.audit('access.denied', 'authorization', {
  userId: user?.id,
  requiredRole: 'admin',
  attemptedPath: '/admin/users',
});
```

**What to audit:**
- ✅ Login/logout events
- ✅ Permission checks (granted/denied)
- ✅ Sensitive operations (user deletion, role changes)
- ✅ Content creation/modification/deletion

**I love this because:**
- ✅ Automatically records who, what, when
- ✅ Perfect for compliance (ISO 27001, GDPR)
- ✅ Immutable audit records

→ [Complete audit example](../examples/step-6-audit.ts)

---

## 🔒 Step 7: Encryption & Caching (Optional)

### Encrypt Sensitive Data

**My problem:** I needed to encrypt sensitive data before storing it.

**Before:** Implement encryption libraries, manage keys... 😴

**Now:**

```typescript
// Check if encryption is available (requires ENCRYPTION_KEY in .env)
if (client.encryption) {
  // Encrypt sensitive data
  const encrypted = client.encryption.encrypt('sensitive-information');
  console.log('Encrypted:', encrypted);
  
  // Decrypt when needed
  const decrypted = client.encryption.decrypt(encrypted);
  console.log('Decrypted:', decrypted);
}
```

**Real-world example - storing encrypted user preferences:**

```typescript
app.post('/save-preferences', authMiddleware, async (req, res) => {
  const token = client.getToken(req);
  const user = await client.getUser(token);
  
  if (client.encryption) {
    // Encrypt sensitive preferences before storing
    const encrypted = client.encryption.encrypt(JSON.stringify(req.body.preferences));
    await database.saveUserPreferences(user.id, encrypted);
  } else {
    // Store unencrypted if encryption not configured
    await database.saveUserPreferences(user.id, req.body.preferences);
  }
  
  res.json({ message: 'Preferences saved' });
});
```

**I love this because:**
- ✅ AES-256-GCM encryption (military-grade security)
- ✅ Easy to use - just encrypt/decrypt
- ✅ Works with any string data

### Generic Caching

**My problem:** I needed to cache API responses and computed results.

**Before:** Set up Redis manually, manage serialization... 😴

**Now:**

```typescript
// Cache expensive computations
const cacheKey = `user:${userId}:profile`;
const cachedProfile = await client.cache.get<UserProfile>(cacheKey);

if (cachedProfile) {
  return cachedProfile; // Fast! From cache
}

// Compute or fetch expensive data
const profile = await expensiveComputation(userId);

// Cache for 10 minutes
await client.cache.set(cacheKey, profile, 600);

return profile;
```

**Real-world example - caching API responses:**

```typescript
app.get('/api/products/:id', async (req, res) => {
  const cacheKey = `product:${req.params.id}`;
  
  // Check cache first
  const cached = await client.cache.get<Product>(cacheKey);
  if (cached) {
    return res.json(cached); // Fast response from cache
  }
  
  // Fetch from database
  const product = await database.getProduct(req.params.id);
  
  // Cache for 5 minutes
  await client.cache.set(cacheKey, product, 300);
  
  res.json(product);
});
```

**What happens:**
1. Check Redis cache first (if available)
2. Fallback to in-memory cache if Redis is down
3. Auto-expires after TTL
4. Works with any data type (automatically serialized)

**I love this because:**
- ✅ Automatic Redis + memory fallback
- ✅ Type-safe with TypeScript generics
- ✅ No manual JSON serialization needed
- ✅ Perfect for API response caching

**Note:** Roles and permissions are already cached automatically. This generic cache is for your application-specific data.

→ [Complete encryption & caching example](../examples/step-7-encryption-cache.ts)  
→ [API Reference](api-reference.md#encryption-methods) - Full encryption API  
→ [Cache Methods](api-reference.md#cache-methods) - Full cache API

---

## 🎉 You Did It!

By now, you have:
- ✅ User authentication working
- ✅ Role-based access control
- ✅ Centralized logging
- ✅ Audit trails

**Total time:** ~15 minutes for a production-ready auth system.

---

## 🚀 Next Steps

### Common Patterns

**Protect API routes:**

```typescript
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Protected content', user: req.user });
});
```

**Check permissions:**

```typescript
app.post('/create-post', authMiddleware, async (req, res) => {
  const token = client.getToken(req);
  
  const canCreate = await client.hasPermission(token, 'create:posts');
  if (!canCreate) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  // Create post
});
```

### More Examples

- **[Express.js Middleware](examples.md#expressjs-middleware)** - Complete Express setup
- **[React Authentication](examples.md#react-authentication)** - Frontend auth
- **[Next.js API Routes](examples.md#nextjs-api-routes)** - Server-side rendering
- **[NestJS Guards](examples.md#nestjs-guards)** - Decorator-based auth

### Deep Dive

- **[Configuration Guide](configuration.md)** - All configuration options
- **[API Reference](api-reference.md)** - Complete API docs
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

---

## 💬 Help & Support

Stuck? We've got your back:

- **Email**: support@esystemsnordic.com
- **Documentation**: [Full docs index](../README.md#-documentation)
- **Issues**: [GitHub Issues](https://github.com/esystemsdev/aifabrix-miso-client/issues)

---

## 🤔 FAQ

**Q: Do I need Redis?**  
A: No, but highly recommended. Without Redis, role checks go directly to the controller (slower but works).

**Q: What if my controller is down?**  
A: SDK falls back gracefully. Authentication might fail, but your app won't crash.

**Q: Can I use this with [my framework]?**  
A: Yes! It's framework-agnostic. We have examples for Express, React, Next.js, NestJS, Fastify...

**Q: Is it secure?**  
A: Yes. Tokens are validated with Keycloak. Secrets are in .env (not in code). Logs go through API key authentication.

**Q: Performance?**  
A: With Redis caching, most checks take <1ms. Without Redis, ~50ms per check.

**Q: How do I encrypt sensitive data?**  
A: Set `ENCRYPTION_KEY` in your `.env` file, then use `client.encryption.encrypt()` and `decrypt()` methods. Uses AES-256-GCM encryption.

**Q: Can I cache my own data?**  
A: Yes! Use `client.cache.set()` and `get()` for generic caching. Automatically uses Redis if available, falls back to in-memory cache.

**Q: How do I test without Keycloak?**  
A: Set `API_KEY=test-api-key-123` in your `.env` file. Bearer tokens matching the API key will validate automatically without calling the controller. Note: This bypasses OAuth2 and is for testing only - never use in production.

---

**Ready to build?** Start with Step 1 above and you'll be up and running in 30 seconds.

Happy coding! 🚀