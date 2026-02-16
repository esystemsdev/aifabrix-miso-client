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
import { extractErrorInfo } from '../utils/error-extractor';
import { logErrorWithContext } from '../utils/console-logger';
import { MisoClientError } from '../utils/errors';

/** Transform raw response to CreateLogResponse format */
function toCreateLogResponse(response: Record<string, unknown>): CreateLogResponse {
  return {
    success: true,
    data: null,
    message: typeof response.message === 'string' ? response.message : 'Log created successfully',
    timestamp: typeof response.timestamp === 'string' ? response.timestamp : new Date().toISOString(),
  };
}

/** Transform raw response to BatchLogResponse format */
function toBatchLogResponse(response: Record<string, unknown>): BatchLogResponse {
  const data = response.data && typeof response.data === 'object' ? (response.data as Record<string, unknown>) : undefined;
  const processed = typeof data?.processed === 'number' ? data.processed : typeof response.processed === 'number' ? response.processed : 0;
  const failed = typeof data?.failed === 'number' ? data.failed : typeof response.failed === 'number' ? response.failed : 0;
  const errors = Array.isArray(data?.errors) ? data.errors : Array.isArray(response.errors) ? response.errors : undefined;
  return {
    success: true,
    message: typeof response.message === 'string' ? response.message : 'Batch logs processed',
    processed,
    failed,
    errors,
    timestamp: typeof response.timestamp === 'string' ? response.timestamp : new Date().toISOString(),
  };
}

/** Log error unless it's a 401 auth error (expected, auto-refresh) */
function logCreateError(error: unknown, endpoint: string, context: string): void {
  const isAuthError = error instanceof MisoClientError && error.statusCode === 401;
  if (!isAuthError) {
    logErrorWithContext(extractErrorInfo(error, { endpoint, method: 'POST' }), context);
  }
}

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
      const response = await this.httpClient.request<Record<string, unknown>>(
        'POST',
        LogsCreateApi.LOGS_ENDPOINT,
        logEntry,
      );
      if (response.success !== undefined) return response as unknown as CreateLogResponse;
      return toCreateLogResponse(response);
    } catch (error) {
      logCreateError(error, LogsCreateApi.LOGS_ENDPOINT, '[LogsCreateApi]');
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
      const response = await this.httpClient.request<Record<string, unknown>>(
        'POST',
        LogsCreateApi.LOGS_BATCH_ENDPOINT,
        logs,
      );
      if (response.success !== undefined) return response as unknown as BatchLogResponse;
      return toBatchLogResponse(response);
    } catch (error) {
      logCreateError(error, LogsCreateApi.LOGS_BATCH_ENDPOINT, '[LogsCreateApi]');
      throw error;
    }
  }
}

