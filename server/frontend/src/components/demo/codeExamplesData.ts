/**
 * Code examples data for CodeExamplesPage
 * 
 * Contains all code examples organized by category
 */
export const codeExamples = {
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

