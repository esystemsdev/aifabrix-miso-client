# AI Fabrix Miso Client SDK

[![npm version](https://img.shields.io/npm/v/%40aifabrix%2Fmiso-client.svg)](https://www.npmjs.com/package/%40aifabrix%2Fmiso-client)
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
- Data encryption/decryption (AES-256-GCM)

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

**HTTP Request Audit (ISO 27001 Compliant)**

- Automatic audit logging for all HTTP requests
- Sensitive data masking (passwords, tokens, PII, financial data)
- Configurable sensitive fields via JSON configuration
- Debug logging with automatic data protection
- Request/response metadata capture
- User context extraction from JWT tokens

### ⚡ Performance & Scalability

**Intelligent Caching**

- Redis-based role and permission caching
- Generic cache service with Redis and in-memory fallback
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

→ [Environment configuration example](examples/env-config-example.ts)

### Step 3: Use It

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

const isValid = await client.auth.validateToken(token);
```

**That's it!** You now have authentication, roles, and logging.

→ [Full Getting Started Guide](docs/getting-started.md)  
→ [Environment configuration example](examples/env-config-example.ts)  
→ [Manual configuration example](examples/manual-config-example.ts)

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

## 🔍 How It Works

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
→ [Quick start example](examples/usage.ts)

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

**Event Emission Mode:** When embedding the SDK directly in your own application, enable `emitEvents = true` to receive logs as Node.js events instead of HTTP calls:

```typescript
const client = new MisoClient({
  ...loadConfig(),
  emitEvents: true // Enable event emission mode
});

// Listen to log events
client.log.on('log', (logEntry: LogEntry) => {
  // Save directly to DB without HTTP
  db.saveLog(logEntry);
});
```

→ [Complete logging example](examples/step-5-logging.ts)  
→ [Event emission mode example](examples/event-emission-mode.example.ts)  
→ [Logging Reference](docs/api-reference.md#logger-service)  
→ [Event Emission Mode Guide](docs/configuration.md#event-emission-mode)

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

### Step 6.5: HTTP Request Audit (ISO 27001)

**What happens:** All HTTP requests are automatically audited with sensitive data masking for ISO 27001 compliance.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

// HTTP requests are automatically audited
// - All requests/responses are logged with masked sensitive data
// - User context is extracted from JWT tokens
// - Request/response metadata (duration, size, status codes) is captured
// - Sensitive fields (passwords, tokens, PII, financial data) are automatically masked

// No additional code needed - works automatically!
const user = await client.getUser(token);
// This HTTP request is automatically audited with ISO 27001 compliance
```

**Configuration (Optional):**

```bash
# Add to .env for custom sensitive fields configuration
MISO_SENSITIVE_FIELDS_CONFIG=/path/to/sensitive-fields.config.json
```

**Built-in Performance Optimizations:**
The SDK automatically optimizes audit logging performance:

- Automatic response body truncation for large payloads
- Optimized masking operations with intelligent size-based processing
- Batch logging to minimize network overhead
- Configurable audit levels for performance tuning: `minimal`, `standard`, `detailed` (default), `full`
- Fast path optimizations for small requests
- Parallel processing for improved throughput

**Performance Configuration:**

```typescript
const client = new MisoClient({
  ...loadConfig(),
  audit: {
    level: 'standard', // Light masking, good performance
    batchSize: 20, // Batch 20 logs per request
    maxResponseSize: 10000 // Truncate large responses
  }
});
```

**What gets audited:**

- All HTTP requests to the controller
- Request/response metadata (method, URL, status, duration, size)
- User context (extracted from JWT tokens)
- Sensitive data is automatically masked (passwords, tokens, PII, credit cards, etc.)

**ISO 27001 Compliance:**

- Automatic sensitive data masking before logging
- Configurable sensitive field patterns
- Audit trail for all API communications
- Data protection controls enforced
- Optimized performance without compromising compliance

→ [Audit Configuration Guide](docs/configuration.md#audit-configuration)

→ [Custom sensitive fields example](examples/custom-sensitive-fields.example.ts)  
→ [Sensitive fields config example](examples/sensitive-fields-config.example.json)

---

### Step 7: Encryption & Caching

**What happens:** Use encryption for sensitive data and generic caching for improved performance.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

// Encryption (requires ENCRYPTION_KEY in .env or config.encryptionKey)
if (client.encryption) {
  const encrypted = client.encryption.encrypt('sensitive-data');
  const decrypted = client.encryption.decrypt(encrypted);
  console.log('Decrypted:', decrypted);
}

// Generic caching (automatically uses Redis if available, falls back to memory)
await client.cache.set('user:123', { name: 'John', age: 30 }, 600); // 10 minutes TTL
const user = await client.cache.get<{ name: string; age: number }>('user:123');
if (user) {
  console.log('Cached user:', user);
}
```

**Configuration:**

```bash
# Add to .env
ENCRYPTION_KEY=your-32-byte-encryption-key
```

→ [Complete encryption & caching example](examples/step-7-encryption-cache.ts)  
→ [API Reference](docs/api-reference.md#encryption-methods)  
→ [Cache Methods](docs/api-reference.md#cache-methods)

---

### Step 8: Pagination, Filter, and Sort Utilities

**What happens:** Use reusable utilities for pagination, filtering, and sorting following enterprise application best practices and industry standards (ISO 27001 compliant).

```typescript
import { 
  FilterBuilder, 
  parsePaginationParams, 
  parseSortParams,
  buildQueryString,
  createPaginatedListResponse
} from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

// Dynamic filter building (FilterBuilder)
const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('region', 'in', ['eu', 'us'])
  .add('created_at', 'gte', '2024-01-01');

const queryString = filterBuilder.toQueryString();
// Returns: "filter=status:eq:active&filter=region:in:eu,us&filter=created_at:gte:2024-01-01"

// Parse pagination from query string
const { currentPage, pageSize } = parsePaginationParams({ page: '1', page_size: '25' });

// Parse sort from query string
const sortOptions = parseSortParams({ sort: '-updated_at' });

// Build complete query
const completeQuery = buildQueryString({
  filters: filterBuilder.build(),
  sort: ['-updated_at'],
  page: currentPage,
  pageSize: pageSize
});

// Create paginated response
const response = createPaginatedListResponse(
  items,
  120, // totalItems
  1,   // currentPage
  25,  // pageSize
  'application' // type
);
```

**Note:** All utilities use **camelCase** naming conventions following TypeScript best practices (`currentPage`, `pageSize`, `statusCode`, etc.), ensuring consistency and ISO 27001 compliance.

**Pro tip:** These utilities are business-logic-free and reusable across applications. Perfect for building query strings, parsing API responses, and testing with mocks. Designed following enterprise best practices for maintainability and compliance.

→ [Complete pagination example](docs/examples.md#pagination)  
→ [Complete filter example](docs/examples.md#filtering)  
→ [Complete sort example](docs/examples.md#sorting)  
→ [API Reference](docs/api-reference.md#pagination-utilities)

---

### Step 9: Express.js Utilities

**What happens:** Use Express-specific utilities for building REST APIs with standardized responses, error handling, and validation.

#### Installation

For Express.js applications, the SDK includes optional Express utilities:

```bash
npm install @aifabrix/miso-client express
```

#### Quick Start

```typescript
import express from 'express';
import { 
  injectResponseHelpers,
  asyncHandler,
  ValidationHelper,
  setErrorLogger,
  EncryptionUtil
} from '@aifabrix/miso-client';

const app = express();

// Inject response helpers
app.use(injectResponseHelpers);

// Configure error logger (optional)
setErrorLogger({
  async logError(message, options) {
    console.error(message, options);
  }
});

// Use asyncHandler for automatic error handling
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await ValidationHelper.findOrFail(
    () => db.user.findById(req.params.id),
    'User',
    req.params.id
  );
  res.success(user, 'User retrieved');
}));
```

#### Response Helpers

Standardized API response formatting:

```typescript
import { ResponseHelper } from '@aifabrix/miso-client';

