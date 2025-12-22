/**
 * Controller Login Endpoint Integration Tests
 * Tests the mock controller login endpoint behavior
 */

import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';

describe('Redirect to Login - Controller Endpoint', () => {
  // Mock controller login endpoint
  let mockControllerApp: express.Application;
  let controllerServer: Server | null;
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
        const address = controllerServer?.address();
        if (address && typeof address === 'object') {
          _controllerPort = (address as AddressInfo).port;
        }
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

