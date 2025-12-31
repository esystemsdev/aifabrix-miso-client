/**
 * Unit tests for LogsExportApi
 */

import { LogsExportApi } from '../../../src/api/logs-export.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  ExportLogsQueryParams,
  ExportLogsResponse,
} from '../../../src/api/types/logs.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('LogsExportApi', () => {
  let logsExportApi: LogsExportApi;
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
    logsExportApi = new LogsExportApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('exportLogs', () => {
    it('should call HttpClient.request when no authStrategy and return CSV string', async () => {
      const params: ExportLogsQueryParams = {
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const mockResponse = 'timestamp,level,message\n2024-01-01T00:00:00Z,info,Test log';

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsExportApi.exportLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/export',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
      expect(typeof result).toBe('string');
    });

    it('should call HttpClient.request when no authStrategy and return JSON ExportLogsResponse', async () => {
      const params: ExportLogsQueryParams = {
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const mockResponse: ExportLogsResponse = {
        success: true,
        data: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            level: 'info',
            message: 'Test log',
          },
        ],
        meta: {
          type: 'general',
          environment: 'production',
          exportedAt: new Date().toISOString(),
          count: 1,
        },
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsExportApi.exportLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/export',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
      expect(typeof result).toBe('object');
    });

    it('should call HttpClient.request with minimal params', async () => {
      const params: ExportLogsQueryParams = {
        format: 'csv',
      };
      const mockResponse = 'timestamp,level,message\n';

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsExportApi.exportLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/export',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: ExportLogsQueryParams = {
        format: 'json',
        environment: 'production',
        application: 'my-app',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: ExportLogsResponse = {
        success: true,
        data: [],
        meta: {
          type: 'general',
          environment: 'production',
          exportedAt: new Date().toISOString(),
          count: 0,
        },
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsExportApi.exportLogs(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/export',
        authStrategy.bearerToken,
        undefined,
        { params },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const params: ExportLogsQueryParams = {
        format: 'csv',
        startDate: '2024-01-01',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse = 'timestamp,level,message\n';

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsExportApi.exportLogs(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/export',
        authStrategy,
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const params: ExportLogsQueryParams = {
        format: 'csv',
      };
      const error = new Error('Export logs failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsExportApi.exportLogs(params)).rejects.toThrow('Export logs failed');
      expect(console.error).toHaveBeenCalledWith('Export logs API call failed:', error);
    });
  });
});

