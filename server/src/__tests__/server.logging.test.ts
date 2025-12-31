/**
 * Logging Endpoint Integration Tests
 * Tests the logging endpoint functionality
 */

import request from 'supertest';
import express from 'express';
import { loadEnvConfig } from '../config/env';
import { logEndpoint } from '../routes/api';
import { errorHandler, notFoundHandler } from '../middleware/error-handler';
import { corsMiddleware } from '../middleware/cors';

/**
 * Create test Express app with logging route
 */
function createTestApp(): express.Application {
  const app = express();
  const envConfig = loadEnvConfig();

  // Middleware
  app.use(express.json());
  app.use(corsMiddleware(envConfig.misoAllowedOrigins));

  // MisoClient logging endpoint
  app.post('/api/v1/logs', logEndpoint);

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe('Logging Endpoint', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

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
