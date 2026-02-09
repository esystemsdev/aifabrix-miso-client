/**
 * Applications API client
 * Handles application status and URLs endpoints (server-side)
 */

import { HttpClient } from '../utils/http-client';
import { AuthStrategy } from '../types/config.types';
import {
  UpdateSelfStatusRequest,
  UpdateSelfStatusResponse,
  ApplicationStatusResponse,
} from './types/applications.types';
import { extractErrorInfo } from '../utils/error-extractor';
import { logErrorWithContext } from '../utils/console-logger';

/**
 * Applications API class
 * Handles application status update and fetch endpoints
 */
export class ApplicationsApi {
  // Centralize endpoint URLs as constants (align with controller plan 138)
  private static readonly SELF_STATUS_ENDPOINT =
    '/api/v1/environments/:envKey/applications/self/status';
  private static readonly APPLICATION_STATUS_ENDPOINT =
    '/api/v1/environments/:envKey/applications/:appKey/status';

  constructor(private httpClient: HttpClient) {}

  /**
   * Replace path parameters in endpoint template
   */
  private buildPath(
    template: string,
    params: { envKey: string; appKey?: string },
  ): string {
    let path = template.replace(':envKey', params.envKey);
    if (params.appKey !== undefined) {
      path = path.replace(':appKey', params.appKey);
    }
    return path;
  }

  /**
   * Update the current application's status and URLs
   * Uses client credentials (x-client-token) when no authStrategy provided
   *
   * @param envKey - Environment key
   * @param body - Update request body (status, url, internalUrl, port)
   * @param authStrategy - Optional authentication strategy override
   * @returns Update response with success and optional application data
   */
  async updateSelfStatus(
    envKey: string,
    body: UpdateSelfStatusRequest,
    authStrategy?: AuthStrategy,
  ): Promise<UpdateSelfStatusResponse> {
    const path = this.buildPath(
      ApplicationsApi.SELF_STATUS_ENDPOINT,
      { envKey },
    );
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<UpdateSelfStatusResponse>(
          'POST',
          path,
          authStrategy.bearerToken,
          body,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<UpdateSelfStatusResponse>(
          'POST',
          path,
          authStrategy,
          body,
        );
      }
      return await this.httpClient.request<UpdateSelfStatusResponse>(
        'POST',
        path,
        body,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: path,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[ApplicationsApi]');
      throw error;
    }
  }

  /**
   * Get any application's status and URLs (without configuration)
   * Uses client credentials when no authStrategy provided
   *
   * @param envKey - Environment key
   * @param appKey - Application key
   * @param authStrategy - Optional authentication strategy override
   * @returns Application status response with metadata
   */
  async getApplicationStatus(
    envKey: string,
    appKey: string,
    authStrategy?: AuthStrategy,
  ): Promise<ApplicationStatusResponse> {
    const path = this.buildPath(
      ApplicationsApi.APPLICATION_STATUS_ENDPOINT,
      { envKey, appKey },
    );
    try {
      if (authStrategy?.bearerToken) {
        return await this.httpClient.authenticatedRequest<ApplicationStatusResponse>(
          'GET',
          path,
          authStrategy.bearerToken,
          undefined,
          undefined,
          authStrategy,
        );
      }
      if (authStrategy) {
        return await this.httpClient.requestWithAuthStrategy<ApplicationStatusResponse>(
          'GET',
          path,
          authStrategy,
        );
      }
      return await this.httpClient.request<ApplicationStatusResponse>(
        'GET',
        path,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: path,
        method: 'GET',
      });
      logErrorWithContext(errorInfo, '[ApplicationsApi]');
      throw error;
    }
  }
}
