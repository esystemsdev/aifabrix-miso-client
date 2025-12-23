/**
 * Logs API client
 * Provides typed interfaces for logs-related controller API calls
 * Composed from specialized sub-modules to keep file size manageable
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import { LogsCreateApi } from './logs-create.api';
import { LogsListApi } from './logs-list.api';
import { LogsStatsApi } from './logs-stats.api';
import { LogsExportApi } from './logs-export.api';
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
} from './types/logs.types';

/**
 * Logs API class
 * Centralizes all logs-related endpoint URLs and provides typed methods
 * Delegates to specialized sub-modules to keep file size manageable
 */
export class LogsApi {
  // Sub-modules for different log concerns
  private readonly create: LogsCreateApi;
  private readonly list: LogsListApi;
  private readonly stats: LogsStatsApi;
  private readonly export: LogsExportApi;

  constructor(private httpClient: HttpClient) {
    this.create = new LogsCreateApi(httpClient);
    this.list = new LogsListApi(httpClient);
    this.stats = new LogsStatsApi(httpClient);
    this.export = new LogsExportApi(httpClient);
  }

  // Create methods - delegate to LogsCreateApi
  async createLog(
    logEntry: CreateLogRequest,
    authStrategy?: AuthStrategy,
  ): Promise<CreateLogResponse> {
    return this.create.createLog(logEntry, authStrategy);
  }

  async createBatchLogs(
    logs: BatchLogRequest,
    authStrategy?: AuthStrategy,
  ): Promise<BatchLogResponse> {
    return this.create.createBatchLogs(logs, authStrategy);
  }

  // List methods - delegate to LogsListApi
  async listGeneralLogs(
    params?: ListLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<PaginatedLogsResponse<GeneralLogEntry>> {
    return this.list.listGeneralLogs(params, authStrategy);
  }

  async getGeneralLog(
    id: string,
    environment?: string,
    authStrategy?: AuthStrategy,
  ): Promise<GeneralLogEntry> {
    return this.list.getGeneralLog(id, environment, authStrategy);
  }

  async listAuditLogs(
    params?: ListLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<PaginatedLogsResponse<AuditLogEntry>> {
    return this.list.listAuditLogs(params, authStrategy);
  }

  async getAuditLog(
    id: string,
    environment?: string,
    authStrategy?: AuthStrategy,
  ): Promise<AuditLogEntry> {
    return this.list.getAuditLog(id, environment, authStrategy);
  }

  async listJobLogs(
    params?: ListLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<PaginatedLogsResponse<JobLogEntry>> {
    return this.list.listJobLogs(params, authStrategy);
  }

  async getJobLog(
    id: string,
    authStrategy?: AuthStrategy,
  ): Promise<JobLogEntry> {
    return this.list.getJobLog(id, authStrategy);
  }

  // Stats methods - delegate to LogsStatsApi
  async getLogStatsSummary(
    params?: GetLogStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<LogStatsSummaryResponse> {
    return this.stats.getLogStatsSummary(params, authStrategy);
  }

  async getErrorStats(
    params?: ErrorStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<ErrorStatsResponse> {
    return this.stats.getErrorStats(params, authStrategy);
  }

  async getUserActivityStats(
    params?: UserActivityStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<UserActivityStatsResponse> {
    return this.stats.getUserActivityStats(params, authStrategy);
  }

  async getApplicationStats(
    params?: GetLogStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<ApplicationStatsResponse> {
    return this.stats.getApplicationStats(params, authStrategy);
  }

  // Export methods - delegate to LogsExportApi
  async exportLogs(
    params: ExportLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<string | ExportLogsResponse> {
    return this.export.exportLogs(params, authStrategy);
  }
}
