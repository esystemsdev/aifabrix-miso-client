/**
 * Code examples data for CodeExamplesPage
 * 
 * Contains all code examples organized by category
 */
export const codeExamples = {
  gettingStarted: {
    serverSetup: `import express from 'express';
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const app = express();
app.use(express.json());

// Initialize MisoClient with environment variables
const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// Create client token endpoint (environment token endpoint)
// This endpoint:
// - Validates request origin (CORS)
// - Fetches environment token (client token) from MISO Controller
// - Returns environment token + DataClient configuration
// NOTE: This provides an ENVIRONMENT TOKEN, not a user token
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));

// Your API routes
app.get('/api/users', async (req, res) => {
  // Your business logic here
  res.json({ users: [] });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});`,
    environmentVariables: `# Server-side environment variables (.env)
# Required for MisoClient initialization

# MISO Controller Configuration
MISO_CLIENTID=ctrl-dev-my-app
MISO_CLIENTSECRET=your-client-secret-here
MISO_CONTROLLER_URL=https://controller.aifabrix.ai

# Optional: Redis for caching (recommended for production)
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: Logging level
MISO_LOG_LEVEL=info`,
    clientSetup: `import { autoInitializeDataClient } from '@aifabrix/miso-client';

// Zero-config initialization
// Automatically fetches config from server's /api/v1/auth/client-token endpoint
const dataClient = await autoInitializeDataClient();

// Now you can use DataClient
const users = await dataClient.get('/api/users');
console.log('Users:', users);`,
    completeExample: `// ============================================
// SERVER-SIDE (Express.js)
// ============================================

import express from 'express';
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const app = express();
app.use(express.json());

// 1. Initialize MisoClient
const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// 2. Create client token endpoint (environment token endpoint)
// This endpoint:
// - Validates request origin (CORS)
// - Fetches environment token (client token) from MISO Controller
// - Returns environment token + DataClient configuration
// NOTE: This provides an ENVIRONMENT TOKEN (client token), not a user token
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));

// 3. Your API routes
// Option A: Public routes (no authentication)
app.get('/api/public', async (req, res) => {
  res.json({ message: 'Public endpoint' });
});

// Option B: Protected routes (validate user token)
app.get('/api/users', async (req, res) => {
  // Extract user token from Authorization header
  const userToken = misoClient.getToken(req);
  
  if (!userToken) {
    return res.status(401).json({ error: 'Unauthorized - no token' });
  }
  
  // Validate user token with MISO Controller
  const isValid = await misoClient.auth.validateToken(userToken);
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }
  
  // Token is valid, proceed with business logic
  res.json({ users: [{ id: 1, name: 'John' }] });
});

app.listen(3000);

// ============================================
// CLIENT-SIDE (Browser/React)
// ============================================

import { autoInitializeDataClient } from '@aifabrix/miso-client';

// 1. Initialize DataClient (zero-config)
// Automatically calls POST /api/v1/auth/client-token
// Receives: environment token (client token) + DataClient config
const dataClient = await autoInitializeDataClient();

// 2. Use DataClient
// Environment token is automatically sent in x-client-token header
// This authenticates the CLIENT APPLICATION, not the user
const users = await dataClient.get('/api/users');
console.log('Users:', users);

// 3. For user-authenticated requests:
// User must login first (via MISO Controller)
// User token is stored in localStorage by DataClient
// DataClient automatically includes user token in Authorization header`,
    howItWorks: `// HOW IT WORKS:
//
// 1. SERVER SETUP:
//    - Server has MISO_CLIENTID and MISO_CLIENTSECRET (never exposed to browser)
//    - Server creates /api/v1/auth/client-token endpoint
//    - This endpoint fetches ENVIRONMENT TOKEN (client token) from MISO Controller
//    - Returns environment token + DataClient configuration to browser
//    - Validates request origin (CORS) before returning token
//
// 2. CLIENT SETUP:
//    - Browser calls autoInitializeDataClient()
//    - DataClient calls POST /api/v1/auth/client-token
//    - Receives environment token (client token) + configuration
//    - Stores environment token in localStorage (with expiration)
//    - Initializes DataClient with received config
//
// 3. REQUEST FLOW:
//    - Client makes request: dataClient.get('/api/users')
//    - DataClient automatically adds x-client-token header (environment token)
//    - Environment token authenticates the CLIENT APPLICATION
//    - For user authentication, validate user token (Bearer token) in your routes
//
// TOKEN TYPES:
// - ENVIRONMENT TOKEN (client token): Authenticates the client application
//   - Sent in x-client-token header
//   - Used to authenticate with MISO Controller
//   - Short-lived (default: 30 minutes)
//   - Automatically refreshed when expired
//
// - USER TOKEN: Authenticates the user
//   - Sent in Authorization: Bearer <token> header
//   - Obtained via login flow
//   - Validated in your API routes using misoClient.auth.validateToken()
//
// SECURITY:
// - Client secret NEVER exposed to browser
// - Environment token is short-lived (default: 30 minutes)
// - Token automatically refreshed when expired
// - Origin validation prevents token theft
// - Your API routes should validate USER tokens, not client tokens`,
    validateUserTokens: `// ============================================
// VALIDATING USER TOKENS IN API ROUTES
// ============================================

import express from 'express';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const app = express();
app.use(express.json());

const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// Option 1: Manual validation in each route
app.get('/api/users', async (req, res) => {
  // Extract user token from Authorization header
  const userToken = misoClient.getToken(req);
  
  if (!userToken) {
    return res.status(401).json({ error: 'Unauthorized - no token' });
  }
  
  // Validate user token with MISO Controller
  const isValid = await misoClient.auth.validateToken(userToken);
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }
  
  // Get user info if needed
  const userInfo = await misoClient.auth.getUserInfo(userToken);
  
  // Token is valid, proceed with business logic
  res.json({ users: [], currentUser: userInfo });
});

// Option 2: Create middleware for reusable validation
function requireAuth(misoClient: MisoClient) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userToken = misoClient.getToken(req);
    
    if (!userToken) {
      return res.status(401).json({ error: 'Unauthorized - no token' });
    }
    
    const isValid = await misoClient.auth.validateToken(userToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }
    
    // Attach token to request for use in route handlers
    (req as any).userToken = userToken;
    next();
  };
}

// Use middleware
app.get('/api/protected', requireAuth(misoClient), async (req, res) => {
  const userToken = (req as any).userToken;
  const userInfo = await misoClient.auth.getUserInfo(userToken);
  res.json({ message: 'Protected route', user: userInfo });
});

// IMPORTANT NOTES:
// - Environment token (x-client-token) is for client app authentication
// - User token (Authorization: Bearer) is for user authentication
// - Your routes should validate USER tokens, not environment tokens
// - Environment token is handled automatically by DataClient`,
  },
  initialization: {
    zeroConfig: `import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - automatically fetches config and initializes DataClient
const dataClient = await autoInitializeDataClient();

// Use DataClient
const users = await dataClient.get('/api/users');`,
    manual: `import { DataClient } from '@aifabrix/miso-client';

// Manual configuration (browser-safe, no clientSecret)
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    // Use server-provided token pattern
    clientTokenUri: '/api/v1/auth/client-token',
  },
});`,
    reactContext: `import { DataClientProvider, useDataClient } from './contexts/DataClientContext';

// Wrap your app with DataClientProvider
function App() {
  return (
    <DataClientProvider>
      <YourComponents />
    </DataClientProvider>
  );
}

// Use DataClient in components
function MyComponent() {
  const { dataClient, isLoading, error } = useDataClient();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!dataClient) return <div>Not initialized</div>;
  
  // Use dataClient...
}`,
  },
  httpMethods: {
    get: `// GET request with cache
const users = await dataClient.get('/api/users');

// GET request without cache
const freshUsers = await dataClient.get('/api/users', {
  cache: { enabled: false },
});

// GET request with custom options
const user = await dataClient.get('/api/users/1', {
  headers: { 'X-Custom-Header': 'value' },
  timeout: 5000,
});`,
    post: `// POST request
const newUser = await dataClient.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// POST with error handling
try {
  const result = await dataClient.post('/api/users', userData);
  console.log('User created:', result);
} catch (error) {
  console.error('Failed to create user:', error.message);
}`,
    put: `// PUT request (full update)
const updatedUser = await dataClient.put('/api/users/1', {
  name: 'John Doe Updated',
  email: 'john.updated@example.com',
});`,
    patch: `// PATCH request (partial update)
const patchedUser = await dataClient.patch('/api/users/1', {
  email: 'john.newemail@example.com',
});`,
    delete: `// DELETE request
await dataClient.delete('/api/users/1');

// DELETE with error handling
try {
  await dataClient.delete('/api/users/1');
  console.log('User deleted');
} catch (error) {
  console.error('Failed to delete user:', error.message);
}`,
  },
  authentication: {
    isAuthenticated: `// Check if user is authenticated
const isAuth = dataClient.isAuthenticated();
if (isAuth) {
  console.log('User is authenticated');
} else {
  console.log('User is not authenticated');
}`,
    getToken: `// Get environment token
const token = await dataClient.getEnvironmentToken();
if (token) {
  console.log('Token:', token);
} else {
  console.log('No token available');
}`,
    getTokenInfo: `// Get client token information
const tokenInfo = dataClient.getClientTokenInfo();
if (tokenInfo) {
  console.log('Token expires at:', tokenInfo.expiresAt);
  console.log('Token issued at:', tokenInfo.issuedAt);
}`,
    logout: `// Logout user
try {
  await dataClient.logout();
  console.log('User logged out');
} catch (error) {
  console.error('Logout failed:', error.message);
}`,
    redirectToLogin: `// Redirect to login
try {
  await dataClient.redirectToLogin();
} catch (error) {
  console.error('Redirect failed:', error.message);
}`,
    handleOAuthCallback: `// OAuth callback handling (automatically called on initialization)
// Token is extracted from URL hash fragment (#token=...) and stored securely
// Hash fragment is immediately removed from URL (< 100ms) for security

// Auto-called on DataClient initialization
const dataClient = new DataClient(config);
// Token is automatically extracted if present in URL hash

// Or manually call if needed
const token = dataClient.handleOAuthCallback();
if (token) {
  console.log('Token extracted and stored');
}

// OAuth Flow:
// 1. User calls redirectToLogin() → redirects to controller login page
// 2. Controller handles OAuth flow with Keycloak
// 3. Controller redirects back: https://myapp.com/dashboard#token=eyJhbGc...
// 4. handleOAuthCallback() extracts token from hash fragment
// 5. Token is validated and stored in localStorage
// 6. Hash fragment is immediately removed from URL (< 100ms)
// 7. User sees clean URL: https://myapp.com/dashboard`,
    tokenRefresh: `// Token refresh callback (automatic refresh on 401 errors)
// Configure onTokenRefresh callback to handle token renewal securely
const dataClientWithRefresh = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'ctrl-dev-my-app',
    clientTokenUri: '/api/v1/auth/client-token',
  },
  onTokenRefresh: async () => {
    // Call your backend endpoint that handles refresh token securely
    // Backend should use httpOnly cookies or session storage for refresh token
    const response = await fetch('/api/refresh-token', {
      method: 'POST',
      credentials: 'include', // Include cookies for auth
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    // Return new access token and expiration time
    return {
      token: data.token, // New access token
      expiresIn: data.expiresIn, // Expiration in seconds
    };
  },
});

// How it works:
// - Automatically called when a request receives 401 Unauthorized
// - Refreshes token using your secure backend endpoint
// - Retries the original request with new token
// - Prevents infinite retry loops with tokenRefreshAttempted flag
// - Refresh tokens are NEVER stored in browser localStorage (security requirement)`,
  },
  caching: {
    enabled: `// Cache-enabled GET request
const users = await dataClient.get('/api/users', {
  cache: { enabled: true, ttl: 60000 }, // Cache for 60 seconds
});`,
    disabled: `// Cache-bypassed GET request
const freshUsers = await dataClient.get('/api/users', {
  cache: { enabled: false },
});`,
    clearCache: `// Clear all cache
dataClient.clearCache();
console.log('Cache cleared');`,
  },
  interceptors: {
    request: `// Set request interceptor
dataClient.setInterceptors({
  onRequest: async (url, options) => {
    // Modify request before sending
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Custom-Header': 'value',
      },
    };
  },
});`,
    response: `// Set response interceptor
dataClient.setInterceptors({
  onResponse: async (response) => {
    // Modify response before returning
    console.log('Response received:', response);
    return response;
  },
});`,
    error: `// Set error interceptor
dataClient.setInterceptors({
  onError: async (error) => {
    // Handle errors
    console.error('Request error:', error);
    throw error; // Re-throw to maintain error flow
  },
});`,
  },
  roles: {
    getRoles: `// Get user roles (auto-retrieves token from localStorage)
const roles = await dataClient.getRoles();
console.log('User roles:', roles);`,
    hasRole: `// Check specific role
const isAdmin = await dataClient.hasRole('admin');
if (isAdmin) {
  console.log('User is admin');
}`,
    hasAnyRole: `// Check if user has any of the roles
const hasAccess = await dataClient.hasAnyRole(['admin', 'moderator']);
if (hasAccess) {
  console.log('User has access');
}`,
    hasAllRoles: `// Check if user has all of the roles
const isSuperAdmin = await dataClient.hasAllRoles(['admin', 'super']);
if (isSuperAdmin) {
  console.log('User is super admin');
}`,
    refreshRoles: `// Force refresh roles (bypass cache)
const refreshedRoles = await dataClient.refreshRoles();
console.log('Refreshed roles:', refreshedRoles);`,
    clearRolesCache: `// Clear cached roles
await dataClient.clearRolesCache();
console.log('Roles cache cleared');`,
  },
  permissions: {
    getPermissions: `// Get user permissions (auto-retrieves token from localStorage)
const permissions = await dataClient.getPermissions();
console.log('User permissions:', permissions);`,
    hasPermission: `// Check specific permission
const canRead = await dataClient.hasPermission('users:read');
if (canRead) {
  console.log('User can read users');
}`,
    hasAnyPermission: `// Check if user has any of the permissions
const canAccess = await dataClient.hasAnyPermission(['users:read', 'users:write']);
if (canAccess) {
  console.log('User has access');
}`,
    hasAllPermissions: `// Check if user has all of the permissions
const canManage = await dataClient.hasAllPermissions(['users:read', 'users:write', 'users:delete']);
if (canManage) {
  console.log('User can manage users');
}`,
    refreshPermissions: `// Force refresh permissions (bypass cache)
const refreshedPermissions = await dataClient.refreshPermissions();
console.log('Refreshed permissions:', refreshedPermissions);`,
    clearPermissionsCache: `// Clear cached permissions
await dataClient.clearPermissionsCache();
console.log('Permissions cache cleared');`,
  },
  errorHandling: {
    tryCatch: `// Basic error handling
try {
  const users = await dataClient.get('/api/users');
  console.log('Users:', users);
} catch (error) {
  console.error('Request failed:', error.message);
  // Display user-friendly error message
}`,
    networkError: `// Handle network errors
try {
  const users = await dataClient.get('/api/users');
} catch (error) {
  if (error.message.includes('Network')) {
    console.error('Network error - check your connection');
  } else {
    console.error('Request failed:', error.message);
  }
}`,
    apiError: `// Handle API errors
try {
  const result = await dataClient.post('/api/users', userData);
} catch (error: any) {
  if (error.status === 400) {
    console.error('Validation error:', error.response?.data);
  } else if (error.status === 401) {
    console.error('Unauthorized - please login');
  } else if (error.status === 403) {
    console.error('Forbidden - insufficient permissions');
  } else {
    console.error('Request failed:', error.message);
  }
}`,
  },
  metrics: {
    getMetrics: `// Get request metrics
const metrics = dataClient.getMetrics();
console.log('Total requests:', metrics.totalRequests);
console.log('Failed requests:', metrics.totalFailures);
console.log('Average response time:', metrics.averageResponseTime);
console.log('Cache hit rate:', metrics.cacheHitRate);`,
  },
};

