/**
 * Unit tests for HttpClient
 */

import { HttpClient } from '../../src/utils/http-client';
import { MisoClientConfig } from '../../src/types/config.types';

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
      environment: 'dev',
      applicationKey: 'test-app',
      applicationId: 'test-app-id-123'
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
          'Content-Type': 'application/json',
          'X-Environment': 'dev',
          'X-Application': 'test-app'
        }
      });
    });

    it('should set up request interceptor', () => {
      expect(mockAxios.interceptors.request.use).toHaveBeenCalled();
    });

    it('should set up response interceptor', () => {
      expect(mockAxios.interceptors.response.use).toHaveBeenCalled();
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
  });

  describe('authenticatedRequest', () => {
    it('should make GET request with Authorization header', async () => {
      const mockResponse = { data: { user: 'test' } };
      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await httpClient.authenticatedRequest('GET', '/user', 'token123');

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
