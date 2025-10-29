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
import { MisoClientConfig, ClientTokenResponse } from '../types/config.types';

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

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.delete<T>(url, config);
    return response.data;
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
