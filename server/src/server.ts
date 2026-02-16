/**
 * Main Express server
 * Production-ready server with MisoClient integration
 */

// Load .env from root directory BEFORE any other imports
// This ensures root .env is loaded before loadConfig() imports "dotenv/config"
// Builder generates .env to ../../.env (root directory)
// Use require() to execute immediately before ES module imports
/* eslint-disable @typescript-eslint/no-var-requires */
const dotenv = require('dotenv');
const { join } = require('path');
const { existsSync } = require('fs');
/* eslint-enable @typescript-eslint/no-var-requires */

const rootEnvPath = join(process.cwd(), '..', '.env');
const localEnvPath = join(process.cwd(), '.env');

// Try root .env first (builder-generated), then local .env (for development)
// Use override: false to prevent loadConfig()'s dotenv/config from overwriting
if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: false });
} else if (existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: false });
} else {
  // Fallback to default dotenv behavior (current directory)
  dotenv.config({ override: false });
}

import express from 'express';
import { readFileSync } from 'fs';
import {
  MisoClient,
  loadConfig,
  createClientTokenEndpoint,
  setErrorLogger,
  handleRouteError,
  asyncHandler,
  AppError,
} from '@aifabrix/miso-client';
import { Request, Response, NextFunction } from 'express';
import { loadEnvConfig } from './config/env';
import { notFoundHandler } from './middleware/error-handler';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  getMetrics,
  slowEndpoint,
  errorEndpoint,
  logEndpoint,
  getProducts,
  getOrders,
} from './routes/api';
import { healthHandler } from './routes/health';

const app = express();
const envConfig = loadEnvConfig();

// Load config and create MisoClient (completely non-blocking - server starts immediately)
let misoClient: MisoClient | null = null;

// Defer MisoClient initialization to after server starts (don't block startup)
// Use setImmediate to ensure server can start first
setImmediate(() => {
  try {
    const config = loadConfig();
    const controllerUrl = config.controllerPrivateUrl || config.controllerUrl || 'NOT CONFIGURED';
    const clientId = config.clientId || 'NOT CONFIGURED';

    console.log('[MisoClient] Creating MisoClient instance...');
    console.log(`[MisoClient] Controller URL: ${controllerUrl}`);
    console.log(
      `[MisoClient] Client ID: ${clientId ? clientId.substring(0, 20) + '...' : 'NOT CONFIGURED'}`
    );

    misoClient = new MisoClient(config);
    // Initialize asynchronously
    misoClient
      .initialize()
      .then(async () => {
        // Configure error logger to use MisoClient logger with withRequest()
        setErrorLogger({
          async logError(message, options) {
            const req = (options as { req?: Request })?.req;
            if (req && misoClient) {
              // Use withRequest() for automatic context extraction
              await misoClient.log
                .forRequest(req)
                .error(message, (options as { stack?: string })?.stack);
            } else if (misoClient) {
              // Fallback for non-Express contexts
              await misoClient.log.error(message, options as Record<string, unknown>);
            } else {
              // Final fallback to console if MisoClient not available
              console.error('[ERROR]', message);
              if ((options as { stack?: string })?.stack) {
                console.error('[ERROR] Stack:', (options as { stack?: string }).stack);
              }
            }
          },
        });
        // Use logger for success message (but fallback to console if logger not ready)
        try {
          if (misoClient) {
            await misoClient.log.info('MisoClient initialized successfully');
          } else {
            console.log('✅ MisoClient initialized successfully');
          }
        } catch {
          console.log('✅ MisoClient initialized successfully');
        }
      })
      .catch(async (error) => {
        // Log error using logger if available, otherwise console
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        if (misoClient) {
          try {
            await misoClient.log.error('MisoClient initialization failed', {
              errorMessage,
              stack: errorStack,
              controllerUrl,
              clientId: clientId ? clientId.substring(0, 20) + '...' : 'NOT CONFIGURED',
              suggestion: 'Check if controller is running and MISO_CONTROLLER_URL is correct',
            });
          } catch {
            // Fallback to console if logger fails
            console.error('❌ MisoClient initialization failed:');
            console.error('   Error:', errorMessage);
            if (errorStack) {
              console.error('   Stack:', errorStack);
            }
            console.error('   Controller URL:', controllerUrl);
            console.error(
              '   Client ID:',
              clientId ? clientId.substring(0, 20) + '...' : 'NOT CONFIGURED'
            );
            console.error(
              '   Suggestion: Check if controller is running and MISO_CONTROLLER_URL is correct'
            );
          }
        } else {
          console.error('❌ MisoClient initialization failed:');
          console.error('   Error:', errorMessage);
          if (errorStack) {
            console.error('   Stack:', errorStack);
          }
          console.error('   Controller URL:', controllerUrl);
          console.error(
            '   Client ID:',
            clientId ? clientId.substring(0, 20) + '...' : 'NOT CONFIGURED'
          );
          console.error(
            '   Suggestion: Check if controller is running and MISO_CONTROLLER_URL is correct'
          );
        }
      });
  } catch (error) {
    console.error('❌ MisoClient creation failed (server will continue without it):');
    console.error('   Error:', error instanceof Error ? error.message : error);
    console.error('   Some endpoints may not work without MisoClient configured.');
    console.error('   Please check MISO_CLIENTID and MISO_CLIENTSECRET environment variables.');
  }
});

