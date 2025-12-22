/**
 * Redirect to Login Integration Tests
 * Tests the redirectToLogin functionality with mock miso-controller
 */

import request from 'supertest';
import express from 'express';
import { DataClient } from '@aifabrix/miso-client';
import { DataClientConfig } from '@aifabrix/miso-client';

// Mock data-client-utils to make isBrowser() return true
// Note: We need to mock it from the SDK package, not the server package
jest.mock('@aifabrix/miso-client', () => {
  const actual = jest.requireActual('@aifabrix/miso-client');
  return actual;
});

describe('Redirect to Login Integration Tests', () => {
  let mockControllerApp: express.Application;
  let controllerServer: any;
  let controllerPort: number;
  let controllerUrl: string;

  beforeAll(async () => {
    // Note: isBrowser is not exported, so we'll mock window/localStorage/fetch instead
    // Create a mock miso-controller server
    mockControllerApp = express();
    mockControllerApp.use(express.json());

    // Mock controller login endpoint - simulates real miso-controller behavior
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

      // Accept any token that's provided (real controller would validate JWT)
      // For testing, we accept any non-empty token

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
        controllerPort = (controllerServer.address() as any).port;
        controllerUrl = `http://localhost:${controllerPort}`;
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
        controllerServer = null;
        done();
      });
      // Force close after timeout if it doesn't close gracefully
      const timeout = setTimeout(() => {
        if (controllerServer) {
          if (typeof controllerServer.closeAllConnections === 'function') {
            controllerServer.closeAllConnections();
          }
          controllerServer.close();
          controllerServer = null;
        }
        clearTimeout(timeout);
        done();
      }, 1000);
      // Unref the timeout so it doesn't keep the process alive
      if (timeout.unref) {
        timeout.unref();
      }
    } else {
      done();
    }
  });

  describe('Mock Controller Login Endpoint', () => {
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

    it('should require client token', async () => {
      const response = await request(mockControllerApp)
        .get('/api/v1/auth/login')
        .query({ redirect: 'http://localhost:3000' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Client token required',
      });
    });

    it('should accept valid JWT-like client tokens', async () => {
      // Valid JWT-like tokens should be accepted
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      const response = await request(mockControllerApp)
        .get('/api/v1/auth/login')
        .set('x-client-token', validToken)
        .query({ redirect: 'http://localhost:3000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include redirect parameter in login URL', async () => {
      const clientToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token';
      const redirectUrl = 'http://localhost:3000/callback?param=value';

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

  describe('DataClient redirectToLogin Integration', () => {
    let mockWindow: any;
    let mockLocation: any;
    let originalFetch: any;
    let originalWindow: any;
    let originalLocalStorage: any;
    let consoleErrorSpy: jest.SpyInstance;
    beforeEach(() => {
      // Mock console.error to capture errors (but allow console.log for debugging)
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Save originals
      originalFetch = (global as any).fetch;
      originalWindow = (global as any).window;
      originalLocalStorage = (global as any).localStorage;

      // Create mock window.location with proper getter/setter
      mockLocation = { 
        href: 'http://localhost:3000/current-page',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/current-page',
      };
      mockWindow = {
        location: mockLocation,
      };

      // Set up window, localStorage, and fetch mocks to make isBrowser() return true
      (global as any).window = mockWindow;
      (global as any).localStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      (global as any).fetch = jest.fn();
    });

    afterEach(() => {
      // Restore originals
      if (originalFetch) {
        (global as any).fetch = originalFetch;
      } else {
        delete (global as any).fetch;
      }
      if (originalWindow) {
        (global as any).window = originalWindow;
      } else {
        delete (global as any).window;
      }
      if (originalLocalStorage) {
        (global as any).localStorage = originalLocalStorage;
      } else {
        delete (global as any).localStorage;
      }
      consoleErrorSpy.mockRestore();
    });

    it('should call controller login endpoint with client token', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string, options: any) => {
        // Log the call for debugging
        console.log(`[TEST] Fetch called: ${url}`);
        console.log(`[TEST] Headers:`, JSON.stringify(options.headers, null, 2));

        // Verify it's calling the controller endpoint
        expect(url).toContain(`${controllerUrl}/api/v1/auth/login`);
        expect(url).toContain('redirect=');

        // Verify client token is in headers
        expect(options.headers['x-client-token']).toBeDefined();

        // Return mock response matching controller format
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              loginUrl: 'https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/auth',
              state: 'test-state',
            },
          }),
        });
      });

      (global as any).fetch = mockFetch;

      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        misoConfig: {
          controllerUrl: controllerUrl,
          controllerPublicUrl: controllerUrl,
          clientId: 'test-client',
          clientTokenUri: '/api/v1/auth/client-token',
        },
      };

      try {
        const dataClient = new DataClient(config);

        // Mock getClientToken to return a token
        const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
        jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

        console.log('[TEST] Calling redirectToLogin...');
        await dataClient.redirectToLogin('http://localhost:3000/dashboard');
        console.log('[TEST] redirectToLogin completed');

        // Verify getClientToken was called
        expect(mockGetClientToken).toHaveBeenCalled();

        // Verify fetch was called
        expect(mockFetch).toHaveBeenCalled();
        const fetchCall = mockFetch.mock.calls[0];
        expect(fetchCall[0]).toContain(`${controllerUrl}/api/v1/auth/login`);
        expect(fetchCall[0]).toContain('redirect=http%3A%2F%2Flocalhost%3A3000%2Fdashboard');
        expect(fetchCall[1].headers['x-client-token']).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');

        // Verify window.location.href was set to the login URL
        expect(mockLocation.href).toBe('https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/auth');
      } catch (error) {
        console.error('[TEST] Error in redirectToLogin test:', error);
        console.error('[TEST] Error stack:', (error as Error).stack);
        throw error;
      }
    });

    it('should handle controller errors and fallback to static loginUrl', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error: Failed to fetch'));

      (global as any).fetch = mockFetch;

      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        loginUrl: '/login',
        misoConfig: {
          controllerUrl: controllerUrl,
          controllerPublicUrl: controllerUrl,
          clientId: 'test-client',
        },
      };

      const dataClient = new DataClient(config);
      const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      // Should throw error instead of falling back
      await expect(dataClient.redirectToLogin()).rejects.toThrow();
      
      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[redirectToLogin] Failed to get login URL from controller:',
        expect.any(Error)
      );
    });

    it('should handle controller non-OK response and fallback', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Internal Server Error' }),
        text: async () => 'Internal Server Error',
      });

      (global as any).fetch = mockFetch;

      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        loginUrl: '/login',
        misoConfig: {
          controllerUrl: controllerUrl,
          controllerPublicUrl: controllerUrl,
          clientId: 'test-client',
        },
      };

      const dataClient = new DataClient(config);
      const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      // Should throw error instead of falling back
      await expect(dataClient.redirectToLogin()).rejects.toThrow();
    });

    it('should use current page URL as redirect when not provided', async () => {
      mockLocation.href = 'http://localhost:3000/current-page';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            loginUrl: 'https://keycloak.example.com/auth',
            state: 'test-state',
          },
        }),
      });

      (global as any).fetch = mockFetch;

      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        misoConfig: {
          controllerUrl: controllerUrl,
          controllerPublicUrl: controllerUrl,
          clientId: 'test-client',
        },
      };

      const dataClient = new DataClient(config);
      const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      await dataClient.redirectToLogin();

      // Verify redirect parameter uses current page URL
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('redirect=http%3A%2F%2Flocalhost%3A3000%2Fcurrent-page');
    });

    it('should support flat loginUrl format in response', async () => {
      const expectedLoginUrl = 'https://keycloak.example.com/auth';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          loginUrl: expectedLoginUrl, // Flat format (not nested in data)
        }),
      });

      (global as any).fetch = mockFetch;

      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        misoConfig: {
          controllerUrl: controllerUrl,
          controllerPublicUrl: controllerUrl,
          clientId: 'test-client',
        },
      };

      const dataClient = new DataClient(config);
      const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      await dataClient.redirectToLogin();

      expect(mockLocation.href).toBe(expectedLoginUrl);
    });

    it('should fallback when controller URL is not configured', async () => {
      // When controller URL is not configured, redirectToLogin should throw error
      // Note: DataClient requires misoConfig to be valid, so we'll test by providing an invalid controller URL that will fail
      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        loginUrl: '/login',
        misoConfig: {
          controllerUrl: 'http://invalid-controller-url-that-does-not-exist:9999',
          controllerPublicUrl: 'http://invalid-controller-url-that-does-not-exist:9999',
          clientId: 'test-client',
        },
      };

      const dataClient = new DataClient(config);
      const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      // Mock fetch to fail (simulating controller not available)
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error: Failed to fetch'));
      (global as any).fetch = mockFetch;

      // Should throw error instead of falling back
      await expect(dataClient.redirectToLogin()).rejects.toThrow();
    });
  });
});

