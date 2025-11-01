/**
 * HTTP client utility for controller communication
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig
} from 'axios';
import { MisoClientConfig, ClientTokenResponse, ErrorResponse, isErrorResponse } from '../types/config.types';
import { MisoClientError } from './errors';

export class HttpClient {
  private axios: AxiosInstance;
  public readonly config: MisoClientConfig;
  private clientToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(config: MisoClientConfig) {
    this.config = config;

    this.axios = axios.create({
      baseURL: config.controllerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor adds client token (or fetches it if needed)
    this.axios.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        config.headers = config.headers || {};
        
        // Get client token (fetch if needed)
        const token = await this.getClientToken();
        if (token) {
          config.headers['x-client-token'] = token;
        }
        
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Enhance error with authentication context
          error.message = 'Authentication failed - token may be invalid';
          // Clear token on 401 to force refresh
          this.clientToken = null;
          this.tokenExpiresAt = null;
        }
        // Note: Don't convert to MisoClientError here - let the method handlers do it
        // This preserves the original error for the try-catch blocks in each method
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get client token, fetching if needed
   * Proactively refreshes if token will expire within 60 seconds
   */
  private async getClientToken(): Promise<string | null> {
    const now = new Date();
    
    // If token exists and not expired (with 60s buffer for proactive refresh), return it
    if (this.clientToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date(now.getTime() + 60000)) {
      return this.clientToken;
    }

    // If refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Fetch new token (either expired or about to expire soon)
    this.tokenRefreshPromise = this.fetchClientToken();
    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Fetch client token from controller
   */
  private async fetchClientToken(): Promise<string> {
    try {
      // Create a temporary axios instance without interceptors to avoid recursion
      const tempAxios = axios.create({
        baseURL: this.config.controllerUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': this.config.clientId,
          'X-Client-Secret': this.config.clientSecret
        }
      });

      const response = await tempAxios.post<ClientTokenResponse>('/api/auth/token');
      
      if (response.data.success && response.data.token) {
        this.clientToken = response.data.token;
        // Set expiration with 30 second buffer before actual expiration
        const expiresIn = response.data.expiresIn - 30;
        this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        return this.clientToken;
      }

      throw new Error('Failed to get client token: Invalid response');
    } catch (error) {
      throw new Error(
        'Failed to get client token: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * Check if error is an AxiosError (supports both instanceof and isAxiosError property)
   */
  private isAxiosError(error: unknown): error is AxiosError {
    if (error instanceof AxiosError) {
      return true;
    }
    // Support for mocked errors in tests
    if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
      return (error as AxiosError).isAxiosError === true;
    }
    return false;
  }

  /**
   * Parse error response from AxiosError
   * Attempts to parse structured ErrorResponse, falls back to null if parsing fails
   */
  private parseErrorResponse(error: AxiosError, requestUrl?: string): ErrorResponse | null {
    try {
      // Check if response data exists
      if (!error.response?.data) {
        return null;
      }

      const data = error.response.data;

      // If data is already an object, check if it matches ErrorResponse structure
      if (typeof data === 'object' && data !== null) {
        // Normalize statusCode field (support both camelCase and snake_case)
        const normalized = { ...data } as Record<string, unknown>;
        if (normalized.status_code && !normalized.statusCode) {
          normalized.statusCode = normalized.status_code;
        }

        // Validate using type guard
        if (isErrorResponse(normalized)) {
          const errorResponse: ErrorResponse = {
            errors: normalized.errors,
            type: normalized.type,
            title: normalized.title,
            statusCode: normalized.statusCode,
            instance: normalized.instance || requestUrl
          };
          return errorResponse;
        }
      }

      // If data is a string, try to parse as JSON
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          const normalized = parsed as Record<string, unknown>;
          if (normalized.status_code && !normalized.statusCode) {
            normalized.statusCode = normalized.status_code;
          }
          if (isErrorResponse(normalized)) {
            const errorResponse: ErrorResponse = {
              errors: normalized.errors,
              type: normalized.type,
              title: normalized.title,
              statusCode: normalized.statusCode,
              instance: normalized.instance || requestUrl
            };
            return errorResponse;
          }
        } catch {
          // JSON parse failed, return null
          return null;
        }
      }

      return null;
    } catch {
      // Any parsing error, return null
      return null;
    }
  }

  /**
   * Create MisoClientError from AxiosError
   * Parses structured error response if available, falls back to errorBody
   */
  private createMisoClientError(error: AxiosError, requestUrl?: string): MisoClientError {
    // Extract status code
    const statusCode = error.response?.status;

    // Try to parse structured error response
    const errorResponse = this.parseErrorResponse(error, requestUrl);

    // Extract errorBody for backward compatibility
    let errorBody: Record<string, unknown> | undefined;
    if (error.response?.data && typeof error.response.data === 'object') {
      errorBody = error.response.data as Record<string, unknown>;
    }

    // Generate default message
    let message = error.message || 'Request failed';
    if (error.response) {
      message = error.response.statusText || `Request failed with status code ${statusCode}`;
    }

    // Create MisoClientError (convert null to undefined)
    return new MisoClientError(message, errorResponse || undefined, errorBody, statusCode);
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.get<T>(url, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.delete<T>(url, config);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const requestUrl = error.config?.url || url;
        throw this.createMisoClientError(error, requestUrl);
      }
      throw error;
    }
  }

  // Generic method for all requests (uses client credentials)
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    switch (method) {
      case 'GET':
        return this.get<T>(url, config);
      case 'POST':
        return this.post<T>(url, data, config);
      case 'PUT':
        return this.put<T>(url, data, config);
      case 'DELETE':
        return this.delete<T>(url, config);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
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
    const requestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        // Add Bearer token for user authentication
        // x-client-token is automatically added by interceptor (not a Bearer token)
        Authorization: `Bearer ${token}`
      }
    };

    switch (method) {
      case 'GET':
        return this.get<T>(url, requestConfig);
      case 'POST':
        return this.post<T>(url, data, requestConfig);
      case 'PUT':
        return this.put<T>(url, data, requestConfig);
      case 'DELETE':
        return this.delete<T>(url, requestConfig);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }
}
