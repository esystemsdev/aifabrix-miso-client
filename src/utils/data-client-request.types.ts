import {
  ApiRequestOptions,
  BrowserSessionRecoveryResult,
  DataClientConfig,
  InterceptorConfig,
  CacheEntry,
} from "../types/data-client.types";
import { MisoClient } from "../miso-client";
import { HasAnyTokenFn, GetTokenFn } from "./data-client-audit";

export interface RetryConfig {
  maxRetries: number;
  retryEnabled: boolean;
  baseDelay: number;
  maxDelay: number;
}

export interface RequestRetryState {
  authErrorDetected: boolean;
  tokenRefreshAttempted: boolean;
}

export interface RequestMetricsState {
  totalRequests: number;
  totalFailures: number;
  responseTimes: number[];
}

export interface AttemptRequestParams {
  attempt: number;
  method: string;
  fullUrl: string;
  endpoint: string;
  config: DataClientConfig;
  cache: Map<string, CacheEntry>;
  cacheKey: string;
  cacheEnabled: boolean;
  startTime: number;
  misoClient: MisoClient | null;
  hasAnyToken: HasAnyTokenFn;
  getToken: GetTokenFn;
  handleAuthError: () => void;
  recoverBrowserSession: () => Promise<BrowserSessionRecoveryResult>;
  recordBrowserSessionReplayUnauthorized: () => void;
  interceptors: InterceptorConfig;
  metrics: RequestMetricsState;
  options?: ApiRequestOptions;
  retryConfig: RetryConfig;
  state: RequestRetryState;
}

export interface ExecuteHttpRequestOptions {
  method: string;
  fullUrl: string;
  endpoint: string;
  config: DataClientConfig;
  cache: Map<string, CacheEntry>;
  cacheKey: string;
  cacheEnabled: boolean;
  startTime: number;
  misoClient: MisoClient | null;
  hasAnyToken: HasAnyTokenFn;
  getToken: GetTokenFn;
  handleAuthError: () => void;
  recoverBrowserSession: () => Promise<BrowserSessionRecoveryResult>;
  recordBrowserSessionReplayUnauthorized: () => void;
  interceptors: InterceptorConfig;
  metrics: RequestMetricsState;
  options?: ApiRequestOptions;
}
