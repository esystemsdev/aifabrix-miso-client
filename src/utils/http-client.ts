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
   * Quick size estimation without full JSON.stringify
   * Uses property count and string length for fast estimation
   */
  private estimateObjectSize(obj: unknown): number {
    if (obj === null || obj === undefined) {
      return 0;
    }

    if (typeof obj === 'string') {
      return obj.length;
    }

    if (typeof obj !== 'object') {
      return 10; // Estimate for primitives
    }

    if (Array.isArray(obj)) {
      // Estimate based on array length and first few items
      const length = obj.length;
      if (length === 0) return 10;
      
      // Sample first few items for estimation
      const sampleSize = Math.min(3, length);
      let estimatedItemSize = 0;
      for (let i = 0; i < sampleSize; i++) {
        estimatedItemSize += this.estimateObjectSize(obj[i]);
      }
      const avgItemSize = sampleSize > 0 ? estimatedItemSize / sampleSize : 100;
      return length * avgItemSize;
    }

    // Object: estimate based on property count and values
    const entries = Object.entries(obj as Record<string, unknown>);
    let size = 0;
    for (const [key, value] of entries) {
      size += key.length + this.estimateObjectSize(value);
    }
    return size;
  }

  /**
   * Truncate response body to reduce processing cost
   * Returns truncated body with flag indicating truncation
   */
  private truncateResponseBody(body: unknown, maxSize: number = 10000): { data: unknown; truncated: boolean } {
    if (body === null || body === undefined) {
      return { data: body, truncated: false };
    }

    // For strings, truncate directly
    if (typeof body === 'string') {
      if (body.length <= maxSize) {
        return { data: body, truncated: false };
      }
      return { data: body.substring(0, maxSize) + '...', truncated: true };
    }

    // For objects/arrays, estimate size first
    const estimatedSize = this.estimateObjectSize(body);
    if (estimatedSize <= maxSize) {
      return { data: body, truncated: false };
    }

    // If estimated size is too large, return placeholder
    // Full body only processed in debug mode
    return { 
      data: { _message: 'Response body too large, truncated for performance', _estimatedSize: estimatedSize }, 
      truncated: true 
    };
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
      // Get config from response or error
      const config = response?.config || error?.config;
      if (!config) {
        return;
      }

      const metadata = (config as AxiosRequestConfigWithMetadata).metadata;
      if (!metadata) {
        return;
      }

      // Get audit configuration with defaults
      const auditConfig = this.config.audit || {};
      const auditLevel = auditConfig.level || 'detailed';
      const maxResponseSize = auditConfig.maxResponseSize ?? 10000;
      const maxMaskingSize = auditConfig.maxMaskingSize ?? 50000;
      const isDebugMode = this.config.logLevel === 'debug';

      const duration = Date.now() - metadata.startTime;
      const method = metadata.method || 'UNKNOWN';
      const url = metadata.url || '';
      const baseURL = metadata.baseURL || this.config.controllerUrl;
      const fullUrl = `${baseURL}${url}`;
      const statusCode = response?.status || error?.response?.status || 0;
      const authHeader = config.headers?.authorization as string | undefined;
      const userId = this.extractUserIdFromToken(authHeader);

      // Extract request/response data
      const requestHeaders = config.headers || {};
      const requestBody = config.data || error?.config?.data;
      const responseBody = response?.data || error?.response?.data;
      const responseHeaders = response?.headers || error?.response?.headers || {};

      // Minimal audit level: Only metadata, no masking, no sizes
      if (auditLevel === 'minimal') {
        await this.logger.audit(
          `http.request.${method}`,
          url,
          {
            method,
            url: fullUrl,
            statusCode,
            duration,
            userId: userId || undefined,
            error: error?.message || undefined
          },
          {
            token: userId ? undefined : authHeader?.replace('Bearer ', '')
          }
        );
        return;
      }

      // Estimate sizes for routing decisions
      const estimatedRequestSize = requestBody ? this.estimateObjectSize(requestBody) : 0;
      const estimatedResponseSize = responseBody ? this.estimateObjectSize(responseBody) : 0;

      // Fast path for small requests (< 1KB) - minimal masking
      const isSmallRequest = estimatedRequestSize < 1024 && estimatedResponseSize < 1024;

      // Metadata-only path for large requests (> maxMaskingSize)
      const isLargeRequest = estimatedRequestSize > maxMaskingSize || estimatedResponseSize > maxMaskingSize;

      // Truncate response body before masking (performance optimization)
      const { data: truncatedResponseBody, truncated: responseTruncated } = 
        this.truncateResponseBody(responseBody, maxResponseSize);

      // Truncate request body if needed
      const { data: truncatedRequestBody, truncated: requestTruncated } = 
        requestBody && this.estimateObjectSize(requestBody) > maxResponseSize
          ? this.truncateResponseBody(requestBody, maxResponseSize)
          : { data: requestBody, truncated: false };

      // Masking strategy based on size and audit level
      let maskedHeaders: Record<string, unknown>;
      let maskedRequestBody: unknown;
      let maskedResponseBody: unknown;
      let maskedResponseHeaders: Record<string, unknown>;

      if (auditLevel === 'standard') {
        // Standard level: Light masking (headers only, skip body masking for large objects)
        maskedHeaders = DataMasker.maskSensitiveData(requestHeaders) as Record<string, unknown>;
        maskedResponseHeaders = DataMasker.maskSensitiveData(responseHeaders) as Record<string, unknown>;
        
        if (isSmallRequest) {
          maskedRequestBody = DataMasker.maskSensitiveData(truncatedRequestBody);
          maskedResponseBody = DataMasker.maskSensitiveData(truncatedResponseBody);
        } else if (isLargeRequest) {
          maskedRequestBody = { _message: 'Request body too large, masking skipped' };
          maskedResponseBody = { _message: 'Response body too large, masking skipped' };
        } else {
          maskedRequestBody = DataMasker.maskSensitiveData(truncatedRequestBody);
          maskedResponseBody = DataMasker.maskSensitiveData(truncatedResponseBody);
        }
      } else {
        // Detailed/Full level: Full masking with parallelization
        if (isLargeRequest) {
          // Skip masking for very large objects
          maskedHeaders = requestHeaders as Record<string, unknown>;
          maskedResponseHeaders = responseHeaders as Record<string, unknown>;
          maskedRequestBody = { _message: 'Request body too large, masking skipped' };
          maskedResponseBody = { _message: 'Response body too large, masking skipped' };
        } else if (isSmallRequest) {
          // Fast path: sequential masking (small objects, no benefit from parallelization)
          maskedHeaders = DataMasker.maskSensitiveData(requestHeaders) as Record<string, unknown>;
          maskedRequestBody = DataMasker.maskSensitiveData(truncatedRequestBody);
          maskedResponseBody = DataMasker.maskSensitiveData(truncatedResponseBody);
          maskedResponseHeaders = DataMasker.maskSensitiveData(responseHeaders) as Record<string, unknown>;
        } else {
          // Parallelize masking for medium-sized objects
          const [maskedHeadersResult, maskedRequestBodyResult, maskedResponseBodyResult, maskedResponseHeadersResult] = 
            await Promise.all([
              Promise.resolve(DataMasker.maskSensitiveData(requestHeaders)),
              Promise.resolve(DataMasker.maskSensitiveData(truncatedRequestBody)),
              Promise.resolve(DataMasker.maskSensitiveData(truncatedResponseBody)),
              Promise.resolve(DataMasker.maskSensitiveData(responseHeaders))
            ]);
          
          maskedHeaders = maskedHeadersResult as Record<string, unknown>;
          maskedRequestBody = maskedRequestBodyResult;
          maskedResponseBody = maskedResponseBodyResult;
          maskedResponseHeaders = maskedResponseHeadersResult as Record<string, unknown>;
        }
      }

      // Calculate sizes efficiently (only for detailed/full levels)
      let requestSize: number | undefined;
      let responseSize: number | undefined;

      if (auditLevel === 'detailed' || auditLevel === 'full') {
        // Reuse stringified results if available, otherwise calculate
        let requestStr: string | undefined;
        let responseStr: string | undefined;

        if (requestBody) {
          requestStr = JSON.stringify(requestBody);
          const calculatedSize = Buffer.byteLength(requestStr);
          // Treat empty objects/arrays as size 0 (they serialize to "{}" or "[]")
          requestSize = calculatedSize <= 2 ? 0 : calculatedSize;
        }

        if (responseBody) {
          responseStr = JSON.stringify(responseBody);
          const calculatedSize = Buffer.byteLength(responseStr);
          // Treat empty objects/arrays as size 0 (they serialize to "{}" or "[]")
          responseSize = calculatedSize <= 2 ? 0 : calculatedSize;
        }
      }

      // Build audit context
      const auditContext: Record<string, unknown> = {
        method,
        url: fullUrl,
        statusCode,
        duration,
        userId: userId || undefined,
        error: error?.message || undefined
      };

      // Add sizes only for detailed/full levels
      if (auditLevel === 'detailed' || auditLevel === 'full') {
        // Include size field even if 0 (as undefined) for consistency with old behavior
        auditContext.requestSize = requestSize !== undefined && requestSize > 0 ? requestSize : undefined;
        auditContext.responseSize = responseSize !== undefined && responseSize > 0 ? responseSize : undefined;
        
        if (requestTruncated) {
          auditContext.requestTruncated = true;
        }
        if (responseTruncated) {
          auditContext.responseTruncated = true;
        }
      }

      // Audit log - always log
      await this.logger.audit(
        `http.request.${method}`,
        url,
        auditContext,
        {
          token: userId ? undefined : authHeader?.replace('Bearer ', '')
        }
      );

      // Debug log - only if debug mode enabled
      // Note: auditLevel cannot be 'minimal' here due to early return above
      if (isDebugMode) {
        // Limit response body size for debug logs
        let responseBodySnippet: unknown = maskedResponseBody;
        if (maskedResponseBody && typeof maskedResponseBody === 'object') {
          const responseStr = JSON.stringify(maskedResponseBody);
          if (responseStr.length > 1000) {
            try {
              responseBodySnippet = JSON.parse(responseStr.substring(0, 1000) + '...');
            } catch {
              responseBodySnippet = { _message: 'Response body truncated' };
            }
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
            requestSize: requestSize !== undefined && requestSize > 0 ? requestSize : undefined,
            responseSize: responseSize !== undefined && responseSize > 0 ? responseSize : undefined,
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
