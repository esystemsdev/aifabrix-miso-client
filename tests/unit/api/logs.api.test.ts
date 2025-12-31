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
  AuditLogEntry,
  JobLogEntry,
  GetLogStatsQueryParams,
  LogStatsSummaryResponse,
  ErrorStatsQueryParams,
  ErrorStatsResponse,
  UserActivityStatsQueryParams,
  UserActivityStatsResponse,
  ApplicationStatsResponse,
  ExportLogsQueryParams,
  ExportLogsResponse,
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

  describe('getGeneralLog', () => {
    it('should delegate to list.getGeneralLog', async () => {
      const id = 'log-id-123';
      const environment = 'production';
      const mockResponse: GeneralLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        environment: 'production',
        application: 'my-app',
        message: 'Test log',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.getGeneralLog(id, environment);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general/log-id-123',
        undefined,
        { params: { environment } },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listAuditLogs', () => {
    it('should delegate to list.listAuditLogs', async () => {
      const params: ListLogsQueryParams = {
        page: 1,
        pageSize: 10,
      };
      const mockResponse: PaginatedLogsResponse<AuditLogEntry> = {
        data: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            environment: 'production',
            application: 'my-app',
            entityType: 'user',
            entityId: 'user-123',
            action: 'update',
          },
        ],
        meta: {
          totalItems: 1,
          currentPage: 1,
          pageSize: 10,
          type: 'audit',
        },
        links: {},
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.listAuditLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getAuditLog', () => {
    it('should delegate to list.getAuditLog', async () => {
      const id = 'audit-log-id-123';
      const mockResponse: AuditLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        environment: 'production',
        application: 'my-app',
        entityType: 'user',
        entityId: 'user-123',
        action: 'update',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.getAuditLog(id);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit/audit-log-id-123',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listJobLogs', () => {
    it('should delegate to list.listJobLogs', async () => {
      const params: ListLogsQueryParams = {
        page: 1,
        pageSize: 10,
      };
      const mockResponse: PaginatedLogsResponse<JobLogEntry> = {
        data: [
          {
            id: 'job-log-123',
            jobId: 'job-123',
            timestamp: '2024-01-01T00:00:00Z',
            level: 'info',
            message: 'Job started',
          },
        ],
        meta: {
          totalItems: 1,
          currentPage: 1,
          pageSize: 10,
          type: 'jobs',
        },
        links: {},
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.listJobLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getJobLog', () => {
    it('should delegate to list.getJobLog', async () => {
      const id = 'job-log-id-123';
      const mockResponse: JobLogEntry = {
        id: 'job-log-id-123',
        jobId: 'job-123',
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        message: 'Job completed',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.getJobLog(id);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs/job-log-id-123',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getLogStatsSummary', () => {
    it('should delegate to stats.getLogStatsSummary', async () => {
      const params: GetLogStatsQueryParams = {
        environment: 'production',
      };
      const mockResponse: LogStatsSummaryResponse = {
        success: true,
        data: {
          totalLogs: 1000,
          byLevel: {
            info: 600,
            error: 200,
          },
          byApplication: {
            'my-app': 800,
          },
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.getLogStatsSummary(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/summary',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getErrorStats', () => {
    it('should delegate to stats.getErrorStats', async () => {
      const params: ErrorStatsQueryParams = {
        environment: 'production',
        limit: 10,
      };
      const mockResponse: ErrorStatsResponse = {
        success: true,
        data: {
          totalErrors: 50,
          topErrors: [
            { message: 'Database connection failed', count: 20 },
          ],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.getErrorStats(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/errors',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUserActivityStats', () => {
    it('should delegate to stats.getUserActivityStats', async () => {
      const params: UserActivityStatsQueryParams = {
        environment: 'production',
      };
      const mockResponse: UserActivityStatsResponse = {
        success: true,
        data: {
          totalUsers: 100,
          topUsers: [
            { userId: 'user-123', actionCount: 50 },
          ],
          byAction: {
            login: 80,
            logout: 60,
          },
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.getUserActivityStats(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/users',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getApplicationStats', () => {
    it('should delegate to stats.getApplicationStats', async () => {
      const params: GetLogStatsQueryParams = {
        environment: 'production',
      };
      const mockResponse: ApplicationStatsResponse = {
        success: true,
        data: {
          totalApplications: 5,
          applications: [
            { application: 'my-app', logCount: 800 },
          ],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.getApplicationStats(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/applications',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('exportLogs', () => {
    it('should delegate to export.exportLogs and return CSV string', async () => {
      const params: ExportLogsQueryParams = {
        type: 'general',
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      const mockResponse = 'timestamp,level,message\n2024-01-01T00:00:00Z,info,Test log';

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsApi.exportLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/export',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
      expect(typeof result).toBe('string');
    });

    it('should delegate to export.exportLogs and return JSON ExportLogsResponse', async () => {
      const params: ExportLogsQueryParams = {
        type: 'general',
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

      const result = await logsApi.exportLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/export',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
      expect(typeof result).toBe('object');
    });
  });
});

