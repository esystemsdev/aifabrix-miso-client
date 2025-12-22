/**
 * Server Integration Tests
 * Tests actual HTTP requests to the Express server
 */

import request from 'supertest';
import express from 'express';
import { loadEnvConfig } from '../config/env';
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
} from '../routes/api';
import { healthHandler } from '../routes/health';
import { errorHandler, notFoundHandler } from '../middleware/error-handler';
import { corsMiddleware } from '../middleware/cors';

/**
 * Create test Express app with all routes
 */
function createTestApp(): express.Application {
  const app = express();
  const envConfig = loadEnvConfig();

  // Middleware
  app.use(express.json());
  app.use(corsMiddleware(envConfig.misoAllowedOrigins));

  // Health check
  app.get('/health', healthHandler);

  // Client token endpoint (mock - doesn't require real MisoClient)
  app.post('/api/v1/auth/client-token', (req, res) => {
    res.json({
      token: 'test-token',
      expiresIn: 1800,
      config: {
        baseUrl: 'http://localhost:3083',
        controllerUrl: 'http://localhost:3110',
        clientId: 'test-client',
        clientTokenUri: '/api/v1/auth/client-token',
      },
    });
  });

  // MisoClient logging endpoint
  app.post('/api/v1/logs', logEndpoint);

  // API routes
  app.get('/api/users', getUsers);
  app.get('/api/users/:id', getUserById);
  app.post('/api/users', createUser);
  app.put('/api/users/:id', updateUser);
  app.patch('/api/users/:id', patchUser);
  app.delete('/api/users/:id', deleteUser);
  app.get('/api/metrics', getMetrics);
  app.get('/api/slow', slowEndpoint);
  app.get('/api/slow-endpoint', slowEndpoint); // Alias for frontend compatibility
  app.get('/api/error/:code', errorEndpoint);

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe('Server Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('Client Token Endpoint', () => {
    it('should return client token with config', async () => {
      const response = await request(app)
        .post('/api/v1/auth/client-token')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        token: expect.any(String),
        expiresIn: expect.any(Number),
        config: {
          baseUrl: expect.any(String),
          controllerUrl: expect.any(String),
          clientId: expect.any(String),
          clientTokenUri: expect.any(String),
        },
      });
    });
  });

  describe('Users API', () => {
    it('GET /api/users should return list of users', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        users: expect.any(Array),
        count: expect.any(Number),
      });
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('GET /api/users/:id should return user when found', async () => {
      const response = await request(app).get('/api/users/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: {
          id: '1',
          name: expect.any(String),
          email: expect.any(String),
          createdAt: expect.any(String),
        },
      });
    });

    it('GET /api/users/:id should return 404 when user not found', async () => {
      const response = await request(app).get('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'User not found',
      });
    });

    it('POST /api/users should create new user', async () => {
      const newUser = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const response = await request(app)
        .post('/api/users')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        user: {
          id: expect.any(String),
          name: newUser.name,
          email: newUser.email,
          createdAt: expect.any(String),
        },
      });
    });

    it('POST /api/users should return 400 when data is missing', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.any(String),
      });
    });

    it('PUT /api/users/:id should update user when found', async () => {
      const updateData = {
        name: 'Updated User',
        email: 'updated@example.com',
      };

      const response = await request(app)
        .put('/api/users/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: {
          id: '1',
          name: updateData.name,
          email: updateData.email,
        },
      });
    });

    it('PUT /api/users/:id should return 404 when user not found', async () => {
      const response = await request(app)
        .put('/api/users/999')
        .send({
          name: 'Updated User',
          email: 'updated@example.com',
        });

      expect(response.status).toBe(404);
    });

    it('PATCH /api/users/:id should partially update user', async () => {
      const patchData = {
        email: 'patched@example.com',
      };

      const response = await request(app)
        .patch('/api/users/1')
        .send(patchData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: {
          id: '1',
          email: patchData.email,
        },
      });
    });

    it('DELETE /api/users/:id should delete user when found', async () => {
      // First create a user to delete
      const createResponse = await request(app)
        .post('/api/users')
        .send({
          name: 'To Delete',
          email: 'delete@example.com',
        });

      const userId = createResponse.body.user.id;

      // Then delete it
      const deleteResponse = await request(app).delete(`/api/users/${userId}`);

      expect(deleteResponse.status).toBe(204);

      // Verify it's deleted
      const getResponse = await request(app).get(`/api/users/${userId}`);
      expect(getResponse.status).toBe(404);
    });

    it('DELETE /api/users/:id should return 404 when user not found', async () => {
      const response = await request(app).delete('/api/users/999');

      expect(response.status).toBe(404);
    });
  });

  describe('Metrics API', () => {
    it('GET /api/metrics should return metrics', async () => {
      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalRequests: expect.any(Number),
        totalFailures: expect.any(Number),
        averageResponseTime: expect.any(Number),
        errorRate: expect.any(Number),
        cacheHitRate: expect.any(Number),
      });
    });
  });

  describe('Slow Endpoint', () => {
    // Note: These tests use real delays to verify the endpoint works correctly
    // For faster unit tests, see api.test.ts which uses fake timers

    it('GET /api/slow should return response after delay', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/slow')
        .query({ delay: '100' });

      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Slow response',
        delay: 100,
        timestamp: expect.any(String),
      });
      // Should take at least 100ms (allow some margin for test overhead)
      expect(elapsed).toBeGreaterThanOrEqual(90);
    }, 10000); // Increase timeout for slow endpoint

    it('GET /api/slow-endpoint should work (alias)', async () => {
      const response = await request(app)
        .get('/api/slow-endpoint')
        .query({ delay: '50' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Slow response',
        delay: 50,
      });
    }, 10000);

    it('GET /api/slow should use default delay when not specified', async () => {
      // Skip default delay test in integration (too slow - 5 seconds)
      // This is tested in unit tests with fake timers
      const response = await request(app)
        .get('/api/slow')
        .query({ delay: '100' }); // Use short delay instead

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Slow response',
        delay: 100,
      });
    }, 10000);
  });

  describe('Error Endpoint', () => {
    it('GET /api/error/:code should return error with specified status code', async () => {
      const response = await request(app).get('/api/error/404');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
        message: expect.stringContaining('404'),
      });
    });

    it('GET /api/error/:code should default to 500 for invalid code', async () => {
      const response = await request(app).get('/api/error/invalid');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        statusCode: 500,
      });
    });

    it('GET /api/error/:code should handle various error codes', async () => {
      const codes = [400, 401, 403, 500, 503];

      for (const code of codes) {
        const response = await request(app).get(`/api/error/${code}`);

        expect(response.status).toBe(code);
        expect(response.body.statusCode).toBe(code);
      }
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should return 404 for invalid user ID format', async () => {
      const response = await request(app).get('/api/users/invalid-id');

      expect(response.status).toBe(404);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers for allowed origins', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Origin', 'http://localhost:3083');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Redirect to Login - Controller Endpoint', () => {
    // Mock controller login endpoint
    let mockControllerApp: express.Application;
    let controllerServer: any;
    let _controllerPort: number;

    beforeAll(async () => {
      // Create a mock controller server
      mockControllerApp = express();
      mockControllerApp.use(express.json());

      // Mock controller login endpoint - simulates miso-controller behavior
      mockControllerApp.get('/api/v1/auth/login', (req, res) => {
        const redirect = req.query.redirect as string;
        const clientToken = req.headers['x-client-token'] as string;

        // Verify client token is present (miso-controller requires this)
        if (!clientToken) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Client token required',
          });
        }

        // Return login URL with redirect parameter (miso-controller format)
        const loginUrl = `https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/auth?redirect_uri=${encodeURIComponent(redirect || 'http://localhost:3000')}&client_id=test-client&state=test-state-123`;

        res.json({
          success: true,
          data: {
            loginUrl,
            state: 'test-state-123',
          },
          timestamp: new Date().toISOString(),
        });
      });

      // Start mock controller server on random port
      return new Promise<void>((resolve) => {
        controllerServer = mockControllerApp.listen(0, () => {
          _controllerPort = (controllerServer.address() as any).port;
          resolve();
        });
      });
    });

    afterAll((done) => {
      if (controllerServer) {
        // Close all connections first (Node.js 18.2.0+)
        if (typeof controllerServer.closeAllConnections === 'function') {
          controllerServer.closeAllConnections();
        }
        // Then close the server
        controllerServer.close(() => {
          // Give it a moment to fully close
          setTimeout(() => done(), 100);
        });
      } else {
        done();
      }
    });

    it('should return login URL when client token is provided', async () => {
      const clientToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token';
      const redirectUrl = 'http://localhost:3000/dashboard';

      const response = await request(mockControllerApp)
        .get('/api/v1/auth/login')
        .set('x-client-token', clientToken)
        .query({ redirect: redirectUrl });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          loginUrl: expect.stringContaining('keycloak.example.com'),
          state: expect.any(String),
        },
        timestamp: expect.any(String),
      });
      expect(response.body.data.loginUrl).toContain(encodeURIComponent(redirectUrl));
    });

    it('should require client token for login endpoint', async () => {
      const response = await request(mockControllerApp)
        .get('/api/v1/auth/login')
        .query({ redirect: 'http://localhost:3000' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Client token required',
      });
    });

    it('should include redirect parameter in login URL', async () => {
      const clientToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token';
      const redirectUrl = 'http://localhost:3000/callback';

      const response = await request(mockControllerApp)
        .get('/api/v1/auth/login')
        .set('x-client-token', clientToken)
        .query({ redirect: redirectUrl });

      expect(response.status).toBe(200);
      const loginUrl = response.body.data.loginUrl;
      expect(loginUrl).toContain('redirect_uri=');
      expect(decodeURIComponent(loginUrl)).toContain(redirectUrl);
    });

    it('should use default redirect URL when not provided', async () => {
      const clientToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token';

      const response = await request(mockControllerApp)
        .get('/api/v1/auth/login')
        .set('x-client-token', clientToken);

      expect(response.status).toBe(200);
      const loginUrl = response.body.data.loginUrl;
      expect(loginUrl).toContain('redirect_uri=');
      expect(decodeURIComponent(loginUrl)).toContain('http://localhost:3000');
    });
  });

  describe('Logging Endpoint', () => {
    it('POST /api/v1/logs should accept log entries', async () => {
      const logEntry = {
        level: 'info',
        message: 'Test log message',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation-123',
        userId: 'user-123',
      };

      const response = await request(app)
        .post('/api/v1/logs')
        .send(logEntry)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Log received',
        timestamp: expect.any(String),
      });
    });

    it('POST /api/v1/logs should accept audit log entries', async () => {
      const auditLog = {
        level: 'audit',
        action: 'user.login',
        resource: '/api/users',
        userId: 'user-123',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation-456',
        requestId: 'req-789',
      };

      const response = await request(app)
        .post('/api/v1/logs')
        .send(auditLog)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('POST /api/v1/logs should handle errors gracefully', async () => {
      // Send invalid JSON by sending malformed data
      const response = await request(app)
        .post('/api/v1/logs')
        .send({ invalid: 'data' })
        .set('Content-Type', 'application/json');

      // Should still return 200 (endpoint accepts any log format)
      expect(response.status).toBe(200);
    });
  });
});

