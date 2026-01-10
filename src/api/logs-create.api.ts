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
      
      // Transform response to match CreateLogResponse format
      // Handle both formats: {success: true, ...} and {data: {...}} or just {...}
      if (response.success !== undefined) {
        return response as unknown as CreateLogResponse;
      } else {
        // New format without success field - add it
        return {
          success: true,
          data: null,
          message: typeof response.message === 'string' ? response.message : 'Log created successfully',
          timestamp: typeof response.timestamp === 'string' ? response.timestamp : new Date().toISOString(),
        };
      }
    } catch (error) {
      // Suppress logging for 401 errors (token expired) - these are expected
      // and will be automatically refreshed. Logging them creates noise.
      const isAuthError = error instanceof MisoClientError && error.statusCode === 401;
      
      if (!isAuthError) {
        const errorInfo = extractErrorInfo(error, {
          endpoint: LogsCreateApi.LOGS_ENDPOINT,
          method: 'POST',
        });
        logErrorWithContext(errorInfo, '[LogsCreateApi]');
      }
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
      
      // Transform response to match BatchLogResponse format
      // Handle both formats: {success: true, ...} and {data: {...}} or just {...}
      if (response.success !== undefined) {
        return response as unknown as BatchLogResponse;
      } else {
        // New format without success field - add it
        // BatchLogResponse format: {success, message, processed, failed, errors?, timestamp}
        const data = response.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : undefined;
        return {
          success: true,
          message: typeof response.message === 'string' ? response.message : 'Batch logs processed',
          processed: typeof data?.processed === 'number' ? data.processed : typeof response.processed === 'number' ? response.processed : 0,
          failed: typeof data?.failed === 'number' ? data.failed : typeof response.failed === 'number' ? response.failed : 0,
          errors: Array.isArray(data?.errors) ? data.errors : Array.isArray(response.errors) ? response.errors : undefined,
          timestamp: typeof response.timestamp === 'string' ? response.timestamp : new Date().toISOString(),
        };
      }
    } catch (error) {
      // Suppress logging for 401 errors (token expired) - these are expected
      // and will be automatically refreshed. Logging them creates noise.
      const isAuthError = error instanceof MisoClientError && error.statusCode === 401;
      
      if (!isAuthError) {
        const errorInfo = extractErrorInfo(error, {
          endpoint: LogsCreateApi.LOGS_BATCH_ENDPOINT,
          method: 'POST',
        });
        logErrorWithContext(errorInfo, '[LogsCreateApi]');
      }
      throw error;
    }
  }
}

