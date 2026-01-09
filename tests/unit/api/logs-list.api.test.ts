/**
 * Unit tests for LogsListApi
 */

import { LogsListApi } from '../../../src/api/logs-list.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  ListLogsQueryParams,
  PaginatedLogsResponse,
  GeneralLogEntry,
  AuditLogEntry,
  JobLogEntry,
} from '../../../src/api/types/logs.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('LogsListApi', () => {
  let logsListApi: LogsListApi;
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
    logsListApi = new LogsListApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('listGeneralLogs', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const params: ListLogsQueryParams = {
        page: 1,
        pageSize: 10,
      };
      const mockResponse: PaginatedLogsResponse<GeneralLogEntry> = {
        data: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            level: 'info',
            environment: 'production',
            application: 'my-app',
            message: 'Test log',
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

      const result = await logsListApi.listGeneralLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request without params', async () => {
      const mockResponse: PaginatedLogsResponse<GeneralLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 20,
          type: 'general',
        },
        links: {},
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsListApi.listGeneralLogs();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: ListLogsQueryParams = {
        page: 2,
        pageSize: 20,
        level: 'error',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: PaginatedLogsResponse<GeneralLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 2,
          pageSize: 20,
          type: 'general',
        },
        links: {},
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsListApi.listGeneralLogs(params, authStrategy);

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

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const params: ListLogsQueryParams = {
        environment: 'production',
      };
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: PaginatedLogsResponse<GeneralLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 20,
          type: 'general',
        },
        links: {},
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsListApi.listGeneralLogs(params, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general',
        authStrategy,
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('List general logs failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsListApi.listGeneralLogs()).rejects.toThrow('List general logs failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsListApi]'),
        expect.stringContaining('List general logs'),
      );
    });
  });

  describe('getGeneralLog', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const id = 'log-id-123';
      const mockResponse: GeneralLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        environment: 'production',
        application: 'my-app',
        message: 'Test log',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsListApi.getGeneralLog(id);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general/log-id-123',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with environment parameter', async () => {
      const id = 'log-id-456';
      const environment = 'production';
      const mockResponse: GeneralLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        level: 'error',
        environment: 'production',
        application: 'my-app',
        message: 'Error log',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsListApi.getGeneralLog(id, environment);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general/log-id-456',
        undefined,
        { params: { environment } },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const id = 'log-id-789';
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: GeneralLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        environment: 'production',
        application: 'my-app',
        message: 'Test log',
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsListApi.getGeneralLog(id, undefined, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general/log-id-789',
        authStrategy.bearerToken,
        undefined,
        { params: undefined },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const id = 'log-id-101112';
      const environment = 'staging';
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: GeneralLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        environment: 'staging',
        application: 'my-app',
        message: 'Test log',
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsListApi.getGeneralLog(id, environment, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/general/log-id-101112',
        authStrategy,
        undefined,
        { params: { environment } },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const id = 'invalid-id';
      const error = new Error('Get general log failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsListApi.getGeneralLog(id)).rejects.toThrow('Get general log failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsListApi]'),
        expect.stringContaining('Get general log'),
      );
    });
  });

  describe('listAuditLogs', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
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

      const result = await logsListApi.listAuditLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: ListLogsQueryParams = {
        entityType: 'user',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: PaginatedLogsResponse<AuditLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 20,
          type: 'audit',
        },
        links: {},
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsListApi.listAuditLogs(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit',
        authStrategy.bearerToken,
        undefined,
        { params },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: PaginatedLogsResponse<AuditLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 20,
          type: 'audit',
        },
        links: {},
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsListApi.listAuditLogs(undefined, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit',
        authStrategy,
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('List audit logs failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsListApi.listAuditLogs()).rejects.toThrow('List audit logs failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsListApi]'),
        expect.stringContaining('List audit logs'),
      );
    });
  });

  describe('getAuditLog', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
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

      const result = await logsListApi.getAuditLog(id);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit/audit-log-id-123',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with environment parameter', async () => {
      const id = 'audit-log-id-456';
      const environment = 'production';
      const mockResponse: AuditLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        environment: 'production',
        application: 'my-app',
        entityType: 'user',
        entityId: 'user-456',
        action: 'delete',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsListApi.getAuditLog(id, environment);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit/audit-log-id-456',
        undefined,
        { params: { environment } },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const id = 'audit-log-id-789';
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: AuditLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        environment: 'production',
        application: 'my-app',
        entityType: 'user',
        entityId: 'user-789',
        action: 'create',
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsListApi.getAuditLog(id, undefined, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit/audit-log-id-789',
        authStrategy.bearerToken,
        undefined,
        { params: undefined },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const id = 'audit-log-id-101112';
      const environment = 'staging';
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: AuditLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        environment: 'staging',
        application: 'my-app',
        entityType: 'user',
        entityId: 'user-101112',
        action: 'update',
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsListApi.getAuditLog(id, environment, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/audit/audit-log-id-101112',
        authStrategy,
        undefined,
        { params: { environment } },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const id = 'invalid-id';
      const error = new Error('Get audit log failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsListApi.getAuditLog(id)).rejects.toThrow('Get audit log failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsListApi]'),
        expect.stringContaining('Get audit log'),
      );
    });
  });

  describe('listJobLogs', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
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

      const result = await logsListApi.listJobLogs(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: ListLogsQueryParams = {
        correlationId: 'corr-123',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: PaginatedLogsResponse<JobLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 20,
          type: 'jobs',
        },
        links: {},
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsListApi.listJobLogs(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs',
        authStrategy.bearerToken,
        undefined,
        { params },
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: PaginatedLogsResponse<JobLogEntry> = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 20,
          type: 'jobs',
        },
        links: {},
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsListApi.listJobLogs(undefined, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs',
        authStrategy,
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('List job logs failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsListApi.listJobLogs()).rejects.toThrow('List job logs failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsListApi]'),
        expect.stringContaining('List job logs'),
      );
    });
  });

  describe('getJobLog', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const id = 'job-log-id-123';
      const mockResponse: JobLogEntry = {
        id: 'job-log-id-123',
        jobId: 'job-123',
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        message: 'Job completed',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsListApi.getJobLog(id);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs/job-log-id-123',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const id = 'job-log-id-456';
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: JobLogEntry = {
        id: 'job-log-id-456',
        jobId: 'job-456',
        timestamp: '2024-01-01T00:00:00Z',
        level: 'error',
        message: 'Job failed',
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsListApi.getJobLog(id, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs/job-log-id-456',
        authStrategy.bearerToken,
        undefined,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const id = 'job-log-id-789';
      const authStrategy: AuthStrategy = {
        methods: ['bearer'],
      };
      const mockResponse: JobLogEntry = {
        id: 'job-log-id-789',
        jobId: 'job-789',
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        message: 'Job started',
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsListApi.getJobLog(id, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/jobs/job-log-id-789',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const id = 'invalid-id';
      const error = new Error('Get job log failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsListApi.getJobLog(id)).rejects.toThrow('Get job log failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsListApi]'),
        expect.stringContaining('Get job log'),
      );
    });
  });
});

