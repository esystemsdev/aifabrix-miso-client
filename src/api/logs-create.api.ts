/**
 * Logs Create API client
 * Handles log creation (single and batch)
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  CreateLogRequest,
  CreateLogResponse,
  BatchLogRequest,
  BatchLogResponse,
} from './types/logs.types';

/**
 * Logs Create API class
 * Handles log creation endpoints
 */
export class LogsCreateApi {
  // Centralize endpoint URLs as constants
  private static readonly LOGS_ENDPOINT = '/api/v1/logs';
  private static readonly LOGS_BATCH_ENDPOINT = '/api/v1/logs/batch';

  constructor(private httpClient: HttpClient) {}

  /**
   * Create log entry (unified endpoint for error/general/audit logs)
   * @param logEntry - Log entry request
   * @param authStrategy - Optional authentication strategy override
   * @returns Create log response with success message
   */
  async createLog(
    logEntry: CreateLogRequest,
    authStrategy?: AuthStrategy,
  ): Promise<CreateLogResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<CreateLogResponse>(
          'POST',
          LogsCreateApi.LOGS_ENDPOINT,
          authStrategy.bearerToken,
          logEntry,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<CreateLogResponse>(
          'POST',
          LogsCreateApi.LOGS_ENDPOINT,
          authStrategy,
          logEntry,
        );
      }
      return await this.httpClient.request<CreateLogResponse>(
        'POST',
        LogsCreateApi.LOGS_ENDPOINT,
        logEntry,
      );
    } catch (error) {
      console.error('Create log API call failed:', error);
      throw error;
    }
  }

  /**
   * Create multiple log entries in batch (1-100 logs)
   * @param logs - Batch log request with logs array
   * @param authStrategy - Optional authentication strategy override
   * @returns Batch log response with processed and failed counts
   */
  async createBatchLogs(
    logs: BatchLogRequest,
    authStrategy?: AuthStrategy,
  ): Promise<BatchLogResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<BatchLogResponse>(
          'POST',
          LogsCreateApi.LOGS_BATCH_ENDPOINT,
          authStrategy.bearerToken,
          logs,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<BatchLogResponse>(
          'POST',
          LogsCreateApi.LOGS_BATCH_ENDPOINT,
          authStrategy,
          logs,
        );
      }
      return await this.httpClient.request<BatchLogResponse>(
        'POST',
        LogsCreateApi.LOGS_BATCH_ENDPOINT,
        logs,
      );
    } catch (error) {
      console.error('Create batch logs API call failed:', error);
      throw error;
    }
  }
}

