/**
 * Logs List API client
 * Handles listing and retrieving logs (general, audit, jobs)
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {

  ListLogsQueryParams,
  PaginatedLogsResponse,
  GeneralLogEntry,
  AuditLogEntry,
  JobLogEntry,
} from './types/logs.types';
import { extractErrorInfo } from '../utils/error-extractor';
import { logErrorWithContext } from '../utils/console-logger';

/**
 * Logs List API class
 * Handles log listing and retrieval endpoints
 */
export class LogsListApi {
  // Centralize endpoint URLs as constants
  private static readonly LOGS_GENERAL_ENDPOINT = '/api/v1/logs/general';
  private static readonly LOGS_AUDIT_ENDPOINT = '/api/v1/logs/audit';
  private static readonly LOGS_JOBS_ENDPOINT = '/api/v1/logs/jobs';

  constructor(private httpClient: HttpClient) {}

  /**
   * List general logs (paginated, with filtering)
   * @param params - Optional query parameters for pagination and filtering
   * @param authStrategy - Optional authentication strategy override
   * @returns Paginated general logs response
   */
  async listGeneralLogs(
    params?: ListLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<PaginatedLogsResponse<GeneralLogEntry>> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<PaginatedLogsResponse<GeneralLogEntry>>(
          'GET',
          LogsListApi.LOGS_GENERAL_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<PaginatedLogsResponse<GeneralLogEntry>>(
          'GET',
          LogsListApi.LOGS_GENERAL_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<PaginatedLogsResponse<GeneralLogEntry>>(
        'GET',
        LogsListApi.LOGS_GENERAL_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: LogsListApi.LOGS_GENERAL_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsListApi]');
      throw error;
      throw error;
    }
  }

  /**
   * Get general log by ID (501 Not Implemented)
   * @param id - Log ID
   * @param environment - Optional environment parameter
   * @param authStrategy - Optional authentication strategy override
   * @returns General log entry
   */
  async getGeneralLog(
    id: string,
    environment?: string,
    authStrategy?: AuthStrategy,
  ): Promise<GeneralLogEntry> {
    try {
      const url = `${LogsListApi.LOGS_GENERAL_ENDPOINT}/${id}`;
      const params = environment ? { environment } : undefined;
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<GeneralLogEntry>(
          'GET',
          url,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<GeneralLogEntry>(
          'GET',
          url,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<GeneralLogEntry>(
        'GET',
        url,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: LogsListApi.LOGS_GENERAL_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsListApi]');
      throw error;
      throw error;
    }
  }

  /**
   * List audit logs (paginated, with filtering)
   * @param params - Optional query parameters for pagination and filtering
   * @param authStrategy - Optional authentication strategy override
   * @returns Paginated audit logs response
   */
  async listAuditLogs(
    params?: ListLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<PaginatedLogsResponse<AuditLogEntry>> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<PaginatedLogsResponse<AuditLogEntry>>(
          'GET',
          LogsListApi.LOGS_AUDIT_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<PaginatedLogsResponse<AuditLogEntry>>(
          'GET',
          LogsListApi.LOGS_AUDIT_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<PaginatedLogsResponse<AuditLogEntry>>(
        'GET',
        LogsListApi.LOGS_AUDIT_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: LogsListApi.LOGS_AUDIT_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsListApi]');
      throw error;
      throw error;
    }
  }

  /**
   * Get audit log by ID (501 Not Implemented)
   * @param id - Log ID
   * @param environment - Optional environment parameter
   * @param authStrategy - Optional authentication strategy override
   * @returns Audit log entry
   */
  async getAuditLog(
    id: string,
    environment?: string,
    authStrategy?: AuthStrategy,
  ): Promise<AuditLogEntry> {
    try {
      const url = `${LogsListApi.LOGS_AUDIT_ENDPOINT}/${id}`;
      const params = environment ? { environment } : undefined;
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<AuditLogEntry>(
          'GET',
          url,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<AuditLogEntry>(
          'GET',
          url,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<AuditLogEntry>(
        'GET',
        url,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: LogsListApi.LOGS_AUDIT_ENDPOINT,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsListApi]');
      throw error;
      throw error;
    }
  }

  /**
   * List job logs (paginated, with filtering)
   * @param params - Optional query parameters for pagination and filtering
   * @param authStrategy - Optional authentication strategy override
   * @returns Paginated job logs response
   */
  async listJobLogs(
    params?: ListLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<PaginatedLogsResponse<JobLogEntry>> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<PaginatedLogsResponse<JobLogEntry>>(
          'GET',
          LogsListApi.LOGS_JOBS_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<PaginatedLogsResponse<JobLogEntry>>(
          'GET',
          LogsListApi.LOGS_JOBS_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<PaginatedLogsResponse<JobLogEntry>>(
        'GET',
        LogsListApi.LOGS_JOBS_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: undefined,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsListApi]');
      throw error;
      throw error;
    }
  }

  /**
   * Get job log by ID
   * @param id - Log ID
   * @param authStrategy - Optional authentication strategy override
   * @returns Job log entry
   */
  async getJobLog(
    id: string,
    authStrategy?: AuthStrategy,
  ): Promise<JobLogEntry> {
    try {
      const url = `${LogsListApi.LOGS_JOBS_ENDPOINT}/${id}`;
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<JobLogEntry>(
          'GET',
          url,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<JobLogEntry>(
          'GET',
          url,
          authStrategy,
        );
      }
      return await this.httpClient.request<JobLogEntry>(
        'GET',
        url,
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: undefined,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsListApi]');
      throw error;
      throw error;
    }
  }
}

