/**
 * Type definitions for DataClient browser wrapper
 */

import { MisoClientConfig } from "./config.types";

/**
 * ISO 27001 audit logging configuration
 */
export interface AuditConfig {
  /**
   * Audit detail level
   * - minimal: Only method, URL, status, duration, userId
   * - standard: Includes headers and bodies (masked)
   * - detailed: Includes sizes and more metadata
   * - full: Complete audit trail with all details
   */
  level?: "minimal" | "standard" | "detailed" | "full";
  
  /**
   * Batch size for queued audit logs (default: 10)
   */
  batchSize?: number;
  
  /**
   * Maximum response size to include in audit logs (default: 10000)
   */
  maxResponseSize?: number;
  
  /**
   * Maximum size before skipping masking (default: 50000)
   */
  maxMaskingSize?: number;
  
  /**
   * Endpoints to skip audit logging (e.g., ['/health', '/metrics'])
   */
  skipEndpoints?: string[];
  
  /**
   * Enable/disable audit logging (default: true)
   */
  enabled?: boolean;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Default TTL in seconds (default: 300 = 5 minutes)
   */
  defaultTTL?: number;
  
  /**
   * Maximum cache size in entries (default: 100)
   */
  maxSize?: number;
  
  /**
   * Enable cache (default: true)
   */
  enabled?: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum number of retries (default: 3)
   */
  maxRetries?: number;
  
  /**
   * Base delay in milliseconds for exponential backoff (default: 1000)
   */
  baseDelay?: number;
  
  /**
   * Maximum delay in milliseconds (default: 10000)
   */
  maxDelay?: number;
  
  /**
   * Enable retry logic (default: true)
   */
  enabled?: boolean;
}

/**
 * DataClient configuration
 */
export interface DataClientConfig {
  /**
   * Base URL for API requests
   */
  baseUrl: string;
  
  /**
   * MisoClient configuration (required for authentication and audit logging)
   */
  misoConfig: MisoClientConfig;
  
  /**
   * Token storage keys in localStorage (default: ['token', 'accessToken', 'authToken'])
   */
  tokenKeys?: string[];
  
  /**
   * Login redirect URL (default: '/login')
   */
  loginUrl?: string;
  
  /**
   * Logout redirect URL (default: falls back to loginUrl or '/login')
   */
  logoutUrl?: string;
  
  /**
   * Cache configuration
   */
  cache?: CacheConfig;
  
  /**
   * Retry configuration
   */
  retry?: RetryConfig;
  
  /**
   * ISO 27001 audit logging configuration
   */
  audit?: AuditConfig;
  
  /**
   * Default request timeout in milliseconds (default: 30000)
   */
  timeout?: number;
  
  /**
   * Default headers to include in all requests
   */
  defaultHeaders?: Record<string, string>;
}

/**
 * Extended RequestInit with DataClient-specific options
 */
export interface ApiRequestOptions extends RequestInit {
  /**
   * Skip authentication for this request
   */
  skipAuth?: boolean;
  
  /**
   * Override retry count for this request
   */
  retries?: number;
  
  /**
   * AbortController signal for cancellation
   */
  signal?: AbortSignal;
  
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Cache options
   */
  cache?: {
    /**
     * Enable caching for this request (default: true for GET requests)
     */
    enabled?: boolean;
    
    /**
     * Cache TTL in seconds
     */
    ttl?: number;
    
    /**
     * Cache key (auto-generated if not provided)
     */
    key?: string;
  };
  
  /**
   * Skip audit logging for this request
   */
  skipAudit?: boolean;
}

/**
 * Request interceptor function
 */
export type RequestInterceptor = (
  url: string,
  options: ApiRequestOptions,
) => Promise<ApiRequestOptions> | ApiRequestOptions;

/**
 * Response interceptor function
 */
export type ResponseInterceptor = <T>(
  response: Response,
  data: T,
) => Promise<T> | T;

/**
 * Error interceptor function
 */
export type ErrorInterceptor = (
  error: Error,
  response?: Response,
) => Promise<Error> | Error;

/**
 * Interceptor configuration
 */
export interface InterceptorConfig {
  /**
   * Request interceptor
   */
  onRequest?: RequestInterceptor;
  
  /**
   * Response interceptor
   */
  onResponse?: ResponseInterceptor;
  
  /**
   * Error interceptor
   */
  onError?: ErrorInterceptor;
}

/**
 * Request metrics structure
 */
export interface RequestMetrics {
  /**
   * Total number of requests
   */
  totalRequests: number;
  
  /**
   * Total number of failed requests
   */
  totalFailures: number;
  
  /**
   * Average response time in milliseconds
   */
  averageResponseTime: number;
  
  /**
   * Response time distribution (in milliseconds)
   */
  responseTimeDistribution: {
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  
  /**
   * Error rate (0-1)
   */
  errorRate: number;
  
  /**
   * Cache hit rate (0-1)
   */
  cacheHitRate: number;
}

/**
 * Cache entry structure
 */
export interface CacheEntry {
  /**
   * Cached data
   */
  data: unknown;
  
  /**
   * Expiration timestamp
   */
  expiresAt: number;
  
  /**
   * Cache key
   */
  key: string;
}

/**
 * Base API error class
 */
export class ApiError extends Error {
  public readonly statusCode?: number;
  public readonly response?: Response;
  public readonly originalError?: Error;

  constructor(
    message: string,
    statusCode?: number,
    response?: Response,
    originalError?: Error,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.response = response;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Network error (connection failures, CORS, etc.)
 */
export class NetworkError extends ApiError {
  constructor(message: string, originalError?: Error) {
    super(message, 0, undefined, originalError);
    this.name = "NetworkError";
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends ApiError {
  constructor(message: string, _timeout: number) {
    super(message, 408);
    this.name = "TimeoutError";
  }
}

/**
 * Authentication error (401 Unauthorized)
 */
export class AuthenticationError extends ApiError {
  constructor(message: string, response?: Response) {
    super(message, 401, response);
    this.name = "AuthenticationError";
  }
}

