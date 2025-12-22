/**
 * Redirect to Login Integration Tests
 * Tests the redirectToLogin functionality with mock miso-controller
 */

import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
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
  let controllerServer: Server | null;
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
        const address = controllerServer?.address();
        if (address && typeof address === 'object') {
          controllerPort = (address as AddressInfo).port;
          controllerUrl = `http://localhost:${controllerPort}`;
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
    interface MockLocation {
      href: string;
      origin: string;
      protocol: string;
      host: string;
      hostname: string;
      port: string;
      pathname: string;
    }
    interface MockWindow {
      location: MockLocation;
    }
    interface MockLocalStorage {
      getItem: jest.Mock;
      setItem: jest.Mock;
      removeItem: jest.Mock;
      clear: jest.Mock;
    }
    let mockWindow: MockWindow;
    let mockLocation: MockLocation;
    let originalFetch: typeof global.fetch | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let originalWindow: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let originalLocalStorage: any;
    let consoleErrorSpy: jest.SpyInstance;
    beforeEach(() => {
      // Mock console.error to capture errors (but allow console.log for debugging)
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Save originals
      originalFetch = global.fetch;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      originalWindow = (global as any).window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      (global as unknown as { window: MockWindow }).window = mockWindow;
      (global as unknown as { localStorage: MockLocalStorage }).localStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    });

    afterEach(() => {
      // Restore originals
      if (originalFetch) {
        global.fetch = originalFetch;
      } else {
        delete (global as unknown as { fetch?: typeof fetch }).fetch;
      }
      if (originalWindow !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).window = originalWindow;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (global as any).window;
      }
      if (originalLocalStorage !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).localStorage = originalLocalStorage;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (global as any).localStorage;
      }
      consoleErrorSpy.mockRestore();
    });

    it('should call controller login endpoint with client token', async () => {
      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        loginUrl: '/login',
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

        console.log('[TEST] Calling redirectToLogin...');
        await dataClient.redirectToLogin('http://localhost:3000/dashboard');
        console.log('[TEST] redirectToLogin completed');

        // Verify getClientToken was called
        expect(mockGetClientToken).toHaveBeenCalled();

        // Verify window.location.href was set to controller login URL with query params
        // Note: URL search params order is not guaranteed, so we check components individually
        expect(mockLocation.href).toContain(`${controllerUrl}/login`);
        expect(mockLocation.href).toContain('redirect=http%3A%2F%2Flocalhost%3A3000%2Fdashboard');
        expect(mockLocation.href).toContain('x-client-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
        
        // Verify URL is valid and contains both parameters
        const url = new URL(mockLocation.href);
        expect(url.pathname).toBe('/login');
        expect(url.searchParams.get('redirect')).toBe('http://localhost:3000/dashboard');
        expect(url.searchParams.get('x-client-token')).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      } catch (error) {
        console.error('[TEST] Error in redirectToLogin test:', error);
        console.error('[TEST] Error stack:', (error as Error).stack);
        throw error;
      }
    });

    it('should redirect to controller login page even without client token', async () => {
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
      const mockGetClientToken = jest.fn().mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      await dataClient.redirectToLogin();
      
      // Should redirect to controller login URL without x-client-token if token is null
      expect(mockLocation.href).toContain(`${controllerUrl}/login?redirect=`);
      expect(mockLocation.href).not.toContain('x-client-token');
    });

    it('should redirect to controller login page with custom loginUrl', async () => {
      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        loginUrl: '/custom-login',
        misoConfig: {
          controllerUrl: controllerUrl,
          controllerPublicUrl: controllerUrl,
          clientId: 'test-client',
        },
      };

      const dataClient = new DataClient(config);
      const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      await dataClient.redirectToLogin('http://localhost:3000/dashboard');

      // Should redirect to custom login URL
      // Note: URL search params order is not guaranteed, so we check components individually
      expect(mockLocation.href).toContain(`${controllerUrl}/custom-login`);
      expect(mockLocation.href).toContain('redirect=http%3A%2F%2Flocalhost%3A3000%2Fdashboard');
      expect(mockLocation.href).toContain('x-client-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      
      // Verify URL is valid and contains both parameters
      const url = new URL(mockLocation.href);
      expect(url.pathname).toBe('/custom-login');
      expect(url.searchParams.get('redirect')).toBe('http://localhost:3000/dashboard');
      expect(url.searchParams.get('x-client-token')).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
    });

    it('should use current page URL as redirect when not provided', async () => {
      mockLocation.href = 'http://localhost:3000/current-page';

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      await dataClient.redirectToLogin();

      // Verify redirect parameter uses current page URL
      expect(mockLocation.href).toContain('redirect=http%3A%2F%2Flocalhost%3A3000%2Fcurrent-page');
      expect(mockLocation.href).toContain(`${controllerUrl}/login`);
    });

    it('should support full URL loginUrl in config', async () => {
      const fullLoginUrl = 'https://keycloak.example.com/auth';
      mockLocation.href = 'http://localhost:3000/current-page';

      const config: DataClientConfig = {
        baseUrl: 'http://localhost:3000',
        loginUrl: fullLoginUrl,
        misoConfig: {
          controllerUrl: controllerUrl,
          controllerPublicUrl: controllerUrl,
          clientId: 'test-client',
        },
      };

      const dataClient = new DataClient(config);
      const mockGetClientToken = jest.fn().mockResolvedValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      await dataClient.redirectToLogin();

      // Should use full URL from config
      expect(mockLocation.href).toContain(fullLoginUrl);
      expect(mockLocation.href).toContain('redirect=http%3A%2F%2Flocalhost%3A3000%2Fcurrent-page');
    });

    it('should redirect successfully when controller URL is configured', async () => {
      // This test verifies that redirectToLogin works correctly when controller URL is properly configured
      // Note: DataClient constructor requires controller URL, so we always test with a valid config
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(dataClient as any, 'getClientToken').mockImplementation(mockGetClientToken);

      await dataClient.redirectToLogin('http://localhost:3000/dashboard');

      // Should redirect to controller login URL
      expect(mockLocation.href).toContain(`${controllerUrl}/login`);
      expect(mockLocation.href).toContain('redirect=http%3A%2F%2Flocalhost%3A3000%2Fdashboard');
      expect(mockLocation.href).toContain('x-client-token');
    });
  });
});

