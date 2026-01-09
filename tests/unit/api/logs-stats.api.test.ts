/**
 * Unit tests for LogsStatsApi
 */

import { LogsStatsApi } from '../../../src/api/logs-stats.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  GetLogStatsQueryParams,
  LogStatsSummaryResponse,
  ErrorStatsQueryParams,
  ErrorStatsResponse,
  UserActivityStatsQueryParams,
  UserActivityStatsResponse,
  ApplicationStatsResponse,
} from '../../../src/api/types/logs.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('LogsStatsApi', () => {
  let logsStatsApi: LogsStatsApi;
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
    logsStatsApi = new LogsStatsApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('getLogStatsSummary', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: LogStatsSummaryResponse = {
        success: true,
        data: {
          totalLogs: 1000,
          byLevel: {
            info: 600,
            error: 200,
            warn: 150,
            debug: 50,
          },
          byApplication: {
            'my-app': 800,
            'other-app': 200,
          },
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getLogStatsSummary();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/summary',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with params', async () => {
      const params: GetLogStatsQueryParams = {
        environment: 'production',
        application: 'my-app',
      };
      const mockResponse: LogStatsSummaryResponse = {
        success: true,
        data: {
          totalLogs: 500,
          byLevel: {
            info: 300,
            error: 100,
            warn: 75,
            debug: 25,
          },
          byApplication: {
            'my-app': 500,
          },
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getLogStatsSummary(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/summary',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: GetLogStatsQueryParams = {
        environment: 'staging',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: LogStatsSummaryResponse = {
        success: true,
        data: {
          totalLogs: 200,
          byLevel: {
            info: 150,
            error: 30,
            warn: 15,
            debug: 5,
          },
          byApplication: {},
          environment: 'staging',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getLogStatsSummary(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/summary',
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
      const mockResponse: LogStatsSummaryResponse = {
        success: true,
        data: {
          totalLogs: 0,
          byLevel: {},
          byApplication: {},
          environment: 'development',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getLogStatsSummary(undefined, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/summary',
        authStrategy,
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Get log stats summary failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsStatsApi.getLogStatsSummary()).rejects.toThrow('Get log stats summary failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsStatsApi]'),
        expect.stringContaining('Get log stats summary'),
      );
    });
  });

  describe('getErrorStats', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: ErrorStatsResponse = {
        success: true,
        data: {
          totalErrors: 50,
          topErrors: [
            { message: 'Database connection failed', count: 20 },
            { message: 'Invalid input', count: 15 },
            { message: 'Timeout error', count: 15 },
          ],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getErrorStats();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/errors',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with params', async () => {
      const params: ErrorStatsQueryParams = {
        environment: 'production',
        limit: 10,
      };
      const mockResponse: ErrorStatsResponse = {
        success: true,
        data: {
          totalErrors: 25,
          topErrors: [
            { message: 'Database connection failed', count: 10 },
          ],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getErrorStats(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/errors',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: ErrorStatsQueryParams = {
        application: 'my-app',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: ErrorStatsResponse = {
        success: true,
        data: {
          totalErrors: 10,
          topErrors: [],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getErrorStats(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/errors',
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
      const mockResponse: ErrorStatsResponse = {
        success: true,
        data: {
          totalErrors: 0,
          topErrors: [],
          environment: 'development',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getErrorStats(undefined, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/errors',
        authStrategy,
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Get error stats failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsStatsApi.getErrorStats()).rejects.toThrow('Get error stats failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsStatsApi]'),
        expect.stringContaining('Get error stats'),
      );
    });
  });

  describe('getUserActivityStats', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: UserActivityStatsResponse = {
        success: true,
        data: {
          totalUsers: 100,
          topUsers: [
            { userId: 'user-123', actionCount: 50 },
            { userId: 'user-456', actionCount: 30 },
          ],
          byAction: {
            login: 80,
            logout: 60,
            update: 40,
          },
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getUserActivityStats();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/users',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with params', async () => {
      const params: UserActivityStatsQueryParams = {
        environment: 'production',
        limit: 5,
      };
      const mockResponse: UserActivityStatsResponse = {
        success: true,
        data: {
          totalUsers: 50,
          topUsers: [
            { userId: 'user-123', actionCount: 25 },
          ],
          byAction: {
            login: 40,
            logout: 30,
          },
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getUserActivityStats(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/users',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: UserActivityStatsQueryParams = {
        application: 'my-app',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: UserActivityStatsResponse = {
        success: true,
        data: {
          totalUsers: 20,
          topUsers: [],
          byAction: {},
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getUserActivityStats(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/users',
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
      const mockResponse: UserActivityStatsResponse = {
        success: true,
        data: {
          totalUsers: 0,
          topUsers: [],
          byAction: {},
          environment: 'development',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getUserActivityStats(undefined, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/users',
        authStrategy,
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Get user activity stats failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsStatsApi.getUserActivityStats()).rejects.toThrow('Get user activity stats failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsStatsApi]'),
        expect.stringContaining('Get user activity stats'),
      );
    });
  });

  describe('getApplicationStats', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: ApplicationStatsResponse = {
        success: true,
        data: {
          totalApplications: 5,
          applications: [
            { application: 'my-app', logCount: 800 },
            { application: 'other-app', logCount: 200 },
          ],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getApplicationStats();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/applications',
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.request with params', async () => {
      const params: GetLogStatsQueryParams = {
        environment: 'production',
      };
      const mockResponse: ApplicationStatsResponse = {
        success: true,
        data: {
          totalApplications: 3,
          applications: [
            { application: 'my-app', logCount: 500 },
          ],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getApplicationStats(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/applications',
        undefined,
        { params },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const params: GetLogStatsQueryParams = {
        application: 'my-app',
      };
      const authStrategy: AuthStrategy = {
        bearerToken: 'test-token',
      };
      const mockResponse: ApplicationStatsResponse = {
        success: true,
        data: {
          totalApplications: 1,
          applications: [
            { application: 'my-app', logCount: 100 },
          ],
          environment: 'production',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getApplicationStats(params, authStrategy);

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/applications',
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
      const mockResponse: ApplicationStatsResponse = {
        success: true,
        data: {
          totalApplications: 0,
          applications: [],
          environment: 'development',
        },
        timestamp: new Date().toISOString(),
      };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await logsStatsApi.getApplicationStats(undefined, authStrategy);

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/logs/stats/applications',
        authStrategy,
        undefined,
        { params: undefined },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Get application stats failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(logsStatsApi.getApplicationStats()).rejects.toThrow('Get application stats failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[LogsStatsApi]'),
        expect.stringContaining('Get application stats'),
      );
    });
  });
});

