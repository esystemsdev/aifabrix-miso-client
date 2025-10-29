# AI Fabrix Miso Client SDK

[![npm version](https://badge.fury.io/js/%40aifabrix%2Fmiso-client.svg)](https://badge.fury.io/js/%40aifabrix%2Fmiso-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The **AI Fabrix Miso Client SDK** provides authentication, authorization, and logging for applications integrated with the AI Fabrix platform.

## ✨ Benefits

### 🔐 Enterprise Security

**SSO and Federated Identity**
- Single Sign-On (SSO) with Keycloak
- OAuth 2.0 and OpenID Connect (OIDC) support
- Multi-factor authentication (MFA) ready
- Social login integration (Google, Microsoft, etc.)

**Centralized Access Control**
- Role-based access control (RBAC)
- Fine-grained permissions
- Dynamic policy enforcement
- Attribute-based access control (ABAC)

**API Security**
- JWT token validation
- API key authentication
- Token revocation support
- Secure token storage

### 📊 Compliance & Audit

**ISO 27001 Compliance**
- Comprehensive audit trails for all user actions
- Data access logging and monitoring
- Security event tracking
- Accountability and non-repudiation

**Regulatory Compliance**
- GDPR-ready data protection
- HIPAA-compliant audit logging
- SOC 2 audit trail requirements
- Industry-standard security controls

**Audit Capabilities**
- Real-time audit event logging
- Immutable audit records
- Forensic analysis support
- Compliance reporting automation

### ⚡ Performance & Scalability

**Intelligent Caching**
- Redis-based role and permission caching
- Configurable cache TTL (default: 15 minutes)
- Automatic cache invalidation
- Fallback to controller when Redis unavailable

**High Availability**
- Automatic failover to controller
- Redundant infrastructure support
- Load balancing compatible
- Zero-downtime deployments

**Optimized Network**
- Efficient API calls with caching
- Batch operations support
- Connection pooling
- Minimal latency

### 🛠️ Developer Experience

**Easy Integration**
- Progressive activation (6-step setup)
- Works with any framework (Express, Next.js, NestJS, Fastify)
- TypeScript-first with full type definitions
- Browser and Node.js support

**Flexible Configuration**
- Environment-based configuration
- Support for dev, test, and production environments
- Docker and Kubernetes ready
- CI/CD friendly

**Observability**
- Centralized logging with correlation IDs
- Performance tracking and metrics
- Error tracking and debugging
- Health monitoring

---

## 🚀 Quick Start

Get your application secured in 30 seconds.

### Step 1: Install

```bash
npm install @aifabrix/miso-client
```

### Step 2: Create `.env`

```bash
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
REDIS_HOST=localhost
```

### Step 3: Use It

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

const isValid = await client.auth.validateToken(token);
```

**That's it!** You now have authentication, roles, and logging.

→ [Full Getting Started Guide](docs/getting-started.md)

---

### Infrastructure Setup

**First time?** You'll need Keycloak and Miso Controller running.

Use the [AI Fabrix Builder](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/QUICK-START.md):

```bash
# Start infrastructure (Postgres, Redis)
aifabrix up

# Install Keycloak for authentication
aifabrix create keycloak --port 8082 --database --template platform
aifabrix build keycloak
aifabrix run keycloak

# Install Miso Controller
aifabrix create miso-controller --port 3000 --database --redis --template platform
aifabrix build miso-controller
aifabrix run miso-controller
```

→ [Infrastructure Guide](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/INFRASTRUCTURE.md)

**Already have Keycloak and Controller?** Use the Quick Start above.

---

## 📚 Documentation

**What happens:** Your app validates user tokens from Keycloak.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Create client (loads from .env automatically)
const client = new MisoClient(loadConfig());
await client.initialize();

// Get token from request (helper method)
const token = client.getToken(req);

if (token) {
  const isValid = await client.validateToken(token);
  if (isValid) {
    const user = await client.getUser(token);
    console.log('User:', user);
  }
}
```

**Where to get tokens?** Users authenticate via Keycloak, then your app receives JWTs in the `Authorization` header.

→ [Complete authentication example](examples/step-3-authentication.ts)

---

### Step 4: Activate RBAC (Roles)

**What happens:** Check user roles to control access. Roles are cached in Redis for performance.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Build on Step 3 - add Redis in .env file
const client = new MisoClient(loadConfig());
await client.initialize();

const token = client.getToken(req);

// Check if user has role
const isAdmin = await client.hasRole(token, 'admin');
const roles = await client.getRoles(token);

// Gate features by role
if (isAdmin) {
  // Show admin panel
}
```

**Pro tip:** Without Redis, checks go to the controller. Add Redis to cache role lookups (15-minute default TTL).

→ [Complete RBAC example](examples/step-4-rbac.ts)  
→ [AI Fabrix Builder Quick Start](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/QUICK-START.md)

---

### Step 5: Activate Logging

**What happens:** Application logs are sent to the Miso Controller with client token authentication.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Client token is automatically managed - no API key needed
const client = new MisoClient(loadConfig());
await client.initialize();

const token = client.getToken(req);
const user = await client.getUser(token);

// Log messages
await client.log.info('User accessed dashboard', { userId: user?.id });
await client.log.error('Operation failed', { error: err.message });
await client.log.warn('Unusual activity', { details: '...' });
```

**What happens to logs?** They're sent to the Miso Controller for centralized monitoring and analysis. Client token is automatically included.

→ [Complete logging example](examples/step-5-logging.ts)  
→ [Logging Reference](docs/api-reference.md#logger-service)

---

### Step 6: Activate Audit

**What happens:** Create audit trails for compliance and security monitoring.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// Complete configuration (all in .env)
const client = new MisoClient(loadConfig());
await client.initialize();

const token = client.getToken(req);
const isValid = await client.validateToken(token);
const canEdit = await client.hasPermission(token, 'edit:content');
const user = await client.getUser(token);

// Audit: User actions
await client.log.audit('user.login', 'authentication', {
  userId: user?.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

// Audit: Content changes
await client.log.audit('post.created', 'content', {
  userId: user?.id,
  postId: 'post-123',
  postTitle: req.body.title,
});

// Audit: Permission checks
await client.log.audit('access.denied', 'authorization', {
  userId: user?.id,
  requiredPermission: 'edit:content',
  resource: 'posts',
});
```

**What to audit:** Login/logout, permission checks, content creation/deletion, role changes, sensitive operations.

→ [Complete audit example](examples/step-6-audit.ts)  
→ [Best Practices](docs/getting-started.md#common-patterns)

---

## 🔧 Configuration

```typescript
interface MisoClientConfig {
  controllerUrl: string;      // Required: Controller URL
  clientId: string;           // Required: Client ID (e.g., 'ctrl-dev-my-app')
  clientSecret: string;       // Required: Client secret
  redis?: RedisConfig;        // Optional: For caching
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  cache?: {
    roleTTL?: number;         // Role cache TTL (default: 900s)
    permissionTTL?: number;   // Permission cache TTL (default: 900s)
  };
}
```

**Recommended:** Use `loadConfig()` to load from `.env` file automatically.

→ [Complete Configuration Reference](docs/configuration.md)

---

## 📚 Documentation

- **[Getting Started](docs/getting-started.md)** - Detailed setup guide
- **[API Reference](docs/api-reference.md)** - Complete API documentation
- **[Configuration](docs/configuration.md)** - Configuration options
- **[Examples](docs/examples.md)** - Framework-specific examples
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions

---

## 🏗️ Architecture

The SDK consists of five core services:

- **AuthService** - Token validation and user authentication
- **RoleService** - Role management with Redis caching
- **PermissionService** - Fine-grained permissions
- **LoggerService** - Centralized logging with API key authentication
- **RedisService** - Caching and queue management (optional)

→ [Architecture Details](docs/api-reference.md#architecture)

---

## 🌐 Setup Your Application

**First time setup?** Use the AI Fabrix Builder:

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

4. **Start development** and then deploy to Docker or Azure.

→ [Full Quick Start Guide](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/QUICK-START.md)

---

## 💡 Next Steps

### Learn More
- [Express.js Middleware](docs/examples.md#expressjs-middleware) - Protect API routes
- [React Authentication](docs/examples.md#react-authentication) - Frontend auth
- [NestJS Guards](docs/examples.md#nestjs-guards) - Decorator-based auth
- [Error Handling](docs/examples.md#error-handling) - Best practices

### Common Tasks

**Add authentication middleware:**
```typescript
app.use(async (req, res, next) => {
  const token = client.getToken(req);
  if (token) {
    const isValid = await client.validateToken(token);
    if (isValid) {
      req.user = await client.getUser(token);
    }
  }
  next();
});
```

**Protect routes by role:**
```typescript
app.get('/admin', async (req, res) => {
  const token = client.getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const isAdmin = await client.hasRole(token, 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  
  // Admin only code
  res.json({ message: 'Admin panel' });
});
```

**Use environment variables:**
```bash
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-secret
MISO_CONTROLLER_URL=http://localhost:3000
REDIS_HOST=localhost
REDIS_PORT=6379
MISO_LOG_LEVEL=info
```

---

## 🐛 Troubleshooting

**"Cannot connect to controller"**  
→ Verify `controllerUrl` is correct and accessible  
→ Check network connectivity

**"Redis connection failed"**  
→ SDK falls back to controller-only mode (slower but works)  
→ Fix: `aifabrix up` to start Redis

**"Client token fetch failed"**  
→ Check `MISO_CLIENTID` and `MISO_CLIENTSECRET` are correct  
→ Verify credentials are configured in controller

**"Token validation fails"**  
→ Ensure Keycloak is running and configured correctly  
→ Verify token is from correct Keycloak instance

→ [More Help](docs/troubleshooting.md)

---

## 📦 Installation

```bash
# NPM
npm install @aifabrix/miso-client

# Yarn
yarn add @aifabrix/miso-client

# PNPM
pnpm add @aifabrix/miso-client
```

---

## 🔗 Links

- **GitHub Repository**: [https://github.com/esystemsdev/aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client)
- **Builder Documentation**: [https://github.com/esystemsdev/aifabrix-builder](https://github.com/esystemsdev/aifabrix-builder)
- **Issues**: [https://github.com/esystemsdev/aifabrix-miso-client/issues](https://github.com/esystemsdev/aifabrix-miso-client/issues)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

**Made with ❤️ by eSystems Nordic Ltd.**
