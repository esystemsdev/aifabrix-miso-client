/**
 * Unit tests for HttpClient filter builder and pagination helpers
 */

import { HttpClient } from '../../src/utils/http-client';
import { InternalHttpClient } from '../../src/utils/internal-http-client';
import { LoggerService } from '../../src/services/logger.service';
import { MisoClientConfig } from '../../src/types/config.types';
import { FilterBuilder } from '../../src/utils/filter.utils';

// Mock dependencies
jest.mock('../../src/utils/internal-http-client');
jest.mock('../../src/services/logger.service');
jest.mock('jsonwebtoken');

describe('HttpClient filter and pagination helpers', () => {
  let httpClient: HttpClient;
  let mockInternalClient: jest.Mocked<InternalHttpClient>;
  let mockLogger: jest.Mocked<LoggerService>;
  const config: MisoClientConfig = {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'test-client',
    clientSecret: 'test-secret'
  };

  beforeEach(() => {
    // Create mock axios instance
    const mockAxiosInstance = {
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      }
    };

    // Create mock InternalHttpClient
    mockInternalClient = {
      get: jest.fn(),
      getAxiosInstance: jest.fn().mockReturnValue(mockAxiosInstance)
    } as any;

    // Create mock LoggerService
    mockLogger = {
      audit: jest.fn(),
      debug: jest.fn()
    } as any;

    // Mock InternalHttpClient constructor
    (InternalHttpClient as jest.Mock).mockImplementation(() => mockInternalClient);

    // Mock LoggerService constructor
    (LoggerService as unknown as jest.Mock).mockImplementation(() => mockLogger);

    httpClient = new HttpClient(config, mockLogger);
  });

  describe('getWithFilters', () => {
    it('should call get with query string from FilterBuilder', async () => {
      const filterBuilder = new FilterBuilder()
        .add('status', 'eq', 'active')
        .add('region', 'in', ['eu', 'us']);

      const mockResponse = { data: [{ id: 1 }] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      const result = await httpClient.getWithFilters('/api/applications', filterBuilder);

      // URLSearchParams URL-encodes values
      expect(mockInternalClient.get).toHaveBeenCalledWith(
        '/api/applications?filter=status%3Aeq%3Aactive&filter=region%3Ain%3Aeu%2Cus',
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call get with empty FilterBuilder (no filters)', async () => {
      const filterBuilder = new FilterBuilder();

      const mockResponse = { data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      const result = await httpClient.getWithFilters('/api/applications', filterBuilder);

      expect(mockInternalClient.get).toHaveBeenCalledWith('/api/applications', undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should pass config parameter to get', async () => {
      const filterBuilder = new FilterBuilder().add('status', 'eq', 'active');
      const requestConfig = { timeout: 5000 };

      const mockResponse = { data: [{ id: 1 }] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getWithFilters('/api/applications', filterBuilder, requestConfig);

      // URLSearchParams URL-encodes values
      expect(mockInternalClient.get).toHaveBeenCalledWith(
        '/api/applications?filter=status%3Aeq%3Aactive',
        requestConfig
      );
    });

    it('should handle FilterBuilder with multiple filters', async () => {
      const filterBuilder = new FilterBuilder()
        .add('status', 'eq', 'active')
        .add('age', 'gte', 18)
        .add('region', 'in', ['eu', 'us', 'uk']);

      const mockResponse = { data: [{ id: 1 }] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getWithFilters('/api/users', filterBuilder);

      const calledUrl = (mockInternalClient.get as jest.Mock).mock.calls[0][0];
      // URLSearchParams URL-encodes values, so we check for encoded version
      expect(calledUrl).toContain('filter=status%3Aeq%3Aactive');
      expect(calledUrl).toContain('filter=age%3Agte%3A18');
      expect(calledUrl).toContain('filter=region%3Ain%3Aeu%2Cus%2Cuk');
    });

    it('should handle errors from InternalHttpClient', async () => {
      const filterBuilder = new FilterBuilder().add('status', 'eq', 'active');
      const error = new Error('Network error');
      mockInternalClient.get.mockRejectedValue(error);

      await expect(
        httpClient.getWithFilters('/api/applications', filterBuilder)
      ).rejects.toThrow('Network error');
    });
  });

  describe('getPaginated', () => {
    it('should call get with pagination query parameters', async () => {
      const pagination = { page: 1, page_size: 25 };
      const mockResponse = {
        meta: { total_items: 100, current_page: 1, page_size: 25, type: 'item' },
        data: [{ id: 1 }]
      };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      const result = await httpClient.getPaginated('/api/applications', pagination);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        '/api/applications?page=1&page_size=25',
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle different page numbers', async () => {
      const pagination = { page: 3, page_size: 50 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated('/api/applications', pagination);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        '/api/applications?page=3&page_size=50',
        undefined
      );
    });

    it('should pass config parameter to get', async () => {
      const pagination = { page: 2, page_size: 10 };
      const requestConfig = { timeout: 5000 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated('/api/applications', pagination, requestConfig);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        '/api/applications?page=2&page_size=10',
        requestConfig
      );
    });

    it('should handle large page sizes', async () => {
      const pagination = { page: 1, page_size: 1000 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated('/api/applications', pagination);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        '/api/applications?page=1&page_size=1000',
        undefined
      );
    });

    it('should handle errors from InternalHttpClient', async () => {
      const pagination = { page: 1, page_size: 25 };
      const error = new Error('Network error');
      mockInternalClient.get.mockRejectedValue(error);

      await expect(
        httpClient.getPaginated('/api/applications', pagination)
      ).rejects.toThrow('Network error');
    });

    it('should handle page 0 (edge case)', async () => {
      const pagination = { page: 0, page_size: 25 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated('/api/applications', pagination);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        '/api/applications?page=0&page_size=25',
        undefined
      );
    });
  });
});
