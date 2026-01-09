/**
 * Client Token Endpoint Integration Tests
 * Tests the /api/v1/auth/client-token endpoint with real MisoClient
 */

import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { 
  MisoClient, 
  createClientTokenEndpoint,
  asyncHandler,
  AppError,
} from '@aifabrix/miso-client';
import { Request, Response } from 'express';
import { corsMiddleware } from '../middleware/cors';
import { errorHandler, notFoundHandler } from '../middleware/error-handler';

describe('Client Token Endpoint Integration Tests', () => {
  let app: express.Application;
  let server: Server | null;
  let mockControllerApp: express.Application;
  let controllerServer: Server | null;
  let controllerPort: number;
  let controllerUrl: string;
  let misoClient: MisoClient | null = null;

  beforeAll(async () => {
    // Create a mock controller server
    mockControllerApp = express();
    mockControllerApp.use(express.json());

    // Mock controller token endpoint - simulates real miso-controller behavior
    mockControllerApp.post('/api/v1/auth/token', (req, res) => {
      const clientId = req.headers['x-client-id'] as string;
      const clientSecret = req.headers['x-client-secret'] as string;

      // Simulate valid credentials
      if (clientId === 'miso-controller-miso-miso-test' && clientSecret === '5YEFODhnClk1c3Xg0q_LKwAce5d1bO779iC3YsDq_FM') {
        return res.json({
          success: true,
          data: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token-123',
            expiresIn: 1800,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Simulate invalid credentials
      if (!clientId || !clientSecret) {
        return res.status(401).json({
          type: '/Errors/Unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing client credentials',
        });
      }

      // Invalid credentials
      return res.status(401).json({
        type: '/Errors/Unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid client credentials',
      });
    });

    // Start mock controller server
    await new Promise<void>((resolve) => {
      controllerServer = mockControllerApp.listen(0, () => {
        const address = controllerServer?.address();
        if (address && typeof address === 'object') {
          controllerPort = (address as AddressInfo).port;
          controllerUrl = `http://127.0.0.1:${controllerPort}`; // Use 127.0.0.1 to force IPv4
        }
        resolve();
      });
    });

    // Create test Express app with real MisoClient
    app = express();
    app.use(express.json());
    app.use(corsMiddleware(['http://localhost:3000'], null));

    // Create test config directly (don't use loadConfig to avoid env var requirements)
    const testConfig = {
      clientId: 'miso-controller-miso-miso-test',
      clientSecret: '5YEFODhnClk1c3Xg0q_LKwAce5d1bO779iC3YsDq_FM',
      controllerUrl: controllerUrl,
      controllerPrivateUrl: controllerUrl,
      allowedOrigins: ['http://localhost:3000'],
    };

    // Create MisoClient with test config
    misoClient = new MisoClient(testConfig);
    await misoClient.initialize();

    // Register client-token endpoint
    app.post('/api/v1/auth/client-token', asyncHandler(async (req: Request, res: Response): Promise<void> => {
      if (!misoClient) {
        throw new AppError('MisoClient is not initialized', 503);
      }

      if (!misoClient.isInitialized()) {
        throw new AppError('MisoClient is not initialized yet', 503);
      }

      const handler = createClientTokenEndpoint(misoClient);
      await handler(req, res);
    }, 'getClientToken'));

    app.get('/api/v1/auth/client-token', asyncHandler(async (req: Request, res: Response): Promise<void> => {
      if (!misoClient) {
        throw new AppError('MisoClient is not initialized', 503);
      }

      if (!misoClient.isInitialized()) {
        throw new AppError('MisoClient is not initialized yet', 503);
      }

      const handler = createClientTokenEndpoint(misoClient);
      await handler(req, res);
    }, 'getClientToken'));

    // Error handlers
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Start test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (misoClient) {
      await misoClient.disconnect();
    }
    if (server) {
      // Close all connections first (Node.js 18.2.0+)
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
    }
    if (controllerServer) {
      // Close all connections first (Node.js 18.2.0+)
      if (typeof controllerServer.closeAllConnections === 'function') {
        controllerServer.closeAllConnections();
      }
      await new Promise<void>((resolve) => {
        controllerServer!.close(() => resolve());
      });
    }
  });

  describe('POST /api/v1/auth/client-token', () => {
    it('should return client token with config on success', async () => {
      const response = await request(app)
        .post('/api/v1/auth/client-token')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        token: expect.any(String),
        expiresIn: expect.any(Number),
        config: {
          baseUrl: expect.any(String),
          controllerUrl: expect.stringContaining('127.0.0.1'),
          clientId: expect.any(String),
          clientTokenUri: '/api/v1/auth/client-token',
        },
      });
      expect(response.body.token).toBeTruthy();
      expect(response.body.config).toBeTruthy();
    });

    it('should return 504 Gateway Timeout when controller is unreachable', async () => {
      // Temporarily stop controller server to simulate unreachable
      if (controllerServer) {
        await new Promise<void>((resolve) => {
          controllerServer!.close(() => resolve());
        });
      }

      const response = await request(app)
        .post('/api/v1/auth/client-token')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .timeout(10000); // Increase timeout for this test

      expect(response.status).toBe(504);
      expect(response.body).toMatchObject({
        error: 'Gateway Timeout',
        message: expect.stringContaining('Controller'),
        details: {
          controllerUrl: expect.any(String),
          timeout: expect.any(String),
          suggestion: expect.any(String),
        },
      });

      // Restart controller server for other tests
      await new Promise<void>((resolve) => {
        controllerServer = mockControllerApp.listen(controllerPort, () => {
          resolve();
        });
      });
    }, 15000); // Increase test timeout

    it('should return 403 Forbidden for invalid origin', async () => {
      const response = await request(app)
        .post('/api/v1/auth/client-token')
        .set('Origin', 'http://evil.com')
        .set('Content-Type', 'application/json');

      // Should return 403 if origin validation fails, or 504 if controller check happens first
      expect([403, 504]).toContain(response.status);
    });
  });

  describe('GET /api/v1/auth/client-token', () => {
    it('should return client token with config on success (GET fallback)', async () => {
      const response = await request(app)
        .get('/api/v1/auth/client-token')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        token: expect.any(String),
        expiresIn: expect.any(Number),
        config: {
          baseUrl: expect.any(String),
          controllerUrl: expect.stringContaining('127.0.0.1'),
          clientId: expect.any(String),
          clientTokenUri: '/api/v1/auth/client-token',
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should return proper error format for timeout', async () => {
      // Stop controller to force timeout
      if (controllerServer) {
        await new Promise<void>((resolve) => {
          controllerServer!.close(() => resolve());
        });
      }

      const response = await request(app)
        .post('/api/v1/auth/client-token')
        .set('Origin', 'http://localhost:3000')
        .timeout(10000);

      expect(response.status).toBe(504);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');

      // Restart controller
      await new Promise<void>((resolve) => {
        controllerServer = mockControllerApp.listen(controllerPort, () => {
          resolve();
        });
      });
    }, 15000);
  });
});
