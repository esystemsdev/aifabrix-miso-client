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
import { MisoClientConfig } from '../types/config.types';

export class HttpClient {
  private axios: AxiosInstance;
  private config: MisoClientConfig;

  constructor(config: MisoClientConfig) {
    this.config = config;

    this.axios = axios.create({
      baseURL: config.controllerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Environment': config.environment,
        'X-Application': config.applicationKey
      }
    });

    // Add request interceptor for automatic headers
    this.axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        config.headers = config.headers || {};
        config.headers['X-Environment'] = this.config.environment;
        config.headers['X-Application'] = this.config.applicationKey;
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
        }
        return Promise.reject(error);
      }
    );
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

  // Method for requests that need Authorization header
  async authenticatedRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    token: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const requestConfig = {
      ...config,
      headers: {
        ...config?.headers,
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