// Success response (200)
return ResponseHelper.success(res, data, 'Success message');

// Created response (201)
return ResponseHelper.created(res, newResource, 'Resource created');

// Paginated response
return ResponseHelper.paginated(res, items, {
  currentPage: 1,
  pageSize: 20,
  totalItems: 100,
  type: 'user'
});

// No content (204)
return ResponseHelper.noContent(res);

// Accepted (202)
return ResponseHelper.accepted(res, { jobId: '123' }, 'Job queued');

// Or use injected methods on res object
res.success(user);
res.created(newPost);
res.paginated(users, meta);
res.noContent();
res.accepted(data);
```

#### Async Handler

Eliminates try-catch blocks in route handlers:

```typescript
import { asyncHandler } from '@aifabrix/miso-client';

// Automatic error handling
router.post('/users', asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  res.created(user, 'User created');
}));

// Named variant for better error messages
router.get('/users/:id', asyncHandlerNamed('getUser', async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.success(user);
}));
```

#### Validation Helper

Common validation patterns:

```typescript
import { ValidationHelper } from '@aifabrix/miso-client';

// Find or throw 404
const user = await ValidationHelper.findOrFail(
  () => prisma.user.findUnique({ where: { id } }),
  'User',
  id
);

// Ensure doesn't exist or throw 409
await ValidationHelper.ensureNotExists(
  () => prisma.user.findUnique({ where: { email } }),
  'User',
  email
);

// Check ownership or admin role
ValidationHelper.ensureOwnershipOrAdmin(req, resourceUserId);

// Validate required fields
ValidationHelper.validateRequiredFields(data, ['name', 'email'], 'User');

// Validate string length
ValidationHelper.validateStringLength(password, 'password', 8, 128);
```

#### Error Handling

RFC 7807 compliant error responses with optional custom logger:

```typescript
import { setErrorLogger } from '@aifabrix/miso-client';

// Configure during app initialization
setErrorLogger({
  async logError(message, options) {
    await yourLogger.error(message, options);
  }
});

