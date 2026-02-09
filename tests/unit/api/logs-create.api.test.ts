/**
 * Unit tests for LogsCreateApi
 */

import { LogsCreateApi } from '../../../src/api/logs-create.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  CreateLogRequest,
  CreateLogResponse,
  BatchLogRequest,
  BatchLogResponse,
  LogEntry,
} from '../../../src/api/types/logs.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('LogsCreateApi', () => {
  let logsCreateApi: LogsCreateApi;
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
    logsCreateApi = new LogsCreateApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('createLog', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const logEntry: CreateLogRequest = {
        type: 'general',
        data: {
          level: 'info',
          message: 'Test log message',
        },
      };
      const mockResponse: CreateLogResponse = {
        success: true,
        data: null,
        message: 'Log created successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createLog(logEntry);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs',
        logEntry,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with error log type', async () => {
      const logEntry: CreateLogRequest = {
        type: 'error',
        data: {
          level: 'error',
          message: 'Error log message',
        },
      };
      const mockResponse: CreateLogResponse = {
        success: true,
        data: null,
        message: 'Log created successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createLog(logEntry);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs',
        logEntry,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with audit log type', async () => {
      const logEntry: CreateLogRequest = {
        type: 'audit',
        data: {
          message: 'Audit log message',
          entityType: 'user',
          entityId: 'user-123',
          action: 'update',
          oldValues: { name: 'Old Name' },
          newValues: { name: 'New Name' },
        },
      };
      const mockResponse: CreateLogResponse = {
        success: true,
        data: null,
        message: 'Log created successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createLog(logEntry);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs',
        logEntry,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const logEntry: CreateLogRequest = {
        type: 'general',
        data: {
          level: 'info',
          message: 'Test log message',
          correlationId: 'corr-123',
        },
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
        bearerToken: 'test-token',
      };
      const mockResponse: CreateLogResponse = {
        success: true,
        data: null,
        message: 'Log created successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createLog(logEntry, authStrategy);

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

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const logEntry: CreateLogRequest = {
        type: 'general',
        data: {
          level: 'debug',
          message: 'Debug log message',
        },
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: CreateLogResponse = {
        success: true,
        data: null,
        message: 'Log created successfully',
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createLog(logEntry, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs',
        authStrategy,
        logEntry,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const logEntry: CreateLogRequest = {
        type: 'general',
        data: {
          message: 'Test log message',
        },
      };
      const error = new Error('Create log failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsCreateApi.createLog(logEntry)).rejects.toThrow('Create log failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsCreateApi]'),
        expect.stringContaining('Create log'),
      );
    });
  });

  describe('createBatchLogs', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const logs: BatchLogRequest = {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Log entry 1',
          },
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Log entry 2',
          },
        ] as LogEntry[],
      };
      const mockResponse: BatchLogResponse = {
        success: true,
        message: 'Batch logs created successfully',
        processed: 2,
        failed: 0,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createBatchLogs(logs);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs/batch',
        logs,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with failed logs', async () => {
      const logs: BatchLogRequest = {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Log entry 1',
          },
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Invalid log entry',
          },
        ] as LogEntry[],
      };
      const mockResponse: BatchLogResponse = {
        success: true,
        message: 'Batch logs processed',
        processed: 1,
        failed: 1,
        errors: [
          {
            index: 1,
            error: 'Invalid log format',
            log: logs.logs[1] as unknown as Record<string, unknown>,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createBatchLogs(logs);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs/batch',
        logs,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const logs: BatchLogRequest = {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Log entry 1',
            correlationId: 'corr-123',
          },
        ] as LogEntry[],
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
        bearerToken: 'test-token',
      };
      const mockResponse: BatchLogResponse = {
        success: true,
        message: 'Batch logs created successfully',
        processed: 1,
        failed: 0,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createBatchLogs(logs, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs/batch',
        authStrategy.bearerToken,
        logs,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const logs: BatchLogRequest = {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'debug',
            message: 'Debug log entry',
          },
        ] as LogEntry[],
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: BatchLogResponse = {
        success: true,
        message: 'Batch logs created successfully',
        processed: 1,
        failed: 0,
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsCreateApi.createBatchLogs(logs, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/logs/batch',
        authStrategy,
        logs,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const logs: BatchLogRequest = {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Log entry',
          },
        ] as LogEntry[],
      };
      const error = new Error('Create batch logs failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsCreateApi.createBatchLogs(logs)).rejects.toThrow('Create batch logs failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsCreateApi]'),
        expect.stringContaining('Create batch logs'),
      );
    });
  });
});

