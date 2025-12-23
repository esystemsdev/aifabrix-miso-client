/**
 * Unit tests for LogsApi
 */

import { LogsApi } from '../../../src/api/logs.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  CreateLogRequest,
  CreateLogResponse,
  BatchLogRequest,
  BatchLogResponse,
  ListLogsQueryParams,
  PaginatedLogsResponse,
  GeneralLogEntry,
} from '../../../src/api/types/logs.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('LogsApi', () => {
  let logsApi: LogsApi;
  let mockHttpClient: jest.Mocked<HttpClient>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
    mockHttpClient = {
      request: jest.fn(),
      authenticatedRequest: jest.fn(),
      requestWithAuthStrategy: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    logsApi = new LogsApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('createLog', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const logEntry: CreateLogRequest = {
        type: 'general',
        data: {
          level: 'info',
          message: 'Test log message',
        },
      };
      const mockResponse: CreateLogResponse = {
        success: true,
        message: 'Log created successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.createLog(logEntry);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs',
        logEntry,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle authStrategy with bearerToken', async () => {
      const logEntry: CreateLogRequest = {
        type: 'error',
        data: {
          level: 'error',
          message: 'Error log',
        },
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: CreateLogResponse = {
        success: true,
        message: 'Log created',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsApi.createLog(logEntry, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs',
        authStrategy.bearerToken,
        logEntry,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const logEntry: CreateLogRequest = {
        type: 'general',
        data: {
          level: 'info',
          message: 'Test',
        },
      };
      const error = new Error('Network error');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsApi.createLog(logEntry)).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalledWith('Create log API call failed:', error);
    });
  });

  describe('createBatchLogs', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const batchRequest: BatchLogRequest = {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Log 1',
          },
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Log 2',
          },
        ],
      };
      const mockResponse: BatchLogResponse = {
        success: true,
        message: 'Batch logs processed',
        processed: 2,
        failed: 0,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.createBatchLogs(batchRequest);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs/batch',
        batchRequest,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listGeneralLogs', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const params: ListLogsQueryParams = {
        page: 1,
        pageSize: 10,
        level: 'error',
      };
      const mockResponse: PaginatedLogsResponse<GeneralLogEntry> = {
        data: [
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            environment: 'dev',
            application: 'test-app',
            message: 'Error log',
          },
        ],
        meta: {
          totalItems: 1,
          currentPage: 1,
          pageSize: 10,
          type: 'general',
        },
        links: {},
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.listGeneralLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle authStrategy', async () => {
      const params: ListLogsQueryParams = {
        page: 1,
        pageSize: 10,
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: PaginatedLogsResponse<GeneralLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 10,
          type: 'general',
        },
        links: {},
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsApi.listGeneralLogs(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general',
        authStrategy.bearerToken,
        undefined,
        { params },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});

