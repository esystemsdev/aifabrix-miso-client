/**
 * Main Express server
 * Production-ready server with MisoClient integration
 */

// Load .env from root directory BEFORE any other imports
// This ensures root .env is loaded before loadConfig() imports "dotenv/config"
// Builder generates .env to ../../.env (root directory)
// Use require() to execute immediately before ES module imports
/* eslint-disable @typescript-eslint/no-var-requires */
const dotenv = require("dotenv");
const { join } = require("path");
const { existsSync } = require("fs");
/* eslint-enable @typescript-eslint/no-var-requires */

const rootEnvPath = join(process.cwd(), "..", ".env");
const localEnvPath = join(process.cwd(), ".env");

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

import express from "express";
import { readFileSync } from "fs";
import { MisoClient, loadConfig, createClientTokenEndpoint } from "@aifabrix/miso-client";
import { loadEnvConfig } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
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
} from "./routes/api";

const app = express();
const envConfig = loadEnvConfig();

// Load config and create MisoClient (completely non-blocking - server starts immediately)
let misoClient: MisoClient | null = null;

// Defer MisoClient initialization to after server starts (don't block startup)
// Use setImmediate to ensure server can start first
setImmediate(() => {
  try {
    const config = loadConfig();
    misoClient = new MisoClient(config);
    // Initialize asynchronously
    misoClient.initialize().catch((error) => {
      console.warn("⚠️  MisoClient initialization failed:", error instanceof Error ? error.message : error);
    });
  } catch (error) {
    console.warn("⚠️  MisoClient creation failed (server will continue without it):", error instanceof Error ? error.message : error);
    console.warn("   Some endpoints may not work without MisoClient configured.");
  }
});

// Middleware - minimal setup to avoid blocking
app.use((req, res, next) => {
  // Simple CORS
  const origin = req.headers.origin;
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  } else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-client-token");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// JSON parser (only for POST/PUT/PATCH)
app.use(express.json());

// Serve static files from public directory
// Server runs from server/ directory, so public is at ./public
const publicPath = join(process.cwd(), "public");
if (existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Serve DataClient bundle
// For demo purposes, we provide a minimal browser-compatible DataClient
// In production, DataClient should be bundled with your build tool (webpack/vite/etc)
app.get("/dataclient.js", (req, res) => {
  try {
    res.setHeader("Content-Type", "application/javascript");
    
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
    const token = localStorage.getItem('miso:client-token');
    if (!token) return null;
    
    try {
      // Decode JWT (simple base64 decode)
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch {
      return null;
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
    res.status(500).send(`// Error loading DataClient: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

// Routes
// Add a simple test route first to verify routing works
app.get("/test", (req, res) => {
  console.log(`[${new Date().toISOString()}] /test route hit`);
  res.json({ message: "Server is working!", timestamp: new Date().toISOString() });
});

// Health check - direct response (no function call)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Client token endpoint with zero-config setup
// Automatically includes DataClient configuration in response
// createClientTokenEndpoint handles misoClient initialization check internally
app.post("/api/v1/auth/client-token", async (req, res) => {
  if (!misoClient) {
    res.status(503).json({
      error: "MisoClient is not initialized. Please configure MISO_CLIENTID and MISO_CLIENTSECRET environment variables.",
    });
    return;
  }
  
  // Use zero-config helper - automatically enriches response with DataClient config
  const handler = createClientTokenEndpoint(misoClient);
  await handler(req, res);
});

// API routes
app.get("/api/users", getUsers);
app.get("/api/users/:id", getUserById);
app.post("/api/users", createUser);
app.put("/api/users/:id", updateUser);
app.patch("/api/users/:id", patchUser);
app.delete("/api/users/:id", deleteUser);
app.get("/api/metrics", getMetrics);
app.get("/api/slow", slowEndpoint);
app.get("/api/error/:code", errorEndpoint);

// SPA catch-all route: serve index.html for all non-API routes
// This allows client-side routing to work properly
// API routes and static files are handled by middleware above
app.get("*", (req, res, next) => {
  // Skip if this is an API route or static file request
  if (req.path.startsWith("/api/") || req.path.startsWith("/dataclient.js") || req.path.startsWith("/health") || req.path.startsWith("/test")) {
    return next();
  }
  
  // Serve index.html for SPA routing
  try {
    const indexPath = join(process.cwd(), "public", "index.html");
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, "utf-8");
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } else {
      res.status(404).send("<h1>404</h1><p>Index page not found</p>");
    }
  } catch (error) {
    console.error(`Error serving SPA route:`, error);
    res.status(500).send(`<h1>Error</h1><p>Failed to load index page: ${error instanceof Error ? error.message : "Unknown error"}</p>`);
  }
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = envConfig.port;

// Set server timeout to prevent hanging
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Demo page: http://localhost:${PORT}/`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);

  // MisoClient initialization happens in setImmediate above (non-blocking)
  console.log("✅ Server started successfully - ready to accept requests");
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
    console.log("✅ All connections closed");
  }
  
  // Disconnect MisoClient if it exists (fire and forget - don't wait)
  if (misoClient) {
    misoClient.disconnect().catch(() => {
      // Ignore errors during shutdown
    });
  }
  
  // Exit immediately - don't wait for anything
  console.log("✅ Exiting process...");
  process.exit(0);
};

// Handle shutdown signals (Ctrl+C, kill command, etc.)
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  shutdown("uncaughtException");
});

// Handle unhandled promise rejections (log but don't exit)
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

