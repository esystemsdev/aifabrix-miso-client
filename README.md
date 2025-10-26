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

Get your application secured in 6 steps.

### Step 1: Set Up Your Environment

**What you need:**
- Keycloak running for authentication
- AI Fabrix Miso Controller running

**First time setting up?** Use the [AI Fabrix Builder Quick Start](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/QUICK-START.md):

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

**Already have Keycloak and Controller?** Skip to Step 2.

---

### Step 2: Install Miso Client

```bash
npm install @aifabrix/miso-client
```

**What you get:**
- Authentication with Keycloak
- Role-based access control (RBAC)
- Centralized logging
- Redis caching for performance

---

### Step 3: Activate Authentication

**What happens:** Your app validates user tokens from Keycloak.

```typescript
import { MisoClient } from '@aifabrix/miso-client';

// Create client
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
});

await client.initialize();

// Validate token from request
const token = req.headers.authorization?.replace('Bearer ', '');
const isValid = await client.validateToken(token);

if (isValid) {
  const user = await client.getUser(token);
  console.log('User:', user);
}
```

**Where to get tokens?** Users authenticate via Keycloak, then your app receives JWTs in the `Authorization` header.

→ [Complete authentication example](examples/step-3-authentication.ts)

---

### Step 4: Activate RBAC (Roles)

**What happens:** Check user roles to control access. Roles are cached in Redis for performance.

```typescript
// Build on Step 3 - add Redis for caching
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
  redis: { host: 'localhost', port: 6379 }, // Add Redis
});

await client.initialize();

const token = req.headers.authorization?.replace('Bearer ', '');

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
→ [RBAC Configuration](https://github.com/esystemsdev/aifabrix-builder/blob/main/docs/QUICK-START.md#step-3-create-your-app)

---

### Step 5: Activate Logging

**What happens:** Application logs are sent to the Miso Controller with API key authentication.

```typescript
// Add API key for logging
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
  apiKey: 'dev-my-app-my-app-id-123-a1b2c3d4e5f6', // NEW: API key
  redis: { host: 'localhost', port: 6379 },
});

await client.initialize();

const token = req.headers.authorization?.replace('Bearer ', '');
const user = await client.getUser(token);

// Log messages
await client.log.info('User accessed dashboard', { userId: user?.id });
await client.log.error('Operation failed', { error: err.message });
await client.log.warn('Unusual activity', { details: '...' });
```

**API key format:** `{environment}-{applicationKey}-{applicationId}-{randomString}`

**What happens to logs?** They're sent to the Miso Controller for centralized monitoring and analysis.

→ [Complete logging example](examples/step-5-logging.ts)  
→ [Logging Reference](docs/api-reference.md#logger-service)

---

### Step 6: Activate Audit

**What happens:** Create audit trails for compliance and security monitoring.

```typescript
// Complete configuration
const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'my-app',
  applicationId: 'my-app-id-123',
  apiKey: 'dev-my-app-my-app-id-123-a1b2c3d4e5f6',
  redis: { host: 'localhost', port: 6379, password: 'optional' },
  logLevel: 'info',
  cache: { roleTTL: 900, permissionTTL: 900 },
});

await client.initialize();

const token = req.headers.authorization?.replace('Bearer ', '');
const isValid = await client.validateToken(token);
const canEdit = await client.hasPermission(token, 'edit:content');

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
  environment: 'dev' | 'tst' | 'pro'; // Required: Environment
  applicationKey: string;     // Required: App identifier
  applicationId: string;      // Required: App GUID
  apiKey?: string;            // Optional: For logging
  redis?: RedisConfig;         // Optional: For caching
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  cache?: {
    roleTTL?: number;         // Role cache TTL (default: 900s)
    permissionTTL?: number;   // Permission cache TTL (default: 900s)
  };
}
```

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

## 🌐 Environments

The SDK supports three environments:

- **`dev`** - Development environment
- **`tst`** - Test environment  
- **`pro`** - Production environment

Each environment uses different controller endpoints and API keys.

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
  const token = req.headers.authorization?.replace('Bearer ', '');
  const isValid = await client.validateToken(token);
  if (isValid) {
    req.user = await client.getUser(token);
  }
  next();
});
```

**Protect routes by role:**
```typescript
app.get('/admin', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const isAdmin = await client.hasRole(token, 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  // Admin only code
});
```

**Use environment variables:**
```bash
MISO_CONTROLLER_URL=https://controller.aifabrix.ai
MISO_ENVIRONMENT=dev
MISO_APPLICATION_KEY=my-app
MISO_APPLICATION_ID=my-app-id-123
MISO_API_KEY=dev-my-app-my-app-id-123-a1b2c3d4e5f6
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 🐛 Troubleshooting

**"Cannot connect to controller"**  
→ Verify `controllerUrl` is correct and accessible  
→ Check network connectivity

**"Redis connection failed"**  
→ SDK falls back to controller-only mode (slower but works)  
→ Fix: `aifabrix up` to start Redis

**"Invalid API key for logging"**  
→ Check API key format: `{environment}-{applicationKey}-{applicationId}-{randomString}`  
→ Verify key is configured in controller

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
