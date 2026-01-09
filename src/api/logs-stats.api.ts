/**
 * Logs Stats API client
 * Handles log statistics endpoints
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {

  GetLogStatsQueryParams,
  LogStatsSummaryResponse,
  ErrorStatsQueryParams,
  ErrorStatsResponse,
  UserActivityStatsQueryParams,
  UserActivityStatsResponse,
  ApplicationStatsResponse,
} from './types/logs.types';
import { extractErrorInfo } from '../utils/error-extractor';
import { logErrorWithContext } from '../utils/console-logger';

/**
 * Logs Stats API class
 * Handles log statistics endpoints
 */
export class LogsStatsApi {
  // Centralize endpoint URLs as constants
  private static readonly LOGS_STATS_SUMMARY_ENDPOINT = '/api/v1/logs/stats/summary';
  private static readonly LOGS_STATS_ERRORS_ENDPOINT = '/api/v1/logs/stats/errors';
  private static readonly LOGS_STATS_USERS_ENDPOINT = '/api/v1/logs/stats/users';
  private static readonly LOGS_STATS_APPLICATIONS_ENDPOINT = '/api/v1/logs/stats/applications';

  constructor(private httpClient: HttpClient) {}

  /**
   * Get log statistics summary
   * @param params - Optional query parameters for filtering
   * @param authStrategy - Optional authentication strategy override
   * @returns Log stats summary response
   */
  async getLogStatsSummary(
    params?: GetLogStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<LogStatsSummaryResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<LogStatsSummaryResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_SUMMARY_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<LogStatsSummaryResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_SUMMARY_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<LogStatsSummaryResponse>(
        'GET',
        LogsStatsApi.LOGS_STATS_SUMMARY_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: undefined,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsStatsApi]');
      throw error;
      throw error;
    }
  }

  /**
   * Get error statistics
   * @param params - Optional query parameters for filtering
   * @param authStrategy - Optional authentication strategy override
   * @returns Error stats response
   */
  async getErrorStats(
    params?: ErrorStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<ErrorStatsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<ErrorStatsResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_ERRORS_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<ErrorStatsResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_ERRORS_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<ErrorStatsResponse>(
        'GET',
        LogsStatsApi.LOGS_STATS_ERRORS_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: undefined,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsStatsApi]');
      throw error;
      throw error;
    }
  }

  /**
   * Get user activity statistics
   * @param params - Optional query parameters for filtering
   * @param authStrategy - Optional authentication strategy override
   * @returns User activity stats response
   */
  async getUserActivityStats(
    params?: UserActivityStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<UserActivityStatsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<UserActivityStatsResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_USERS_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<UserActivityStatsResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_USERS_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<UserActivityStatsResponse>(
        'GET',
        LogsStatsApi.LOGS_STATS_USERS_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: undefined,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsStatsApi]');
      throw error;
      throw error;
    }
  }

  /**
   * Get application statistics
   * @param params - Optional query parameters for filtering
   * @param authStrategy - Optional authentication strategy override
   * @returns Application stats response
   */
  async getApplicationStats(
    params?: GetLogStatsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<ApplicationStatsResponse> {
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<ApplicationStatsResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_APPLICATIONS_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<ApplicationStatsResponse>(
          'GET',
          LogsStatsApi.LOGS_STATS_APPLICATIONS_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<ApplicationStatsResponse>(
        'GET',
        LogsStatsApi.LOGS_STATS_APPLICATIONS_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
            const errorInfo = extractErrorInfo(error, {
        endpoint: undefined,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[LogsStatsApi]');
      throw error;
      throw error;
    }
  }
}