// Middleware - minimal setup to avoid blocking
app.use((req, res, next) => {
  // Simple CORS
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-token');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// JSON parser (only for POST/PUT/PATCH)
app.use(express.json());

// Serve static files from public directory
// Server runs from server/ directory, so public is at ./public
const publicPath = join(process.cwd(), 'public');
if (existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Serve DataClient bundle
// For demo purposes, we provide a minimal browser-compatible DataClient
// In production, DataClient should be bundled with your build tool (webpack/vite/etc)
app.get('/dataclient.js', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/javascript');

    // Minimal browser-compatible DataClient for demo purposes
    // This is a simplified version - use the full package in production
    res.send(`
// DataClient Browser Bundle (Demo Mode)
// For production, bundle DataClient with your build tool: import { DataClient } from '@aifabrix/miso-client';
console.log('DataClient (demo mode) loading...');

window.DataClient = class DataClient {
  constructor(config) {
    this.config = config || {};
    this.cache = new Map();
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      responseTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  async get(url, options = {}) {
    return this._request('GET', url, null, options);
  }

  async post(url, data, options = {}) {
    return this._request('POST', url, data, options);
  }

  async put(url, data, options = {}) {
    return this._request('PUT', url, data, options);
  }

  async patch(url, data, options = {}) {
    return this._request('PATCH', url, data, options);
  }

  async delete(url, options = {}) {
    return this._request('DELETE', url, null, options);
  }

  async _request(method, url, data, options = {}) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const baseUrl = this.config.baseUrl || '';
      const fullUrl = url.startsWith('http') ? url : baseUrl + url;
      
      const fetchOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(data);
      }

      // Handle client token for authentication
      if (this.config.misoConfig?.clientTokenUri) {
        const token = await this._getClientToken();
        if (token) {
          fetchOptions.headers['x-client-token'] = token;
        }
      }

      const response = await fetch(fullUrl, fetchOptions);
      const responseTime = Date.now() - startTime;
      this.metrics.responseTimes.push(responseTime);

      if (!response.ok) {
        this.metrics.totalFailures++;
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        throw new Error(errorData.message || \`HTTP \${response.status}: \${response.statusText}\`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      this.metrics.totalFailures++;
      throw error;
    }
  }

  async _getClientToken() {
    if (!this.config.misoConfig?.clientTokenUri) {
      return null;
    }

    // Check localStorage cache
    const cachedToken = localStorage.getItem('miso:client-token');
    const expiresAt = localStorage.getItem('miso:client-token-expires-at');
    
    if (cachedToken && expiresAt && parseInt(expiresAt) > Date.now()) {
      return cachedToken;
    }

    // Fetch new token
    try {
      const baseUrl = this.config.baseUrl || '';
      const tokenUrl = baseUrl + this.config.misoConfig.clientTokenUri;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get client token');
      }

      const { token, expiresIn } = await response.json();
      const expiresAtTime = Date.now() + (expiresIn * 1000);
      
      localStorage.setItem('miso:client-token', token);
      localStorage.setItem('miso:client-token-expires-at', expiresAtTime.toString());
      
      return token;
    } catch (error) {
      console.error('Failed to get client token:', error);
      return null;
    }
  }

  isAuthenticated() {
    return !!localStorage.getItem('miso:client-token');
  }

  async getEnvironmentToken() {
    return await this._getClientToken();
  }

  getClientTokenInfo() {
    // Log all localStorage keys to see what tokens are available
    console.log('[getClientTokenInfo] Checking localStorage for tokens...');
    const allKeys = Object.keys(localStorage);
    console.log('[getClientTokenInfo] All localStorage keys:', allKeys);
    
    const tokenKeys = allKeys.filter(key => {
      const lowerKey = key.toLowerCase();
      return lowerKey.includes('token') || lowerKey.includes('miso') || lowerKey.includes('auth');
    });
    console.log('[getClientTokenInfo] Found token-related keys:', tokenKeys);
    
    // Check all token keys and log their values (truncated)
    const tokenCandidates = [];
    for (const key of tokenKeys) {
      const value = localStorage.getItem(key);
      const isEmpty = !value || value.trim().length === 0;
      const isJWT = value && value.includes('.') && value.split('.').length === 3;
      console.log(\`[getClientTokenInfo] Key "\${key}": isEmpty=\${isEmpty}, isJWT=\${isJWT}, length=\${value ? value.length : 0}\`);
      if (!isEmpty && isJWT) {
        tokenCandidates.push({ key, value });
        console.log(\`[getClientTokenInfo] Candidate token from "\${key}": \${value.substring(0, 50)}...\`);
      }
    }
    
    // Try multiple possible keys for client token (in priority order)
    const possibleKeys = [
      'miso:client-token',
      'client-token',
      'clientToken',
      'miso_client_token',
      'miso-client-token',
    ];
    
    let token = null;
    let tokenKey = null;
    
    // First, try standard keys
    for (const key of possibleKeys) {
      const value = localStorage.getItem(key);
      if (value && value.trim().length > 0 && value.includes('.') && value.split('.').length === 3) {
        token = value;
        tokenKey = key;
        console.log(\`[getClientTokenInfo] Found valid token in key: \${key}\`);
        break;
      } else if (value) {
        console.log(\`[getClientTokenInfo] Key "\${key}" exists but value is invalid: isEmpty=\${!value || value.trim().length === 0}, isJWT=\${value && value.includes('.') && value.split('.').length === 3}\`);
      }
    }
    
    // If no token found in standard keys, try the first candidate from all keys
    if (!token && tokenCandidates.length > 0) {
      token = tokenCandidates[0].value;
      tokenKey = tokenCandidates[0].key;
      console.log(\`[getClientTokenInfo] Using first candidate token from key: \${tokenKey}\`);
    }
    
    if (!token) {
      console.warn('[getClientTokenInfo] No valid client token found in localStorage');
      console.log('[getClientTokenInfo] Summary:');
      console.log('  - Total localStorage keys:', allKeys.length);
      console.log('  - Token-related keys:', tokenKeys);
      console.log('  - Valid JWT candidates:', tokenCandidates.length);
      return null;
    }
    
    console.log(\`[getClientTokenInfo] Processing token from key: \${tokenKey}\`);
    console.log(\`[getClientTokenInfo] Token length: \${token.length}\`);
    console.log(\`[getClientTokenInfo] Token preview: \${token.substring(0, 50)}...\`);
    
    try {
      // Decode JWT (simple base64 decode)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('[getClientTokenInfo] Token does not have 3 parts (not a valid JWT)');
        console.warn('[getClientTokenInfo] Token parts count:', parts.length);
        return {};
      }
      
      // Decode payload (handle base64url encoding)
      let payloadStr = parts[1];
      // Add padding if needed
      while (payloadStr.length % 4) {
        payloadStr += '=';
      }
      // Replace URL-safe characters
      payloadStr = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
      
      const payload = JSON.parse(atob(payloadStr));
      console.log('[getClientTokenInfo] Decoded token payload:', payload);
      console.log('[getClientTokenInfo] Payload keys:', Object.keys(payload));
      
      // Extract client token info with field name fallbacks (matching real implementation)
      const info = {};
      
      // application or app
      if (payload.application && typeof payload.application === 'string') {
        info.application = payload.application;
      } else if (payload.app && typeof payload.app === 'string') {
        info.application = payload.app;
      }
      
      // environment or env
      if (payload.environment && typeof payload.environment === 'string') {
        info.environment = payload.environment;
      } else if (payload.env && typeof payload.env === 'string') {
        info.environment = payload.env;
      }
      
      // applicationId or app_id
      if (payload.applicationId && typeof payload.applicationId === 'string') {
        info.applicationId = payload.applicationId;
      } else if (payload.app_id && typeof payload.app_id === 'string') {
        info.applicationId = payload.app_id;
      }
      
      // clientId or client_id
      if (payload.clientId && typeof payload.clientId === 'string') {
        info.clientId = payload.clientId;
      } else if (payload.client_id && typeof payload.client_id === 'string') {
        info.clientId = payload.client_id;
      }
      
      // If no standard fields found, include common JWT fields for debugging
      if (Object.keys(info).length === 0) {
        console.log('[getClientTokenInfo] No standard fields found in token payload');
        console.log('[getClientTokenInfo] Available payload fields:', Object.keys(payload));
        console.log('[getClientTokenInfo] Full payload:', JSON.stringify(payload, null, 2));
        
        // Include common JWT fields that might be present
        if (payload.iss) info.issuer = payload.iss;
        if (payload.sub) info.subject = payload.sub;
        if (payload.aud) info.audience = payload.aud;
        if (payload.exp) info.expiresAt = new Date(payload.exp * 1000).toISOString();
        if (payload.iat) info.issuedAt = new Date(payload.iat * 1000).toISOString();
      } else {
        console.log('[getClientTokenInfo] Successfully extracted token info:', info);
      }
      
      return info;
    } catch (error) {
      console.error('[getClientTokenInfo] Failed to decode client token:', error);
      console.error('[getClientTokenInfo] Error details:', error.message);
      if (error.stack) {
        console.error('[getClientTokenInfo] Stack trace:', error.stack);
      }
      return {}; // Return empty object on error (matching real implementation)
    }
  }

  async redirectToLogin() {
    const loginUrl = this.config.loginUrl || '/login';
    window.location.href = loginUrl;
  }

  async logout() {
    localStorage.removeItem('miso:client-token');
    localStorage.removeItem('miso:client-token-expires-at');
  }

  clearCache() {
    this.cache.clear();
  }

  getMetrics() {
    return { ...this.metrics };
  }

  setInterceptors(interceptors) {
    // Stub for demo
    console.log('Interceptors set:', interceptors);
  }

  setAuditConfig(config) {
    // Stub for demo
    console.log('Audit config set:', config);
  }
};

console.log('DataClient (demo mode) loaded successfully');
window.DataClientLoaded = true;
`);
  } catch (error) {
    res
      .status(500)
      .send(
        `// Error loading DataClient: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
  }
});

// Routes
// Add a simple test route first to verify routing works
app.get(
  '/test',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (misoClient) {
      await misoClient.log.forRequest(req).info('Test route accessed');
    }
    res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
  }, 'testRoute')
);

// Health check - use health handler
app.get('/health', healthHandler(misoClient));

// Diagnostic endpoint - check MisoClient status
app.get(
  '/api/diagnostics',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const diagnostics: {
      misoClientExists: boolean;
      misoClientInitialized: boolean;
      config?: {
        controllerUrl?: string;
        controllerPrivateUrl?: string;
        controllerPublicUrl?: string;
        clientId?: string;
        hasClientSecret: boolean;
      };
      error?: string;
    } = {
      misoClientExists: !!misoClient,
      misoClientInitialized: misoClient ? misoClient.isInitialized() : false,
    };

    if (misoClient) {
      try {
        const config = misoClient.getConfig();
        diagnostics.config = {
          controllerUrl: config.controllerUrl,
          controllerPrivateUrl: config.controllerPrivateUrl,
          controllerPublicUrl: config.controllerPublicUrl,
          clientId: config.clientId,
          hasClientSecret: !!config.clientSecret,
        };
      } catch (error) {
        diagnostics.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    res.json(diagnostics);
  }, 'getDiagnostics')
);

// Client token endpoint with zero-config setup
// Automatically includes DataClient configuration in response
// createClientTokenEndpoint handles misoClient initialization check internally
// Support both POST (standard) and GET (fallback compatibility)
const clientTokenHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Check if MisoClient exists
  if (!misoClient) {
    throw new AppError(
      'MisoClient is not initialized. Please configure MISO_CLIENTID and MISO_CLIENTSECRET environment variables.',
      503
    );
  }

  // Check if MisoClient is initialized (async initialization might not be complete)
  if (!misoClient.isInitialized()) {
    const config = misoClient.getConfig();
    const controllerUrl = config.controllerPrivateUrl || config.controllerUrl || 'NOT CONFIGURED';
    if (misoClient) {
      await misoClient.log
        .forRequest(req)
        .addContext('level', 'warning')
        .info(
          'MisoClient exists but not initialized yet. Initialization may still be in progress.'
        );
    }
    const suggestion =
      controllerUrl === 'NOT CONFIGURED'
        ? 'Controller URL is not configured. Please set MISO_CONTROLLER_URL environment variable.'
        : `Controller at ${controllerUrl} may not be reachable. Please check if the controller is running.`;

    throw new AppError(
      `MisoClient is not initialized yet. Please wait a moment and try again. ${suggestion}`,
      503,
      false
    );
  }

  // Use zero-config helper - automatically enriches response with DataClient config
  const handler = createClientTokenEndpoint(misoClient);
  await Promise.resolve(handler(req, res, () => undefined));
}, 'getClientToken');

// Register both POST and GET handlers for compatibility
app.post('/api/v1/auth/client-token', clientTokenHandler);
app.get('/api/v1/auth/client-token', clientTokenHandler);

// API routes - pass misoClient to route handlers
app.get('/api/users', getUsers(misoClient));
app.get('/api/users/:id', getUserById(misoClient));
app.post('/api/users', createUser(misoClient));
app.put('/api/users/:id', updateUser(misoClient));
app.patch('/api/users/:id', patchUser(misoClient));
app.delete('/api/users/:id', deleteUser(misoClient));
app.get('/api/products', getProducts(misoClient));
app.get('/api/orders', getOrders(misoClient));
app.get('/api/metrics', getMetrics(misoClient));
app.get('/api/slow', slowEndpoint(misoClient));
app.get('/api/slow-endpoint', slowEndpoint(misoClient)); // Alias for frontend compatibility
app.get('/api/error/:code', errorEndpoint(misoClient));

// MisoClient logging endpoint (for testing logger functionality)
app.post('/api/v1/logs', logEndpoint(misoClient));

// SPA catch-all route: serve index.html for all non-API routes
// This allows client-side routing to work properly
// API routes and static files are handled by middleware above
app.get(
  /.*/,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if this is an API route or static file request
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/dataclient.js') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/test')
    ) {
      next();
      return;
    }

    // Serve index.html for SPA routing
    const indexPath = join(process.cwd(), 'public', 'index.html');
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } else {
      throw new AppError('Index page not found', 404);
    }
  }, 'serveSPA')
);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last) - use handleRouteError from SDK
app.use(
  async (
    error: Error | unknown,
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> => {
    await handleRouteError(error, req, res);
  }
);

// Start server
const PORT = envConfig.port;

// Set server timeout to prevent hanging
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Demo page: http://localhost:${PORT}/`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);

  // MisoClient initialization happens in setImmediate above (non-blocking)
  console.log('✅ Server started successfully - ready to accept requests');
});

// Set server timeout
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown handler - ensures Node.js process exits properly
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    console.log(`⚠️  ${signal} received again, forcing immediate exit...`);
    process.exit(1);
    return;
  }

  isShuttingDown = true;
  console.log(`\n${signal} signal received: shutting down...`);

  // Immediately stop accepting new connections
  server.close();

  // Force close all existing connections (Node.js 18.2.0+)
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
    console.log('✅ All connections closed');
  }

  // Disconnect MisoClient if it exists (fire and forget - don't wait)
  if (misoClient) {
    misoClient.disconnect().catch(() => {
      // Ignore errors during shutdown
    });
  }

  // Exit immediately - don't wait for anything
  console.log('✅ Exiting process...');
  process.exit(0);
};

// Handle shutdown signals (Ctrl+C, kill command, etc.)
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('uncaughtException');
});

// Handle unhandled promise rejections (log but don't exit)
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