// Errors are automatically handled by asyncHandler
// AppError is automatically converted to RFC 7807 format
```

#### Encryption

AES-256-GCM encryption for sensitive data:

```typescript
import { EncryptionUtil } from '@aifabrix/miso-client';

// Initialize once at startup (uses ENCRYPTION_KEY env var)
EncryptionUtil.initialize();

// Encrypt sensitive data
const encrypted = EncryptionUtil.encrypt('sensitive-data');

// Decrypt
const decrypted = EncryptionUtil.decrypt(encrypted);

// Generate new key (for setup)
const key = EncryptionUtil.generateKey();
console.log('ENCRYPTION_KEY=' + key);
```

#### Sort Utilities

Parse and apply sorting for API queries:

```typescript
import { parseSortParams, applySorting } from '@aifabrix/miso-client';

// Parse sort query parameters
const sortOptions = parseSortParams({ sort: ['-createdAt', 'name'] });
// Returns: [{ field: 'createdAt', order: 'desc' }, { field: 'name', order: 'asc' }]

// Apply sorting to in-memory data (client-side)
const sortedData = applySorting(users, sortOptions);

// Or parse from Express request query
app.get('/users', (req, res) => {
  const sortOptions = parseSortParams(req.query);
  // Use sortOptions to build database query with Prisma/SQL
  const users = await prisma.user.findMany({
    orderBy: sortOptions.map(s => ({ [s.field]: s.order }))
  });
  res.success(users);
});
```

**Note:** For large datasets, always sort at the database level. Use `applySorting()` only for small in-memory datasets or client-side sorting.

→ [Complete Express examples](examples/)  
→ [API Reference](docs/api-reference.md#express-utilities)

---

### Step 10: Multi-Authentication Strategy

**What happens:** Configure flexible authentication methods with priority-based fallback for advanced authentication scenarios.

```typescript
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

// Global strategy configuration
const client = new MisoClient({
  ...loadConfig(),
  authStrategy: {
    methods: ['bearer', 'client-token', 'client-credentials']
  }
});

// Per-request strategy override
const strategy = client.createAuthStrategy(['bearer', 'api-key'], 'token-123', 'api-key-456');
await client.getRoles(token, strategy);

// Using requestWithAuthStrategy for custom requests
await client.requestWithAuthStrategy('GET', '/api/data', {
  methods: ['client-token']
});

// Get default strategy
const defaultStrategy = client.getDefaultAuthStrategy(token);
// Returns: { methods: ['bearer', 'client-token'], bearerToken: token }
```

**Supported Authentication Methods:**

- `bearer` - Bearer token authentication (Authorization: Bearer <token>)
- `client-token` - Client token authentication (x-client-token header)
- `client-credentials` - Client credentials authentication (X-Client-Id and X-Client-Secret headers)
- `api-key` - API key authentication (Authorization: Bearer <api-key>)

**Priority-Based Fallback:** Methods are tried in the order specified in the strategy array until one succeeds.

**Environment Variable Configuration:**

```bash
MISO_AUTH_STRATEGY=bearer,client-token,api-key
MISO_BEARER_TOKEN=optional-bearer-token
MISO_API_KEY=optional-api-key
```

**Backward Compatibility:** All existing code continues to work without changes. If no strategy is specified, defaults to `['bearer', 'client-token']` (existing behavior).

→ [Complete authentication strategy example](docs/examples.md#authentication-strategy)  
→ [API Reference](docs/api-reference.md#authentication-strategy)

---

## 🔧 Configuration

```typescript
interface MisoClientConfig {
  controllerUrl: string;      // Required: Controller URL
  clientId: string;           // Required: Client ID (e.g., 'ctrl-dev-my-app')
  clientSecret: string;       // Required: Client secret
  redis?: RedisConfig;        // Optional: For caching
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  encryptionKey?: string;     // Optional: Encryption key (or use ENCRYPTION_KEY env var)
  sensitiveFieldsConfig?: string; // Optional: Path to ISO 27001 sensitive fields config JSON
  emitEvents?: boolean;       // Optional: Emit log events instead of HTTP/Redis (for direct SDK embedding)
  authStrategy?: AuthStrategy; // Optional: Default authentication strategy
  cache?: {
    roleTTL?: number;         // Role cache TTL (default: 900s)
    permissionTTL?: number;   // Permission cache TTL (default: 900s)
  };
  audit?: AuditConfig;        // Optional: Audit logging configuration
}

interface AuthStrategy {
  methods: ('bearer' | 'client-token' | 'client-credentials' | 'api-key')[];
  bearerToken?: string;       // Optional: Bearer token for bearer authentication
  apiKey?: string;            // Optional: API key for api-key authentication
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
MISO_SENSITIVE_FIELDS_CONFIG=/path/to/sensitive-fields.config.json  # Optional: ISO 27001 config
MISO_EMIT_EVENTS=true  # Optional: Enable event emission mode (for direct SDK embedding)
MISO_AUTH_STRATEGY=bearer,client-token,api-key  # Optional: Authentication strategy (comma-separated)
MISO_BEARER_TOKEN=optional-bearer-token  # Optional: Default bearer token
MISO_API_KEY=optional-api-key  # Optional: Default API key
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
