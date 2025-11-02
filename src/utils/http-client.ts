/**
 * Public HTTP client with automatic audit and debug logging
 * Wraps InternalHttpClient and adds ISO 27001 compliant logging
 */

import {
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig
} from 'axios';
import { MisoClientConfig } from '../types/config.types';
import { InternalHttpClient } from './internal-http-client';
import { LoggerService } from '../services/logger.service';
import { DataMasker } from './data-masker';
import jwt from 'jsonwebtoken';

interface RequestMetadata {
  startTime: number;
  method?: string;
  url?: string;
  baseURL?: string;
}

interface AxiosRequestConfigWithMetadata extends InternalAxiosRequestConfig {
  metadata?: RequestMetadata;
}

export class HttpClient {
  private internalClient: InternalHttpClient;
  private logger: LoggerService;
  public readonly config: MisoClientConfig;

  constructor(config: MisoClientConfig, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
    this.internalClient = new InternalHttpClient(config);
    
    // Initialize DataMasker with config path if provided
    if (config.sensitiveFieldsConfig) {
      DataMasker.setConfigPath(config.sensitiveFieldsConfig);
    }
    
    this.setupAuditLogging();
  }

  /**
   * Setup audit and debug logging interceptors
   */
  private setupAuditLogging(): void {
    const axiosInstance = this.internalClient.getAxiosInstance();

    // Request interceptor - capture start time and metadata
    axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (this.shouldAuditRequest(config.url || '')) {
          // Store metadata in config for later use
          (config as AxiosRequestConfigWithMetadata).metadata = {
            startTime: Date.now(),
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL
          } as RequestMetadata;
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Response interceptor - log audit and debug events
    axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log audit/debug asynchronously (don't block response)
        // Use setTimeout for browser compatibility (setImmediate is Node.js only)
        setTimeout(() => {
          this.logHttpRequestAudit(response, null).catch(() => {
            // Silently swallow logging errors
          });
        }, 0);
        return response;
      },
      (error: AxiosError) => {
        // Log audit/debug asynchronously (don't block error handling)
        // Use setTimeout for browser compatibility (setImmediate is Node.js only)
        setTimeout(() => {
          this.logHttpRequestAudit(error.response, error).catch(() => {
            // Silently swallow logging errors
          });
        }, 0);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if request should be audited
   * Excludes certain endpoints to prevent infinite loops
   */
  private shouldAuditRequest(url: string): boolean {
    // Don't audit the logs endpoint itself
    if (url && url.includes('/api/logs')) {
      return false;
    }
    // Don't audit the client token endpoint
    if (url && url.includes('/api/auth/token')) {
      return false;
    }
    return true;
  }

  /**
   * Extract user ID from JWT token
   */
  private extractUserIdFromToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded) return null;
      return (decoded.sub || decoded.userId || decoded.user_id || decoded.id) as string | null;
    } catch {
      return null;
    }
  }

  /**
   * Log HTTP request audit event
   * Masks all sensitive data before logging (ISO 27001 compliance)
   */
  private async logHttpRequestAudit(
    response: AxiosResponse | undefined,
    error: AxiosError | null
  ): Promise<void> {
    try {
      // Get config from response or error
      const config = response?.config || error?.config;
      if (!config) {
        return;
      }

      const metadata = (config as AxiosRequestConfigWithMetadata).metadata;
      if (!metadata) {
        return;
      }

      const duration = Date.now() - metadata.startTime;
      const method = metadata.method || 'UNKNOWN';
      const url = metadata.url || '';
      const baseURL = metadata.baseURL || this.config.controllerUrl;
      const fullUrl = `${baseURL}${url}`;
      const statusCode = response?.status || error?.response?.status || 0;
      const authHeader = config.headers?.authorization as string | undefined;
      const userId = this.extractUserIdFromToken(authHeader);

      // Extract request/response data for masking
      const requestHeaders = config.headers || {};
      const requestBody = config.data || error?.config?.data;
      const responseBody = response?.data || error?.response?.data;
      const responseHeaders = response?.headers || error?.response?.headers || {};

      // ISO 27001 Compliance: Mask ALL sensitive data before logging
      const maskedHeaders = DataMasker.maskSensitiveData(requestHeaders) as Record<string, unknown>;
      const maskedRequestBody = DataMasker.maskSensitiveData(requestBody);
      const maskedResponseBody = DataMasker.maskSensitiveData(responseBody);
      const maskedResponseHeaders = DataMasker.maskSensitiveData(responseHeaders) as Record<string, unknown>;

      // Calculate sizes
      const requestSize = requestBody ? JSON.stringify(requestBody).length : 0;
      const responseSize = responseBody ? JSON.stringify(responseBody).length : 0;

      // Audit log - always log
      await this.logger.audit(
        `http.request.${method}`,
        url,
        {
          method,
          url: fullUrl,
          statusCode,
          duration,
          userId: userId || undefined,
          requestSize: requestSize > 0 ? requestSize : undefined,
          responseSize: responseSize > 0 ? responseSize : undefined,
          error: error?.message || undefined
        },
        {
          token: userId ? undefined : authHeader?.replace('Bearer ', '')
        }
      );

      // Debug log - only if debug mode enabled
      if (this.config.logLevel === 'debug') {
        // Limit response body size for debug logs
        let responseBodySnippet: unknown = maskedResponseBody;
        if (responseBody && typeof responseBody === 'object') {
          const responseStr = JSON.stringify(maskedResponseBody);
          if (responseStr.length > 1000) {
            responseBodySnippet = JSON.parse(responseStr.substring(0, 1000) + '...');
          }
        }

        await this.logger.debug(
          `HTTP ${method} ${url}`,
          {
            method,
            url: fullUrl,
            baseURL,
            statusCode,
            duration,
            userId: userId || undefined,
            timeout: config.timeout || 30000,
            requestHeaders: maskedHeaders,
            responseHeaders: maskedResponseHeaders,
            requestBody: maskedRequestBody,
            responseBody: responseBodySnippet,
            requestSize: requestSize > 0 ? requestSize : undefined,
            responseSize: responseSize > 0 ? responseSize : undefined,
            error: error?.message || undefined
          },
          {
            token: userId ? undefined : authHeader?.replace('Bearer ', '')
          }
        );
      }
    } catch {
      // Silently swallow all logging errors - never break HTTP requests
    }
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.internalClient.get<T>(url, config);
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.internalClient.post<T>(url, data, config);
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.internalClient.put<T>(url, data, config);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.internalClient.delete<T>(url, config);
  }

  // Generic method for all requests (uses client credentials)
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.internalClient.request<T>(method, url, data, config);
  }

  // For requests that need Bearer token (user auth)
  // IMPORTANT: Client token is sent as x-client-token header (via interceptor)
  // User token is sent as Authorization: Bearer header (this method parameter)
  // These are two separate tokens for different purposes
  async authenticatedRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    token: string, // User authentication token (sent as Bearer token)
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.internalClient.authenticatedRequest<T>(method, url, token, data, config);
  }
}
