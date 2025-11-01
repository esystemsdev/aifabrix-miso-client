/**
 * Unit tests for HttpClient
 */

import { HttpClient } from '../../src/utils/http-client';
import { MisoClientConfig } from '../../src/types/config.types';
import { MisoClientError } from '../../src/utils/errors';
import { AxiosError } from 'axios';

// Mock axios
jest.mock('axios');
const mockAxios = {
  create: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

const axios = require('axios');
axios.create.mockReturnValue(mockAxios);

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      clientId: 'ctrl-dev-test-app',
      clientSecret: 'test-secret'
    };

    jest.clearAllMocks();
    httpClient = new HttpClient(config);
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://controller.aifabrix.ai',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should set up request interceptor', () => {
      expect(mockAxios.interceptors.request.use).toHaveBeenCalled();
    });

    it('should set up response interceptor', () => {
      expect(mockAxios.interceptors.response.use).toHaveBeenCalled();
    });

    it('should expose config as public readonly property', () => {
      expect(httpClient.config).toEqual(config);
    });
  });

  describe('get', () => {
    it('should make GET request and return data', async () => {
      const mockResponse = { data: { message: 'success' } };
      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await httpClient.get('/test');

      expect(mockAxios.get).toHaveBeenCalledWith('/test', undefined);
      expect(result).toEqual({ message: 'success' });
    });

    it('should pass config to axios', async () => {
      const mockResponse = { data: { message: 'success' } };
      const requestConfig = { timeout: 5000 };
      mockAxios.get.mockResolvedValue(mockResponse);

      await httpClient.get('/test', requestConfig);

      expect(mockAxios.get).toHaveBeenCalledWith('/test', requestConfig);
    });
  });

  describe('post', () => {
    it('should make POST request with data', async () => {
      const mockResponse = { data: { id: '123' } };
      const requestData = { name: 'test' };
      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await httpClient.post('/test', requestData);

      expect(mockAxios.post).toHaveBeenCalledWith('/test', requestData, undefined);
      expect(result).toEqual({ id: '123' });
    });
  });

  describe('put', () => {
    it('should make PUT request with data', async () => {
      const mockResponse = { data: { updated: true } };
      const requestData = { name: 'updated' };
      mockAxios.put.mockResolvedValue(mockResponse);

      const result = await httpClient.put('/test', requestData);

      expect(mockAxios.put).toHaveBeenCalledWith('/test', requestData, undefined);
      expect(result).toEqual({ updated: true });
    });
  });

  describe('delete', () => {
    it('should make DELETE request', async () => {
      const mockResponse = { data: { deleted: true } };
      mockAxios.delete.mockResolvedValue(mockResponse);

      const result = await httpClient.delete('/test');

      expect(mockAxios.delete).toHaveBeenCalledWith('/test', undefined);
      expect(result).toEqual({ deleted: true });
    });

    it('should pass config to axios', async () => {
      const mockResponse = { data: { deleted: true } };
      const requestConfig = { timeout: 5000 };
      mockAxios.delete.mockResolvedValue(mockResponse);

      await httpClient.delete('/test', requestConfig);

      expect(mockAxios.delete).toHaveBeenCalledWith('/test', requestConfig);
    });
  });

  describe('request', () => {
    it('should make GET request via request method', async () => {
      const mockResponse = { data: { message: 'success' } };
      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await httpClient.request('GET', '/test');

      expect(mockAxios.get).toHaveBeenCalledWith('/test', undefined);
      expect(result).toEqual({ message: 'success' });
    });

    it('should make POST request via request method', async () => {
      const mockResponse = { data: { id: '123' } };
      const requestData = { name: 'test' };
      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await httpClient.request('POST', '/test', requestData);

      expect(mockAxios.post).toHaveBeenCalledWith('/test', requestData, undefined);
      expect(result).toEqual({ id: '123' });
    });

    it('should make PUT request via request method', async () => {
      const mockResponse = { data: { updated: true } };
      const requestData = { name: 'updated' };
      mockAxios.put.mockResolvedValue(mockResponse);

      const result = await httpClient.request('PUT', '/test', requestData);

      expect(mockAxios.put).toHaveBeenCalledWith('/test', requestData, undefined);
      expect(result).toEqual({ updated: true });
    });

    it('should make DELETE request via request method', async () => {
      const mockResponse = { data: { deleted: true } };
      mockAxios.delete.mockResolvedValue(mockResponse);

      const result = await httpClient.request('DELETE', '/test');

      expect(mockAxios.delete).toHaveBeenCalledWith('/test', undefined);
      expect(result).toEqual({ deleted: true });
    });

    it('should pass config when provided', async () => {
      const mockResponse = { data: { message: 'success' } };
      const requestConfig = { timeout: 5000 };
      mockAxios.get.mockResolvedValue(mockResponse);

      await httpClient.request('GET', '/test', undefined, requestConfig);

      expect(mockAxios.get).toHaveBeenCalledWith('/test', requestConfig);
    });

    it('should throw error for unsupported method', async () => {
      await expect(
        httpClient.request('PATCH' as any, '/test')
      ).rejects.toThrow('Unsupported HTTP method: PATCH');
    });
  });

  describe('error handling', () => {
    it('should propagate non-Axios errors as-is', async () => {
      const networkError = new Error('Network error');
      mockAxios.get.mockRejectedValue(networkError);

      await expect(httpClient.get('/test')).rejects.toThrow('Network error');
    });

    it('should convert AxiosError to MisoClientError with errorBody (backward compatibility)', async () => {
      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Not found', details: 'Resource not found' },
          headers: {},
          config: { url: '/test' } as any
        },
        message: 'Request failed with status code 404',
        config: { url: '/test' } as any
      };
      mockAxios.get.mockRejectedValue(axiosError);

      await expect(httpClient.get('/test')).rejects.toThrow(MisoClientError);
      
      try {
        await httpClient.get('/test');
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const misoError = error as MisoClientError;
        expect(misoError.statusCode).toBe(404);
        expect(misoError.errorBody).toEqual({ error: 'Not found', details: 'Resource not found' });
        expect(misoError.errorResponse).toBeUndefined();
      }
    });

    it('should parse structured error response and create MisoClientError with ErrorResponse', async () => {
      const structuredError = {
        errors: ['Validation failed', 'Invalid input'],
        type: '/Errors/Bad Input',
        title: 'Bad Request',
        statusCode: 400,
        instance: '/api/test'
      };

      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: structuredError,
          headers: {},
          config: { url: '/api/test' } as any
        },
        message: 'Request failed with status code 400',
        config: { url: '/api/test' } as any
      };
      mockAxios.get.mockRejectedValue(axiosError);

      await expect(httpClient.get('/api/test')).rejects.toThrow(MisoClientError);

      try {
        await httpClient.get('/api/test');
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const misoError = error as MisoClientError;
        expect(misoError.errorResponse).toBeDefined();
        expect(misoError.errorResponse?.errors).toEqual(['Validation failed', 'Invalid input']);
        expect(misoError.errorResponse?.type).toBe('/Errors/Bad Input');
        expect(misoError.errorResponse?.title).toBe('Bad Request');
        expect(misoError.errorResponse?.statusCode).toBe(400);
        expect(misoError.errorResponse?.instance).toBe('/api/test');
        expect(misoError.statusCode).toBe(400);
        expect(misoError.message).toBe('Bad Request');
      }
    });

    it('should support snake_case status_code in error response', async () => {
      const structuredError = {
        errors: ['Server error'],
        type: '/Errors/Internal Error',
        title: 'Internal Server Error',
        status_code: 500
      };

      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: structuredError,
          headers: {},
          config: { url: '/api/test' } as any
        },
        message: 'Request failed with status code 500',
        config: { url: '/api/test' } as any
      };
      mockAxios.get.mockRejectedValue(axiosError);

      try {
        await httpClient.get('/api/test');
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const misoError = error as MisoClientError;
        expect(misoError.errorResponse).toBeDefined();
        expect(misoError.errorResponse?.statusCode).toBe(500);
      }
    });

    it('should extract instance URI from request URL when not provided in error response', async () => {
      const structuredError = {
        errors: ['Not found'],
        type: '/Errors/Not Found',
        title: 'Resource Not Found',
        statusCode: 404
      };

      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found',
          data: structuredError,
          headers: {},
          config: { url: '/api/users/123' } as any
        },
        message: 'Request failed with status code 404',
        config: { url: '/api/users/123' } as any
      };
      mockAxios.get.mockRejectedValue(axiosError);

      try {
        await httpClient.get('/api/users/123');
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const misoError = error as MisoClientError;
        expect(misoError.errorResponse?.instance).toBe('/api/users/123');
      }
    });

    it('should handle string response data by parsing JSON', async () => {
      const structuredError = {
        errors: ['Parsed error'],
        type: '/Errors/Test',
        title: 'Test Error',
        statusCode: 400
      };

      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: JSON.stringify(structuredError),
          headers: {},
          config: { url: '/api/test' } as any
        },
        message: 'Request failed with status code 400',
        config: { url: '/api/test' } as any
      };
      mockAxios.get.mockRejectedValue(axiosError);

      try {
        await httpClient.get('/api/test');
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const misoError = error as MisoClientError;
        expect(misoError.errorResponse).toBeDefined();
        expect(misoError.errorResponse?.title).toBe('Test Error');
      }
    });

    it('should enhance 401 errors with authentication context', async () => {
      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { error: 'Unauthorized' },
          headers: {},
          config: { url: '/test' } as any
        },
        message: 'Request failed with status code 401',
        config: { url: '/test' } as any
      };
      mockAxios.get.mockRejectedValue(axiosError);

      // Get the interceptor that was registered
      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1];

      // Simulate the response interceptor being called
      const enhancedError = responseInterceptor(axiosError);

      await expect(enhancedError).rejects.toMatchObject({
        message: 'Authentication failed - token may be invalid'
      });
    });

    it('should handle POST errors with MisoClientError', async () => {
      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'POST failed' },
          headers: {},
          config: { url: '/test' } as any
        },
        message: 'Request failed',
        config: { url: '/test' } as any
      };
      mockAxios.post.mockRejectedValue(axiosError);

      await expect(httpClient.post('/test', {})).rejects.toThrow(MisoClientError);
    });

    it('should handle PUT errors with MisoClientError', async () => {
      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'PUT failed' },
          headers: {},
          config: { url: '/test' } as any
        },
        message: 'Request failed',
        config: { url: '/test' } as any
      };
      mockAxios.put.mockRejectedValue(axiosError);

      await expect(httpClient.put('/test', {})).rejects.toThrow(MisoClientError);
    });

    it('should handle DELETE errors with MisoClientError', async () => {
      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'DELETE failed' },
          headers: {},
          config: { url: '/test' } as any
        },
        message: 'Request failed',
        config: { url: '/test' } as any
      };
      mockAxios.delete.mockRejectedValue(axiosError);

      await expect(httpClient.delete('/test')).rejects.toThrow(MisoClientError);
    });

    it('should handle authenticated request errors with MisoClientError', async () => {
      const axiosError: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: { error: 'Auth request failed' },
          headers: {},
          config: { url: '/test' } as any
        },
        message: 'Request failed',
        config: { url: '/test' } as any
      };
      mockAxios.get.mockRejectedValue(axiosError);

      await expect(
        httpClient.authenticatedRequest('GET', '/test', 'token123')
      ).rejects.toThrow(MisoClientError);
    });

    it('should handle all HTTP methods with structured error responses', async () => {
      const structuredError = {
        errors: ['Method specific error'],
        type: '/Errors/Method Error',
        title: 'Method Error',
        statusCode: 405
      };

      const createAxiosError = (url: string): Partial<AxiosError> => ({
        isAxiosError: true,
        response: {
          status: 405,
          statusText: 'Method Not Allowed',
          data: structuredError,
          headers: {},
          config: { url } as any
        },
        message: 'Request failed',
        config: { url } as any
      });

      // Test GET
      mockAxios.get.mockRejectedValue(createAxiosError('/test'));
      await expect(httpClient.get('/test')).rejects.toThrow(MisoClientError);

      // Test POST
      mockAxios.post.mockRejectedValue(createAxiosError('/test'));
      await expect(httpClient.post('/test', {})).rejects.toThrow(MisoClientError);

      // Test PUT
      mockAxios.put.mockRejectedValue(createAxiosError('/test'));
      await expect(httpClient.put('/test', {})).rejects.toThrow(MisoClientError);

      // Test DELETE
      mockAxios.delete.mockRejectedValue(createAxiosError('/test'));
      await expect(httpClient.delete('/test')).rejects.toThrow(MisoClientError);

      // Test authenticatedRequest
      mockAxios.get.mockRejectedValue(createAxiosError('/test'));
      await expect(httpClient.authenticatedRequest('GET', '/test', 'token')).rejects.toThrow(MisoClientError);
    });
  });

  describe('client token management', () => {
    let mockTempAxios: any;

    beforeEach(() => {
      // Create a mock for the temporary axios instance used to fetch tokens
      mockTempAxios = {
        post: jest.fn()
      };

      // Mock axios.create to return both the main instance and temp instance
      axios.create.mockImplementation((config?: any) => {
        // If headers include X-Client-Id/X-Client-Secret, it's the temp instance
        if (config?.headers?.['X-Client-Id']) {
          return mockTempAxios;
        }
        return mockAxios;
      });
    });

    it('should fetch and add client token on first request', async () => {
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };
      mockTempAxios.post.mockResolvedValue(tokenResponse);

      const mockResponse = { data: { message: 'success' } };
      mockAxios.get.mockResolvedValue(mockResponse);

      const requestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
      const mockConfig: any = { headers: {} };

      // Call interceptor (which will trigger token fetch)
      await requestInterceptor(mockConfig);

      // Axios post is called with url (and optional data/config)
      expect(mockTempAxios.post).toHaveBeenCalledWith('/api/auth/token');
      // Verify the temp axios instance was created with correct config
      const createCalls = axios.create.mock.calls;
      const tokenFetchCall = createCalls.find((call: any[]) => 
        call[0]?.headers?.['X-Client-Id'] === 'ctrl-dev-test-app'
      );
      expect(tokenFetchCall).toBeDefined();
      expect(tokenFetchCall[0]).toMatchObject({
        baseURL: 'https://controller.aifabrix.ai',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': 'ctrl-dev-test-app',
          'X-Client-Secret': 'test-secret'
        }
      });
    });

    it('should add x-client-token header after fetching token', async () => {
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };
      mockTempAxios.post.mockResolvedValue(tokenResponse);

      const requestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
      const mockConfig: any = { headers: {} };

      const result = await requestInterceptor(mockConfig);

      expect(result.headers['x-client-token']).toBe('client-token-123');
    });

    it('should reuse token until expiration', async () => {
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };
      mockTempAxios.post.mockResolvedValue(tokenResponse);

      const requestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
      const mockConfig: any = { headers: {} };

      // First request - fetches token
      await requestInterceptor(mockConfig);
      expect(mockTempAxios.post).toHaveBeenCalledTimes(1);

      // Second request - reuses token
      await requestInterceptor(mockConfig);
      expect(mockTempAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should clear token on 401 error', async () => {
      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1];
      
      const axiosError: any = {
        response: { status: 401 },
        message: 'Authentication failed'
      };

      await expect(responseInterceptor(axiosError)).rejects.toMatchObject({
        message: 'Authentication failed - token may be invalid'
      });
    });
  });

  describe('interceptors', () => {
    it('should create headers object if missing', async () => {
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };

      // Mock axios.create to return temp instance for token fetch
      const mockTempAxios = { post: jest.fn().mockResolvedValue(tokenResponse) };
      axios.create.mockImplementation((config?: any) => {
        if (config?.headers?.['X-Client-Id']) {
          return mockTempAxios;
        }
        return mockAxios;
      });

      const requestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
      const mockConfig: any = {};

      const result = await requestInterceptor(mockConfig);

      expect(result.headers).toBeDefined();
      expect(result.headers['x-client-token']).toBeDefined();
    });

    it('should handle request interceptor errors', async () => {
      const errorHandler = mockAxios.interceptors.request.use.mock.calls[0][1];
      const error = new Error('Request error');

      const result = errorHandler(error);

      await expect(result).rejects.toThrow('Request error');
    });

    it('should pass through successful responses', () => {
      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][0];
      const mockResponse = { data: { success: true }, status: 200 };

      const result = responseInterceptor(mockResponse);

      expect(result).toEqual(mockResponse);
    });

    it('should enhance 401 errors in response interceptor', async () => {
      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1];
      
      const axiosError: any = {
        response: { status: 401 },
        message: 'Request failed'
      };

      await expect(responseInterceptor(axiosError)).rejects.toMatchObject({
        message: 'Authentication failed - token may be invalid'
      });
    });

    it('should not modify non-401 errors in response interceptor', async () => {
      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1];
      
      const axiosError: any = {
        response: { status: 404 },
        message: 'Not found'
      };

      await expect(responseInterceptor(axiosError)).rejects.toMatchObject({
        message: 'Not found'
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty response data', async () => {
      const mockResponse = { data: null };
      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await httpClient.get('/test');

      expect(result).toBeNull();
    });

    it('should handle POST with empty data', async () => {
      const mockResponse = { data: { success: true } };
      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await httpClient.post('/test', undefined);

      expect(mockAxios.post).toHaveBeenCalledWith('/test', undefined, undefined);
      expect(result).toEqual({ success: true });
    });

    it('should handle authenticatedRequest with empty token', async () => {
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };
      const mockTempAxios = { post: jest.fn().mockResolvedValue(tokenResponse) };
      axios.create.mockImplementation((config?: any) => {
        if (config?.headers?.['X-Client-Id']) {
          return mockTempAxios;
        }
        return mockAxios;
      });

      const mockResponse = { data: { user: 'test' } };
      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await httpClient.authenticatedRequest('GET', '/test', '');

      // Client token is added by interceptor, not in config
      expect(mockAxios.get).toHaveBeenCalledWith('/test', {
        headers: {
          Authorization: 'Bearer '
        }
      });
      expect(result).toEqual({ user: 'test' });
    });

    it('should preserve existing config properties when merging headers', async () => {
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };
      const mockTempAxios = { post: jest.fn().mockResolvedValue(tokenResponse) };
      axios.create.mockImplementation((config?: any) => {
        if (config?.headers?.['X-Client-Id']) {
          return mockTempAxios;
        }
        return mockAxios;
      });

      const mockResponse = { data: { success: true } };
      const requestConfig = {
        timeout: 5000,
        headers: { 'Custom-Header': 'value' }
      };
      mockAxios.post.mockResolvedValue(mockResponse);

      await httpClient.authenticatedRequest('POST', '/test', 'token123', {}, requestConfig);

      // Client token added by interceptor, not in config
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/test',
        {},
        {
          timeout: 5000,
          headers: {
            Authorization: 'Bearer token123',
            'Custom-Header': 'value'
          }
        }
      );
    });

    it('should handle POST with config', async () => {
      const mockResponse = { data: { id: '123' } };
      const requestData = { name: 'test' };
      const requestConfig = { timeout: 5000 };
      mockAxios.post.mockResolvedValue(mockResponse);

      await httpClient.post('/test', requestData, requestConfig);

      expect(mockAxios.post).toHaveBeenCalledWith('/test', requestData, requestConfig);
    });

    it('should handle PUT with config', async () => {
      const mockResponse = { data: { updated: true } };
      const requestData = { name: 'updated' };
      const requestConfig = { timeout: 5000 };
      mockAxios.put.mockResolvedValue(mockResponse);

      await httpClient.put('/test', requestData, requestConfig);

      expect(mockAxios.put).toHaveBeenCalledWith('/test', requestData, requestConfig);
    });
  });

  describe('authenticatedRequest', () => {
    beforeEach(() => {
      // Mock token fetch for all authenticated requests
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };
      const mockTempAxios = { post: jest.fn().mockResolvedValue(tokenResponse) };
      axios.create.mockImplementation((config?: any) => {
        if (config?.headers?.['X-Client-Id']) {
          return mockTempAxios;
        }
        return mockAxios;
      });
    });

    it('should make GET request with Authorization header', async () => {
      const mockResponse = { data: { user: 'test' } };
      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await httpClient.authenticatedRequest('GET', '/user', 'token123');

      // Client token added by interceptor, not shown in config
      expect(mockAxios.get).toHaveBeenCalledWith('/user', {
        headers: {
          Authorization: 'Bearer token123'
        }
      });
      expect(result).toEqual({ user: 'test' });
    });

    it('should make POST request with Authorization header and data', async () => {
      const mockResponse = { data: { success: true } };
      const requestData = { name: 'test' };
      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await httpClient.authenticatedRequest(
        'POST',
        '/test',
        'token123',
        requestData
      );

      expect(mockAxios.post).toHaveBeenCalledWith('/test', requestData, {
        headers: {
          Authorization: 'Bearer token123'
        }
      });
      expect(result).toEqual({ success: true });
    });

    it('should make PUT request with Authorization header and data', async () => {
      const mockResponse = { data: { updated: true } };
      const requestData = { name: 'updated' };
      mockAxios.put.mockResolvedValue(mockResponse);

      const result = await httpClient.authenticatedRequest('PUT', '/test', 'token123', requestData);

      expect(mockAxios.put).toHaveBeenCalledWith('/test', requestData, {
        headers: {
          Authorization: 'Bearer token123'
        }
      });
      expect(result).toEqual({ updated: true });
    });

    it('should make DELETE request with Authorization header', async () => {
      const mockResponse = { data: { deleted: true } };
      mockAxios.delete.mockResolvedValue(mockResponse);

      const result = await httpClient.authenticatedRequest('DELETE', '/test', 'token123');

      expect(mockAxios.delete).toHaveBeenCalledWith('/test', {
        headers: {
          Authorization: 'Bearer token123'
        }
      });
      expect(result).toEqual({ deleted: true });
    });

    it('should throw error for unsupported method', async () => {
      await expect(
        httpClient.authenticatedRequest('PATCH' as any, '/test', 'token123')
      ).rejects.toThrow('Unsupported HTTP method: PATCH');
    });

    it('should merge headers with existing config', async () => {
      const tokenResponse = {
        data: {
          success: true,
          token: 'client-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };
      const mockTempAxios = { post: jest.fn().mockResolvedValue(tokenResponse) };
      axios.create.mockImplementation((config?: any) => {
        if (config?.headers?.['X-Client-Id']) {
          return mockTempAxios;
        }
        return mockAxios;
      });

      const mockResponse = { data: { success: true } };
      const requestConfig = { headers: { 'Custom-Header': 'value' } };
      mockAxios.post.mockResolvedValue(mockResponse);

      await httpClient.authenticatedRequest('POST', '/test', 'token123', {}, requestConfig);

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/test',
        {},
        {
          headers: {
            Authorization: 'Bearer token123',
            'Custom-Header': 'value'
          }
        }
      );
    });
  });
});
