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
import {
  extractRequestMetadata,
  RequestMetadata,
  AxiosRequestConfigWithMetadata
} from './http-client-metadata';
import { logHttpRequestAudit } from './http-client-audit';

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
    // Check if audit is disabled
    if (this.config.audit?.enabled === false) {
      return false;
    }
    
    // Check skip endpoints
    if (this.config.audit?.skipEndpoints) {
      for (const endpoint of this.config.audit.skipEndpoints) {
        if (url && url.includes(endpoint)) {
          return false;
        }
      }
    }
    
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
   * Log HTTP request audit event
   * Masks all sensitive data before logging (ISO 27001 compliance)
   * Optimized with size limits, fast paths, and configurable audit levels
   */
  private async logHttpRequestAudit(
    response: AxiosResponse | undefined,
    error: AxiosError | null
  ): Promise<void> {
    try {
      const metadata = extractRequestMetadata(response, error, this.config);
      await logHttpRequestAudit(metadata, error, this.config, this.logger);
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

  /**
   * GET request with filter builder support.
   * Builds query string from FilterBuilder and appends to URL.
   * @param url - Request URL (without query string)
   * @param filterBuilder - FilterBuilder instance with filters
   * @param config - Optional Axios request config
   * @returns Promise with response data
   */
  async getWithFilters<T>(url: string, filterBuilder: { toQueryString(): string }, config?: AxiosRequestConfig): Promise<T> {
    const queryString = filterBuilder.toQueryString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return this.internalClient.get<T>(fullUrl, config);
  }

  /**
   * GET request with pagination support.
   * Appends pagination query parameters (page, page_size) to URL.
   * @param url - Request URL (without query string)
   * @param pagination - Pagination options with page and page_size
   * @param config - Optional Axios request config
   * @returns Promise with response data
   */
  async getPaginated<T>(
    url: string,
    pagination: { page: number; page_size: number },
    config?: AxiosRequestConfig
  ): Promise<T> {
    const params = new URLSearchParams();
    params.append('page', pagination.page.toString());
    params.append('page_size', pagination.page_size.toString());
    const fullUrl = `${url}?${params.toString()}`;
    return this.internalClient.get<T>(fullUrl, config);
  }
}
