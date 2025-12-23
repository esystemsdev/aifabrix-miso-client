/**
 * Logs Export API client
 * Handles log export endpoints
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  ExportLogsQueryParams,
  ExportLogsResponse,
} from './types/logs.types';

/**
 * Logs Export API class
 * Handles log export endpoints
 */
export class LogsExportApi {
  // Centralize endpoint URLs as constants
  private static readonly LOGS_EXPORT_ENDPOINT = '/api/v1/logs/export';

  constructor(private httpClient: HttpClient) {}

  /**
   * Export logs (CSV or JSON format)
   * @param params - Export logs query parameters
   * @param authStrategy - Optional authentication strategy override
   * @returns CSV string or JSON ExportLogsResponse object
   */
  async exportLogs(
    params: ExportLogsQueryParams,
    authStrategy?: AuthStrategy,
  ): Promise<string | ExportLogsResponse> {
    try {
      // Export endpoint returns different content types based on format parameter
      // CSV returns text/csv (string), JSON returns application/json (object)
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<string | ExportLogsResponse>(
          'GET',
          LogsExportApi.LOGS_EXPORT_ENDPOINT,
          authStrategy.bearerToken,
          undefined,
          { params },
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<string | ExportLogsResponse>(
          'GET',
          LogsExportApi.LOGS_EXPORT_ENDPOINT,
          authStrategy,
          undefined,
          { params },
        );
      }
      return await this.httpClient.request<string | ExportLogsResponse>(
        'GET',
        LogsExportApi.LOGS_EXPORT_ENDPOINT,
        undefined,
        { params },
      );
    } catch (error) {
      console.error('Export logs API call failed:', error);
      throw error;
    }
  }
}

